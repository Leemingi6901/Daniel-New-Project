---
title: "폐쇄망 서버 Nginx 자동 설치/업그레이드 스크립트 개발기"
description: "EL8/EL9를 자동 감지해 알맞은 RPM을 선택하고, 설정 검증 후 안전하게 재시작하는 Nginx 자동화 스크립트"
updated: "2026-06-27"
tags: [Python, Nginx, RHEL, Automation, 폐쇄망]
---

폐쇄망 환경에서 다수 서버의 Nginx를 자동으로 설치하거나 최신 버전으로 업그레이드하는 스크립트 개발기. GPU 드라이버, Docker에 이어 같은 패턴으로 자동화했다. 다만 Nginx는 EL8/EL9 버전을 자동 감지해서 알맞은 RPM을 선택하는 부분이 추가된다.

## 배경 및 요구사항

- **환경**: Rocky Linux 8/9, RHEL 8/9, AlmaLinux 8/9 (혼재)
- **문제**: 서버마다 Nginx 버전이 다르고, 보안 패치가 적용된 최신 버전 유지 필요
- **최소 버전**: 1.29.7 (이 버전 이상이면 스킵)

**주요 기능**

- EL8 / EL9 자동 감지 → 맞는 RPM 자동 선택
- 설치 전 `/etc/nginx/` 백업 (타임스탬프 포함)
- `nginx -t` 설정 검증 후 재시작
- `--skip-restart` 옵션: 설치만 하고 재시작 안 함

## 파일 구조

```
nginx_install/
├── download_nginx.py          # 인터넷 PC에서 RPM 다운로드
├── nginx_install.py           # SSH 자동 설치 메인 스크립트
├── nginx_files/               # EL8용 RPM
│   └── nginx-1.31.3-1.el8.ngx.x86_64.rpm
└── nginx_files_el9/           # EL9용 RPM
    └── nginx-1.31.3-1.el9.ngx.x86_64.rpm
```

## Step 1 — RPM 다운로드

```bash
python download_nginx.py --output-el8 ./nginx_files --output-el9 ./nginx_files_el9
```

Nginx 공식 저장소(`nginx.org/packages/`)에서 최신 안정화 버전 RPM을 자동으로 찾아 다운로드한다.

| 파일 | 대상 OS |
|------|--------|
| `nginx-*.el8.ngx.x86_64.rpm` | CentOS 8, Rocky Linux 8, RHEL 8 |
| `nginx-*.el9.ngx.x86_64.rpm` | Rocky Linux 9, RHEL 9, AlmaLinux 9 |

## Step 2 — SSH 자동 설치

```bash
# 기본 실행 (EL8/EL9 자동 감지)
python nginx_install.py --ip-list ip_list.txt

# EL9 파일 경로 명시
python nginx_install.py --ip-list ip_list.txt \
  --nginx-files ./nginx_files \
  --nginx-files-el9 ./nginx_files_el9

# 버전 같아도 강제 재설치
python nginx_install.py --ip-list ip_list.txt --force

# 설치만 하고 재시작 안 함 (점검 시간 외 적용)
python nginx_install.py --ip-list ip_list.txt --skip-restart

# 병렬 3대 동시
python nginx_install.py --ip-list ip_list.txt --parallel 3
```

### 설치 흐름

```
[1] SSH 접속
 ↓
[2] OS 버전 감지 (EL8 / EL9 분기)
 ↓
[3] 현재 Nginx 버전 확인
    → 최소 버전(1.29.7) 이상이면 스킵
 ↓
[4] /etc/nginx/ 백업
    → /etc/nginx.bak_20260627_090000/
 ↓
[5] RPM 파일 SFTP 전송
 ↓
[6] rpm -Uvh 업그레이드 설치
 ↓
[7] nginx -t 설정 파일 검증
 ↓
[8] systemctl restart nginx (--skip-restart 없는 경우)
 ↓
[9] nginx -v 버전 확인
```

## 핵심 코드

