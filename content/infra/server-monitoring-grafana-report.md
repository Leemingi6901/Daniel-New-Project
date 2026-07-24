---
title: "서버 모니터링 자동화 — Grafana 에이전트 설치 + 엑셀 리포트 자동 생성"
description: "폐쇄망 서버에 모니터링 에이전트를 자동 설치하고 Prometheus 데이터를 엑셀 주간 리포트로 자동 생성·업로드하는 파이프라인"
updated: "2026-07-09"
tags: [Python, Grafana, Prometheus, GPU, Automation, 폐쇄망]
---

폐쇄망 서버에 모니터링 에이전트를 자동 설치하고, Prometheus 데이터를 기반으로 엑셀 리포트를 자동 생성하는 파이썬 프로젝트. 단순히 Grafana 대시보드만 보는 게 아니라, 주간 보고서를 엑셀로 자동 생성해서 공유 폴더에 업로드하는 것까지 자동화했다.

## 프로젝트 개요

### 모니터링 스택 구성

```
[각 서버]
  ├── node_exporter      → CPU, Memory, Disk, Network 메트릭 (포트 9182)
  ├── process-exporter   → 프로세스별 메트릭
  ├── promtail           → 로그 수집 → Loki 전송
  └── dcgm-exporter      → GPU 메트릭 (GPU 서버만)

        ↓ 수집
  [Prometheus]

        ↓ 시각화
  [Grafana 대시보드]

        ↓ 자동 리포트
  [report_generator.py]
    → 엑셀 파일 생성 → 공유 폴더 SFTP 업로드
```

## 파일 구조

```
grafana_install/
├── download_grafana.py     # 인터넷 PC에서 에이전트 바이너리 다운로드
├── grafana_install.py      # SSH 자동 설치 메인 스크립트
├── ip_list.txt
└── grafana_files/
    ├── grafana_agent.tar   # node_exporter + process-exporter + promtail
    └── gpu_exporter/       # DCGM Exporter (GPU 서버 전용)

excel_report/
├── report_generator19.py   # 리포트 생성 메인 스크립트
└── setup_report15.py       # Windows PC에서 스케줄러 등록
```

## Step 1 — 에이전트 파일 다운로드

```bash
python download_grafana.py --output ./grafana_files
```

| 다운로드 파일 | 설명 |
|--------------|------|
| `node_exporter-*.linux-amd64.tar.gz` | 서버 기본 메트릭 |
| `process-exporter_*.rpm` | 프로세스 메트릭 |
| `promtail-*.rpm` | 로그 수집 |
| `datacenter-gpu-manager-*.rpm` | NVIDIA DCGM |

## Step 2 — 에이전트 자동 설치

```bash
# 일반 서버
python grafana_install.py --ip-list ip_list.txt

# GPU 서버 (DCGM Exporter 추가 설치)
python grafana_install.py --ip-list ip_list.txt --gpu

# 병렬 처리 + 재설치
python grafana_install.py --ip-list ip_list.txt --parallel 3 --reinstall
```

### 설치 흐름

```
[1] SSH 접속
 ↓
[2] 에이전트 파일 SFTP 전송
 ↓
[3] node_exporter 설치 → systemd 서비스 등록 (포트 9182)
 ↓
[4] process-exporter RPM 설치
 ↓
[5] promtail RPM 설치 → Loki 주소 설정
 ↓
[6] GPU 서버: DCGM Exporter 설치
 ↓
[7] 각 exporter 동작 확인 (curl localhost:9182/metrics)
```

### node_exporter systemd 서비스 자동 등록

```python
NODE_EXPORTER_SERVICE = """
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=nodeusr
ExecStart=/usr/local/bin/node_exporter --web.listen-address=:9182
Restart=always

[Install]
WantedBy=multi-user.target
"""
```

## Step 3 — 엑셀 리포트 자동 생성

### 실행

```bash
# Prometheus 서버에서 실행 (또는 접근 가능한 PC에서)
python report_generator19.py
```

### 리포트 구성

생성되는 엑셀 파일은 요약 시트 + 서버별 상세 시트 구조다.

**요약 시트 (Summary)**

