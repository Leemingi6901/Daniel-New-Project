---
title: "폐쇄망 서버 Docker 자동 설치/업그레이드 스크립트 개발기"
description: "yum 저장소 없이 RPM 직접 전송 방식으로 폐쇄망 서버의 Docker를 자동 설치·업그레이드한 과정"
updated: "2026-06-19"
tags: [Python, Docker, RHEL, Automation, 폐쇄망]
---

폐쇄망 환경의 다수 서버에 Docker를 자동으로 설치하거나 최신 버전으로 업그레이드하는 스크립트 개발기. Docker CE는 yum 저장소 등록 후 설치하는 게 일반적이지만, 인터넷이 없는 환경에서는 RPM 파일을 직접 전송해서 설치해야 한다.

## 배경 및 요구사항

- **환경**: CentOS 8 / Rocky Linux / AlmaLinux, 폐쇄망
- **문제**: 서버마다 Docker 버전이 제각각이거나 아예 미설치 상태
- **목표**: 인터넷이 되는 PC에서 RPM을 받아 → SSH로 서버에 전송 → 자동 설치/업그레이드

**주요 기능**

- Docker 미설치 → 최신 버전 신규 설치 (systemd 서비스 자동 등록)
- 구버전 설치 → RPM 업그레이드
- `containerd.io` 포함 여부 선택 가능 (`--include-containerd`)
- `/etc/docker/daemon.json` 자동 생성 (log-driver, max-size 등)

## 파일 구조

```
Auto_Install/
├── download_rpms.py          # 인터넷 PC에서 RPM 다운로드 (Windows용)
├── download_rpms.sh          # 인터넷 PC에서 RPM 다운로드 (Linux/Mac용)
├── docker_update.py          # SSH 자동 설치 메인 스크립트
├── ip_list.txt               # 대상 서버 IP 목록
├── requirements.txt
└── rpms/                     # 다운로드된 RPM 파일들
    ├── docker-29.5.3.tgz                        ← Docker CE 바이너리
    ├── containerd.io-2.2.4-1.el8.x86_64.rpm
    ├── docker-buildx-plugin-0.34.1-1.el8.x86_64.rpm
    └── docker-compose-plugin-5.1.4-1.el8.x86_64.rpm
```

## Step 1 — RPM 다운로드

### Windows PC에서 (PowerShell 없이)

```bash
python download_rpms.py --output ./rpms
```

Docker 공식 저장소(`download.docker.com`)에서 최신 버전의 RPM을 자동으로 찾아서 다운로드한다.

### 다운로드 대상 패키지

| 패키지 | 역할 |
|--------|------|
| `docker-*.tgz` | Docker CE 바이너리 (메인) |
| `containerd.io` | 컨테이너 런타임 |
| `docker-buildx-plugin` | 멀티 아키텍처 빌드 |
| `docker-compose-plugin` | Compose V2 |

## Step 2 — SSH 자동 설치

```bash
# 기본 실행
python docker_update.py --ip-list ip_list.txt

# containerd 포함 설치
python docker_update.py --ip-list ip_list.txt --include-containerd

# 병렬 5대 동시 처리 + 로그 파일
python docker_update.py --ip-list ip_list.txt --parallel 5 --log-file result.log
```

### 설치 흐름

```
[1] SSH 접속
 ↓
[2] 현재 Docker 버전 확인
    → 최신이면 스킵 / 미설치·구버전이면 계속
 ↓
[3] RPM 파일 SFTP 전송 (/tmp/docker_rpms/)
 ↓
[4] rpm -Uvh 업그레이드 설치
 ↓
[5] /etc/docker/daemon.json 생성 (없는 경우)
 ↓
[6] 신규 설치 시: systemd 서비스 파일 등록
    → systemctl enable --now docker
 ↓
[7] docker version 검증
```

### 핵심 코드 — daemon.json 자동 생성

```python
DAEMON_JSON = {
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "3"
    },
    "storage-driver": "overlay2"
}

def write_daemon_json(ssh, sudo_pw):
    """daemon.json이 없는 경우에만 생성"""
    _, _, rc = run_cmd(ssh, "test -f /etc/docker/daemon.json", sudo_pw)
    if rc != 0:
        content = json.dumps(DAEMON_JSON, indent=2)
        run_cmd(ssh, f"mkdir -p /etc/docker", sudo_pw)
        run_cmd(ssh, f"echo '{content}' > /etc/docker/daemon.json", sudo_pw)
```

### 신규 설치 시 systemd 서비스 자동 등록

yum으로 설치하면 서비스 파일이 자동으로 들어오지만, RPM/tgz 직접 설치 방식에서는 수동으로 등록해야 한다.

```python
DOCKER_SERVICE = """
[Unit]
Description=Docker Application Container Engine
After=network-online.target firewalld.service containerd.service
Requires=docker.socket containerd.service

[Service]
Type=notify
ExecStart=/usr/bin/dockerd -H fd://
Restart=always

[Install]
WantedBy=multi-user.target
"""

def register_systemd(ssh, sudo_pw):
    run_cmd(ssh, f"echo '{DOCKER_SERVICE}' > /etc/systemd/system/docker.service", sudo_pw)
    run_cmd(ssh, "systemctl daemon-reload", sudo_pw)
    run_cmd(ssh, "systemctl enable --now docker", sudo_pw)
```

## 실행 결과 예시

```
[10.167.128.10] Docker 20.10.9 감지 → 29.5.3 업그레이드 시작
[10.167.128.10] RPM 전송 중... containerd.io (35.1 MB)
[10.167.128.10] RPM 전송 중... docker-buildx-plugin (11.2 MB)
[10.167.128.10] rpm -Uvh 업그레이드 설치 완료 ✓
[10.167.128.10] daemon.json 생성 완료 ✓
[10.167.128.10] ✅ 완료: Docker 29.5.3

[10.167.128.11] Docker 미설치 → 신규 설치 시작
[10.167.128.11] systemd 서비스 등록 완료 ✓
[10.167.128.11] ✅ 완료: Docker 29.5.3
```

## 트러블슈팅

### rpm 충돌 오류

**증상**: `file /usr/bin/docker from install of docker conflicts with file from package docker-ce`

**해결**: 기존 Docker 패키지를 먼저 제거 후 재설치

```python
run_cmd(ssh, "rpm -e --nodeps docker docker-ce docker-ce-cli 2>/dev/null", sudo_pw)
run_cmd(ssh, f"rpm -Uvh {rpm_dir}/*.rpm", sudo_pw)
```

### docker.sock 권한 오류

**증상**: 일반 유저로 `docker ps` 시 Permission denied

**해결**: docker 그룹에 자동 추가

```python
run_cmd(ssh, "usermod -aG docker dtsec", sudo_pw)
```

## 포인트 정리

- `rpm -Uvh` 방식으로 yum 저장소 없이 설치/업그레이드 가능
- `--include-containerd` 옵션으로 런타임 포함 여부 선택
- 신규 설치 시 systemd 서비스 파일 자동 등록
- `daemon.json` 자동 생성으로 로그 용량 관리 기본 설정
- 병렬 처리로 다수 서버 동시 업그레이드 지원