### OS 버전 감지 및 RPM 선택

```python
def detect_os_major(ssh, sudo_pw) -> int:
    """OS 메이저 버전 반환 (8 또는 9)"""
    out, _, _ = run_cmd(ssh, "cat /etc/os-release")
    m = re.search(r'VERSION_ID="?(\d+)', out)
    return int(m.group(1)) if m else 8

def select_nginx_files(os_major: int, args) -> Path:
    """OS 버전에 맞는 nginx_files 디렉토리 반환"""
    if os_major >= 9 and args.nginx_files_el9:
        return Path(args.nginx_files_el9)
    return Path(args.nginx_files)
```

### 설정 백업

```python
def backup_nginx_config(ssh, sudo_pw, result):
    """기존 /etc/nginx/ 를 타임스탬프 붙여 백업"""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"/etc/nginx.bak_{ts}"
    _, _, rc = run_cmd(ssh, "test -d /etc/nginx", sudo_pw)
    if rc == 0:
        run_cmd(ssh, f"cp -r /etc/nginx {backup_path}", sudo_pw)
        result.add_log(f"Nginx 설정 백업 완료: {backup_path}")
```

### 설정 검증 후 재시작

```python
def validate_and_restart(ssh, sudo_pw, result, skip_restart=False):
    """nginx -t 통과 시에만 재시작"""
    out, _, rc = run_cmd(ssh, "nginx -t 2>&1", sudo_pw)
    if rc != 0:
        result.add_error(f"nginx -t 실패! 재시작 건너뜀:\n{out}")
        return False

    result.add_log("nginx -t 통과 ✓")
    if not skip_restart:
        run_cmd(ssh, "systemctl restart nginx", sudo_pw)
        result.add_log("nginx 재시작 완료 ✓")
    else:
        result.add_log("--skip-restart: 재시작 생략")
    return True
```

## 실행 결과 예시

```
[10.167.128.10] OS: Rocky Linux 9.4 (EL9) → nginx_files_el9 사용
[10.167.128.10] 현재 Nginx: 1.24.0 → 1.31.3 업그레이드
[10.167.128.10] 설정 백업 → /etc/nginx.bak_20260627_090132
[10.167.128.10] RPM 전송 중... nginx-1.31.3-1.el9.ngx.x86_64.rpm (1.8 MB)
[10.167.128.10] rpm -Uvh 완료 ✓
[10.167.128.10] nginx -t 통과 ✓
[10.167.128.10] nginx 재시작 완료 ✓
[10.167.128.10] ✅ 완료: nginx/1.31.3

[10.167.128.11] OS: Rocky Linux 8.10 (EL8) → nginx_files 사용
[10.167.128.11] 현재 Nginx: 1.31.3 → 최소 버전 충족 → 스킵
```

## 트러블슈팅

### EL8과 EL9 RPM 혼용 오류

**증상**: EL9 서버에 EL8 RPM을 올리면 의존성 오류 또는 설치 실패

**해결**: OS 버전을 먼저 감지하고 그에 맞는 RPM 디렉토리 선택

```python
os_major = detect_os_major(ssh, sudo_pw)
nginx_dir = select_nginx_files(os_major, args)
```

### nginx 재시작 실패 (설정 오류)

**증상**: 업그레이드 후 설정 문법이 달라져 재시작 실패

**해결**: `nginx -t`로 검증 먼저 → 실패 시 재시작 건너뛰고 경고 출력 → 운영자가 수동으로 설정 수정 후 재시작하도록 안내

## 포인트 정리

- EL8 / EL9 자동 감지 → 서버 OS에 맞는 RPM 자동 선택
- 설정 파일 자동 백업 → 문제 발생 시 즉시 롤백 가능
- `nginx -t` 검증 → 잘못된 설정으로 서비스 중단 방지
- `--skip-restart` → 점검 시간에 맞춰 재시작 타이밍 조절 가능
- 병렬 처리 → 다수 서버 동시 업그레이드로 작업 시간 단축
