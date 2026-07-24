---
title: "다수 서버 정보 일괄 수집 → 엑셀 자동 저장 스크립트 개발기"
description: "SSH로 수십 대 서버의 OS·소프트웨어 버전을 한 번에 수집해 색상 표시된 엑셀 리포트로 정리하는 스크립트"
updated: "2026-07-03"
tags: [Python, Excel, 서버관리, Automation, RHEL]
---

수십 대 서버의 기본 정보를 SSH로 한 번에 수집해서 엑셀로 정리해주는 스크립트. "지금 서버가 몇 대인데, 각각 OS가 뭐고 Docker 버전이 뭐야?"라는 질문에 바로 답하기 위해 만들었다. 서버가 많아질수록 수동으로 일일이 확인하는 건 불가능에 가까워진다.

## 배경

- **환경**: 폐쇄망 내 수십 대의 RHEL/CentOS/Rocky Linux 서버
- **문제**: OS 버전, 설치 소프트웨어, 커널 버전 등을 일일이 확인해야 하는 상황
- **목표**: 한 번 실행으로 전체 서버 현황을 깔끔한 엑셀 파일로 출력

## 수집 항목

| 항목 | 수집 명령 |
|------|----------|
| IP 주소 | (ip_list.txt에서) |
| Hostname | `hostname` |
| OS 버전 | `cat /etc/os-release` |
| Kernel | `uname -r` |
| Docker 버전 | `docker --version` |
| Python 버전 | `python3 --version` |
| Nginx 버전 | `nginx -v` |
| Apache 버전 | `httpd -v` |
| MariaDB / MySQL | `mysql --version` |
| NVIDIA 드라이버 | `nvidia-smi --query-gpu=driver_version` |
| 마지막 수집 시각 | 스크립트 실행 시간 |

## 사용법

```bash
# 기본 실행 (output: server_info_YYYYMMDD.xlsx)
python collect_info.py --ip-list ip_list.txt

# 출력 파일명 지정
python collect_info.py --ip-list ip_list.txt --output report.xlsx

# 병렬 10대 동시 수집
python collect_info.py --ip-list ip_list.txt --parallel 10
```

## 핵심 코드

### 서버 정보 수집

```python
@dataclass
class ServerInfo:
    ip: str
    hostname: str = UNKNOWN
    os_name: str = UNKNOWN
    os_version: str = UNKNOWN
    kernel: str = UNKNOWN
    docker: str = NOT_INSTALLED
    python3: str = NOT_INSTALLED
    nginx: str = NOT_INSTALLED
    apache: str = NOT_INSTALLED
    mariadb: str = NOT_INSTALLED
    nvidia_driver: str = NOT_INSTALLED
    collected_at: str = ""
    error: str = ""

def collect_server_info(ip: str) -> ServerInfo:
    info = ServerInfo(ip=ip)
    ssh = connect_ssh(ip)
    if ssh is None:
        info.error = "SSH 접속 실패"
        return info

    # OS 정보
    out, _, _ = run_cmd(ssh, "cat /etc/os-release")
    info.os_name = parse_os_name(out)

    # 소프트웨어 버전 (없으면 NOT_INSTALLED)
    for attr, cmd, parser in [
        ("docker",  "docker --version 2>/dev/null",         parse_docker),
        ("python3", "python3 --version 2>/dev/null",        parse_python),
        ("nginx",   "nginx -v 2>&1",                         parse_nginx),
        ("mariadb", "mysql --version 2>/dev/null",           parse_mysql),
        ("nvidia_driver", "nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null", str.strip),
    ]:
        out, _, rc = run_cmd(ssh, cmd)
        setattr(info, attr, parser(out) if rc == 0 and out.strip() else NOT_INSTALLED)

    info.collected_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    return info
```

### 엑셀 출력 (색상 포함)

```python
# 헤더 스타일
HEADER_BG = "1F4E79"   # 진한 파란색
HEADER_FG = "FFFFFF"   # 흰 글자

# 행 색상
ROW_ODD    = "EBF3FB"  # 연한 파란색
ROW_EVEN   = "FFFFFF"  # 흰색

# 특수 상태 색상
COLOR_NOT_INSTALLED = "FFD7D7"  # 연한 빨간색 (미설치)
COLOR_UNKNOWN       = "FFF3CD"  # 연한 노란색 (확인 불가)
COLOR_FAIL          = "FFCCCC"  # 빨간색 (접속 실패)

def apply_row_color(ws, row_idx, info: ServerInfo):
    fill_color = COLOR_FAIL if info.error else (ROW_ODD if row_idx % 2 else ROW_EVEN)
    for cell in ws[row_idx]:
        cell.fill = PatternFill(fill_type="solid", fgColor=fill_color)
        # 미설치 항목은 별도 색상
        if cell.value == NOT_INSTALLED:
            cell.fill = PatternFill(fill_type="solid", fgColor=COLOR_NOT_INSTALLED)
```

## 출력 엑셀 예시

| IP | Hostname | OS | Kernel | Docker | Python | Nginx | NVIDIA | 수집시각 |
|----|----------|----|--------|--------|--------|-------|--------|---------|
| 10.167.128.10 | gpu-srv-01 | Rocky Linux 8.10 | 4.18.0-553 | 29.5.3 | 3.14.6 | 미설치 | 570.211 | 2026-07-03 09:00 |
| 10.167.128.11 | web-srv-01 | Rocky Linux 9.4 | 5.14.0-427 | 27.3.1 | 3.11.9 | 1.26.2 | 미설치 | 2026-07-03 09:00 |
| 10.167.128.12 | db-srv-01 | CentOS 8.5 | 4.18.0-348 | 미설치 | 3.6.8 | 미설치 | 미설치 | 2026-07-03 09:00 |

- 미설치 항목 → 연한 빨간 배경
- 접속 실패 서버 → 전체 행 빨간 배경
- 열 너비 → 내용에 맞게 자동 조절

## 사용 팁

### 전체 서버 현황 파악

매주 한 번 실행하면 서버 현황 파일이 자동으로 만들어진다. 소프트웨어 버전 불일치 서버를 빠르게 식별할 수 있다.

```bash
# 매주 월요일 아침 자동 실행 (cron 등록 예시)
0 8 * * 1 cd /opt/server_info && python collect_info.py --ip-list ip_list.txt
```

### 병렬 처리로 속도 향상

서버 수가 많을수록 병렬 처리 효과가 크다.

| 서버 수 | 순차 처리 | 병렬 10 |
|--------|----------|--------|
| 10대 | ~50초 | ~8초 |
| 50대 | ~4분 | ~35초 |
| 100대 | ~8분 | ~65초 |

## 포인트 정리

- 한 번 실행으로 전체 서버 현황 엑셀 자동 생성
- 미설치/접속실패 항목을 색상으로 즉시 시각화
- 병렬 처리로 수십 대도 1분 이내 처리 가능
- 폐쇄망 환경에서도 SSH만 되면 동작 (별도 에이전트 설치 불필요)
