---
title: "폐쇄망 서버 Python 자동 설치/업그레이드 스크립트 개발기"
description: "내부 Nexus PyPI 저장소와 연동해 폐쇄망 서버의 Python을 자동 설치·업그레이드하는 스크립트 개발 기록"
updated: "2026-06-08"
tags: [Python, RHEL, Automation, 폐쇄망, Nexus]
---

폐쇄망(Air-Gapped) 환경의 다수 서버에 Python을 자동으로 설치하거나 업그레이드하는 스크립트 개발기. 단순히 `yum install python3`로 끝나면 좋겠지만, 폐쇄망 + 내부 Nexus 저장소 환경이라 신경 쓸 부분이 많았다.

## 배경 및 요구사항

- **환경**: CentOS 8 / Rocky Linux 8, 폐쇄망
- **문제**: 기본 Python 버전이 너무 낮거나 미설치 상태인 서버가 다수
- **제약**: 인터넷 차단 → PyPI 직접 접근 불가, 내부 Nexus PyPI 저장소 활용

**자동화 요구사항**

- Python 미설치 → 최신 버전 신규 설치
- 구버전 설치 → 최신 버전으로 교체
- 이미 최신 → 스킵 (단, `--force` 시 재설치)
- 설치 후 심볼릭 링크 자동 설정

## 파일 구조

```
python_install/
├── download_python.py      # 인터넷 PC에서 Python 바이너리 다운로드
├── python_install.py       # SSH 자동 설치 메인 스크립트
├── ip_list.txt             # 대상 서버 IP 목록
├── requirements.txt        # paramiko 등 의존성
└── python_files/           # 다운로드된 설치 파일들
    ├── cpython-3.14.6-x86_64-unknown-linux-gnu-install_only.tar.gz
    ├── bzip2-libs-*.el8.x86_64.rpm
    ├── libffi-*.el8.x86_64.rpm
    ├── readline-*.el8.x86_64.rpm
    └── zlib-*.el8.x86_64.rpm
```

## Step 1 — 인터넷 PC에서 파일 다운로드

```bash
python download_python.py --output ./python_files
```

Python 공식 빌드 아카이브에서 **install_only** 버전을 받는다. 소스 컴파일 없이 바이너리를 직접 배포하는 방식이라 빠르고 안정적이다.

Python 실행에 필요한 의존성 RPM도 함께 다운로드한다.

| 패키지 | 역할 |
|--------|------|
| `bzip2-libs` | .bz2 압축 처리 |
| `libffi` | C 언어 인터페이스 |
| `readline` | 터미널 입력 처리 |
| `xz-libs` | .xz 압축 처리 |
| `zlib` | 압축 라이브러리 |

## Step 2 — SSH 자동 설치

```bash
# 기본 실행
python python_install.py --ip-list ip_list.txt

# 병렬 5대 동시 처리
python python_install.py --ip-list ip_list.txt --parallel 5

# 버전 같아도 강제 재설치
python python_install.py --ip-list ip_list.txt --force
```

### 설치 흐름

```
[1] SSH 접속 (포트 18122)
 ↓
[2] 현재 Python 버전 확인
    → 최신이면 스킵 / 구버전이면 계속
 ↓
[3] 의존성 RPM SFTP 전송 → rpm -Uvh 설치
 ↓
[4] Python tar.gz SFTP 전송
 ↓
[5] /opt/python{X.Y.Z}/ 에 압축 해제
 ↓
[6] 심볼릭 링크 설정
    /usr/local/bin/python3   → /opt/python3.14.6/bin/python3
    /usr/local/bin/pip3      → /opt/python3.14.6/bin/pip3
 ↓
[7] Nexus PyPI 설정 (pip.conf)
 ↓
[8] 버전 검증 및 로그 저장
```

### 핵심 코드 — 버전 비교 및 설치 분기

```python
def check_python_version(ssh, sudo_pw):
    """현재 설치된 Python 버전 반환 (없으면 None)"""
    out, _, rc = run_cmd(ssh, "python3 --version 2>&1", sudo_pw)
    if rc != 0:
        return None
    # "Python 3.9.18" → (3, 9, 18)
    m = re.search(r"Python (\d+)\.(\d+)\.(\d+)", out)
    return tuple(map(int, m.groups())) if m else None

def needs_install(current, target):
    """설치 필요 여부 판단"""
    if current is None:
        return True, "미설치"
    if current < target:
        return True, f"{'.'.join(map(str, current))} → {'.'.join(map(str, target))} 업그레이드"
    return False, f"{'.'.join(map(str, current))} 최신 (스킵)"
```

### Nexus 내부 PyPI 설정

폐쇄망에서 pip를 쓰려면 내부 Nexus 저장소를 바라보도록 `pip.conf`를 자동으로 작성한다.

```python
NEXUS_IP = "10.167.32.241"

PIP_CONF_CONTENT = f"""
[global]
index-url = http://{NEXUS_IP}/repository/pypi/simple
index = http://{NEXUS_IP}/repository/pypi/pypi
trusted-host = {NEXUS_IP}
"""

# /etc/pip.conf 에 자동 작성
run_cmd(ssh, f"echo '{PIP_CONF_CONTENT}' > /etc/pip.conf", sudo_pw)
```

## 실행 결과 예시

```
[10.167.128.10] Python 3.9.18 감지 → 3.14.6 업그레이드 시작
[10.167.128.10] 의존성 RPM 설치 완료 ✓
[10.167.128.10] Python 3.14.6 전송 중... (38.2 MB)
[10.167.128.10] 압축 해제 및 설치 완료 ✓
[10.167.128.10] 심볼릭 링크 설정 완료 ✓
[10.167.128.10] pip.conf (Nexus) 설정 완료 ✓
[10.167.128.10] ✅ 완료: Python 3.14.6

[10.167.128.11] Python 3.14.6 이미 최신 → 스킵
```

## 포인트 정리

- **바이너리 배포 방식** 채택 → 소스 컴파일 없이 빠른 설치
- **의존성 RPM을 함께 전송** → 폐쇄망에서도 안정적
- **병렬 처리** 지원 → 수십 대 서버를 동시에 처리
- **Nexus pip.conf 자동 설정** → 설치 직후 pip 바로 사용 가능
- 설치 결과는 타임스탬프 로그 파일로 자동 저장