| KPI 카드 | 내용 |
|---------|------|
| CPU 평균 | 전체 서버 평균 CPU 사용률 |
| 메모리 평균 | 전체 서버 평균 메모리 사용률 |
| GPU 평균 | GPU 서버 평균 사용률 |
| VRAM 평균 | GPU 서버 평균 VRAM 사용률 |
| 경고 서버 수 | 임계치(80%) 초과 서버 수 |

**서버별 상태 색상**

| 상태 | 기준 | 색상 |
|------|------|------|
| 미흡 | < 20% | 노란 배경 + 빨간 볼드 |
| 보통 | 20 ~ 80% | 흰 배경 + 검정 볼드 |
| 경고 | ≥ 80% | 빨간 배경 + 노란 볼드 |

**상세 시트 (서버별)**

- 7일 CPU/Memory/Disk 트렌드 차트
- 30일 GPU 사용률 + VRAM 이력 테이블
- 최근 로그인 시간

### Prometheus 쿼리 핵심

```python
# 올바른 하루 평균 집계 방법
query_gpu = f'avg_over_time(DCGM_FI_DEV_GPU_UTIL{{instance=~"{ip}:.*"}}[24h])'

# 이렇게 하면 순간값 → 항상 0% 나옴
query_wrong = f'avg(DCGM_FI_DEV_GPU_UTIL{{instance=~"{ip}:.*"}})'

# VRAM 일자별 최대 사용량 (30일)
query_vram = f'max_over_time(DCGM_FI_DEV_FB_USED{{instance=~"{ip}:.*"}}[1d])'
```

> **GPU 0% 버그**: 처음에 `avg()`만 쓰면 순간 스냅샷이라 항상 0에 가깝게 나왔다. `avg_over_time(...[24h])`로 바꾸면서 실제 하루 평균이 잘 집계됐다.

### GPU 서버 감지 로직

```python
# GPU 메트릭 존재 여부로 GPU 서버 판별
query_detect = f'count by(instance) (DCGM_FI_DEV_GPU_UTIL{{instance=~"{ip}:.*"}})'

# 사용률이 0%여도 메트릭이 존재하면 GPU 서버로 인식
is_gpu_server = (query_detect 결과 > 0)
```

### 엑셀 차트 자동 생성 (LineChart)

```python
from openpyxl.chart import LineChart, Reference

chart = LineChart()
chart.title = "GPU 사용률 30일 트렌드"
chart.style = 10
chart.y_axis.title = "사용률 (%)"
chart.x_axis.title = "날짜"

data_ref = Reference(ws, min_col=2, min_row=1, max_row=31)
chart.add_data(data_ref, titles_from_data=True)
ws.add_chart(chart, "A35")
```

### 완성된 리포트 SFTP 자동 업로드

생성된 엑셀 파일을 지정된 공유 서버 경로로 자동 업로드한다.

```python
SFTP_REMOTE_DIR = "/data/orgcowork/00001/data/0. Server_Monitoring_data"

def upload_report(local_path: str):
    transport = paramiko.Transport((SFTP_HOST, SFTP_PORT))
    transport.connect(username=SFTP_USER, password=SFTP_PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(local_path, f"{SFTP_REMOTE_DIR}/{Path(local_path).name}")
```

## Step 4 — 자동 실행 스케줄 등록 (Windows)

`setup_report15.py`를 실행하면 Windows 작업 스케줄러에 등록되어 매일 자동으로 리포트가 생성된다.

```bash
# 관리자 권한으로 실행
python setup_report15.py --time 08:00
```

## 포인트 정리

- **폐쇄망 설치**: 모든 에이전트 파일을 미리 다운로드 후 SFTP 전송
- **GPU 서버 자동 감지**: DCGM 메트릭 존재 여부로 자동 판별
- **Prometheus 쿼리 주의**: `avg_over_time([24h])`를 써야 하루 평균이 제대로 나옴
- **엑셀 차트 자동화**: openpyxl LineChart로 트렌드 차트 자동 생성
- **완전 자동화**: 리포트 생성 → 공유 폴더 업로드까지 원클릭
