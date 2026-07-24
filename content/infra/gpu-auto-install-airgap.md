---
title: "폐쇄망 GPU 서버 NVIDIA 드라이버 자동 설치 스크립트 개발기"
description: "RHEL 9 폐쇄망 환경에 파이썬으로 NVIDIA 드라이버·CUDA를 자동 설치한 과정과 EL9 gcc/glibc-devel 트러블슈팅 기록"
updated: "2026-07-24"
tags: [Python, RHEL, NVIDIA, GPU, 폐쇄망, Automation, Grafana]
---

폐쇄망(Air-Gapped) 환경의 RHEL 9.x 서버에 NVIDIA GPU 드라이버와 CUDA Toolkit을 파이썬으로 자동 설치하는 스크립트를 만든 과정 기록. 단순한 설치 스크립트처럼 보이지만 폐쇄망이라는 제약 때문에 삽질이 많았고, 특히 EL9에서 gcc 관련 이슈가 까다로웠다.

## 프로젝트 배경

운영 환경:

- **서버 OS**: RHEL 9.6 (Rocky Linux 호환)
- **GPU**: NVIDIA A100
- **환경**: 폐쇄망 (외부 인터넷 완전 차단)
- **대상**: 다수의 GPU 서버를 한 번에 자동 처리

기존에는 각 서버에 직접 SSH 접속 → 드라이버 파일 복사 → 수동 설치 방식이었는데, 서버 수가 늘어나면서 자동화가 필요해졌다.

**핵심 요구사항**

1. 윈도우 PC에서 인터넷으로 필요한 파일을 미리 다운로드
2. 해당 파일을 SSH로 폐쇄망 서버에 전송
3. 서버에서 자동으로 설치 진행
4. 설치 결과를 로그로 남기기

## 전체 프로젝트 구조

```
파이썬 자동화/
├── gpu_install/
│   ├── download_gpu.py        # EL8용 전체 다운로드 (NVIDIA + RPM)
│   ├── download_gpu_el9.py    # EL9용 전체 다운로드 (NVIDIA + RPM)
│   ├── download_gcc_el9.py    # EL9용 gcc/cpp RPM만 별도 다운로드
│   ├── gpu_install10.py       # SSH 자동 설치 메인 스크립트
│   ├── ip_list.txt            # 대상 서버 IP 목록
│   └── requirements.txt       # 파이썬 의존성
├── grafana_install/
│   ├── download_grafana.py    # Grafana 스택 다운로드
│   ├── grafana_install.py     # Grafana/Prometheus 자동 설치
│   └── report_generator.py    # GPU 사용률 일간 리포트 생성
└── docker_update1.py          # Docker 버전 자동 업데이트
```

## Step 1 — 인터넷 PC에서 파일 다운로드

폐쇄망이기 때문에 인터넷이 되는 윈도우 PC에서 먼저 필요한 파일을 전부 받아놔야 한다.

### NVIDIA 드라이버 + CUDA + 빌드 도구 다운로드

```python
# download_gpu_el9.py 핵심 구조
PACKAGES = [
    # NVIDIA 드라이버 (.run 파일)
    (NVIDIA_URL, r"NVIDIA-Linux-x86_64-\d+", "NVIDIA 드라이버"),
    # CUDA Toolkit
    (CUDA_URL,   r"cuda_\d+",                "CUDA Toolkit"),
    # EL9 빌드 도구 (AppStream에서)
    (ROCKY9_APPSTREAM, "g/", r"gcc-\d",  "gcc"),
    (ROCKY9_APPSTREAM, "c/", r"cpp-\d",  "cpp"),
]
```

> **EL9 함정 포인트**: EL9에서 `gcc`와 `cpp`는 BaseOS가 아닌 **AppStream**에 있다. URL 경로도 `https://dl.rockylinux.org/pub/rocky/9/AppStream/x86_64/os/Packages/` 로 잡아야 한다.

또 하나의 함정: Rocky Linux 저장소는 `href` 속성에 절대 URL을 반환한다.

```python
# 잘못된 파싱 — 전체 URL에 re.match 적용
re.match(r"gcc-\d", "https://dl.rockylinux.org/.../gcc-11.5.0-14.el9.x86_64.rpm")
# → 항상 None (match는 문자열 처음부터 비교)

# 올바른 파싱 — basename만 추출 후 비교
basename = lnk.split("/")[-1]   # "gcc-11.5.0-14.el9.x86_64.rpm"
re.match(r"gcc-\d", basename)   # → 매칭 성공
```

### gcc/cpp 직접 다운로드 링크 (확인된 버전)

| 패키지 | 직접 다운로드 URL |
|--------|-----------------|
| `cpp-11.5.0-14.el9.x86_64.rpm` | Rocky AppStream/c/ |
| `gcc-11.5.0-14.el9.x86_64.rpm` | Rocky AppStream/g/ |

> **glibc-devel 주의**: `glibc-devel`은 Rocky Linux, Oracle Linux, AlmaLinux 어디에도 공개 저장소에 없다. RHEL 구독 전용 채널에서만 제공된다. RHEL 설치 ISO에서 추출하거나 `rpm -q glibc-devel`로 기설치 여부를 먼저 확인해야 한다.

## Step 2 — SSH 자동 설치 (gpu_install10.py)

### 실행 방법

```bash
pip install paramiko tqdm
python gpu_install10.py --ip-list ip_list.txt --gpu-files-el9 ./gpu_files_el9
```

### ip_list.txt 형식

```
10.167.128.218
10.167.128.219
10.167.128.220
```

### 설치 흐름

```
[1] OS 버전 감지 (EL8 / EL9 분기)
 ↓
[2] GPU 파일 SSH 전송 (/tmp/gpu_install_files/)
 ↓
[3] cpp → gcc RPM 우선 설치 (--nodeps --force)
 ↓
[4] glibc-devel RPM 설치 (있는 경우)
 ↓
[5] /usr/include/features.h 존재 확인
 ↓
[6] NVIDIA .run 실행 (--silent --dkms)
 ↓
[7] nvidia-smi 검증
 ↓
[8] CUDA Toolkit 설치
 ↓
[9] 결과 로그 저장
```

### EL9 핵심 코드 — yum 없이 RPM 직접 설치

EL9 폐쇄망에서는 yum/dnf가 저장소에 접근 불가이므로 `rpm -Uvh` 방식을 쓴다.

```python
def install_dep_rpms(ssh, sudo_pw, result, remote_dir):
    for _glob, _desc, _extra_check in [
        (f"{remote_dir}/cpp-[0-9]*.rpm",    "cpp",        None),
        (f"{remote_dir}/gcc-[0-9]*.rpm",    "gcc",        None),
        (f"{remote_dir}/glibc-devel-*.rpm", "glibc-devel",
         "test -f /usr/include/features.h && grep -q '__GLIBC__' /usr/include/features.h"),
    ]:
        ls_out, _, _ = run_cmd(ssh, f"ls {_glob} 2>/dev/null | head -3", sudo_pw)
        if ls_out.strip():
            result.add_log(f"{_desc} RPM 발견 → 설치 중...")
            inst_out, _, inst_rc = run_cmd(
                ssh,
                f"rpm -Uvh --nodeps --force {_glob} 2>&1 | tail -5",
                sudo_pw, timeout=60
            )
            if inst_rc == 0 or "already installed" in inst_out.lower():
                result.add_log(f"{_desc} 설치 완료 ✓")
        else:
            result.add_warn(f"{_desc} RPM 미발견 — 건너뜀")
```

### EL8 vs EL9 분기 처리

```python
def install_build_tools_yum(ssh, sudo_pw, result, os_major=8):
    if os_major >= 9:
        # EL9: yum/dnf 사용 안 함 → RPM 직접 설치 방식
        result.add_log("EL9: gcc/glibc-devel → RPM 직접 설치 (install_dep_rpms에서 처리)")
        # make, perl 등 기본 도구만 yum으로 설치 (저장소 불필요한 경우)
        for tool in ["make", "perl"]:
            _, _, rc = run_cmd(ssh, f"which {tool} 2>/dev/null", sudo_pw, timeout=10)
            if rc != 0:
                run_cmd(ssh, f"yum install -y {tool}", sudo_pw, timeout=120)
    else:
        # EL8: 기존 yum 방식
        run_cmd(ssh, "yum install -y gcc gcc-c++ make kernel-devel kernel-headers",
                sudo_pw, timeout=300)
```

## Step 3 — Grafana 모니터링 자동화

GPU 드라이버 설치 후, 각 서버의 GPU 사용률·VRAM·온도를 Grafana로 시각화하는 것까지 자동화했다.

### 구성 스택

```
[GPU 서버] → DCGM Exporter (GPU 메트릭)
           → Node Exporter (시스템 메트릭)
             ↓
         [Prometheus] ← 수집
             ↓
          [Grafana] ← 대시보드 시각화
             ↓
      [report_generator.py] ← 일간 리포트 자동 생성
```

### 다운로드 자동화 (download_grafana.py)

```bash
python download_grafana.py --output ./grafana_files
```

- Grafana OSS RPM
- Prometheus 바이너리 (tar.gz)
- Node Exporter 바이너리
- DCGM Exporter (Docker 이미지 tar)

### 일간 리포트 자동 생성 (report_generator.py)

Prometheus HTTP API를 통해 전날 GPU 사용률 데이터를 수집해 HTML 리포트로 자동 생성한다.

```python
# GPU 평균 사용률 (전날 00:00 ~ 23:59)
query = f'avg_over_time(DCGM_FI_DEV_GPU_UTIL{{instance=~"{ip}:.*"}}[1d])'

# VRAM 일자별 최대 사용량
query_vram = f'max_over_time(DCGM_FI_DEV_FB_USED{{instance=~"{ip}:.*"}}[1d])'
```

> **avg_over_time 함정**: 처음에 `avg(DCGM_FI_DEV_GPU_UTIL)`을 썼더니 항상 0%가 나왔다. `avg_over_time(...[1d])`로 바꾸니 정상적으로 집계됐다. Prometheus 쿼리에서 시간 범위 지정은 필수.

## 트러블슈팅 모음

### 1. NVIDIA .run 인스톨러 — libc header files not found

**증상**: `.run` 설치 시 "Unable to find the development sources for your running kernel" 또는 "libc header files" 오류

**원인**: EL9에서 `gcc`는 있어도 `glibc-devel`이 없으면 `/usr/include/features.h`가 없어 컴파일 불가

**해결 순서**:

```bash
# 1) 기설치 확인
rpm -q glibc-devel
ls /usr/include/features.h

# 2) RHEL ISO에서 추출
mount -o loop rhel-9.6-x86_64-dvd.iso /mnt/iso
find /mnt/iso -name 'glibc-devel*.rpm'
cp /mnt/iso/.../glibc-devel-*.rpm /tmp/gpu_install_files/
rpm -Uvh --nodeps --force glibc-devel-*.rpm

# 3) 인터넷 되는 동일 버전 서버에서 복사
dnf download glibc-devel --downloaddir=/tmp/
```

### 2. 파이썬 파일에 null bytes 삽입 오류

**증상**: `py_compile` 실행 시 `source code string cannot contain null bytes`

**원인**: 파일 끝에 1,080개의 null byte(`\x00`)가 삽입된 상태

**해결**:

```python
path = "gpu_install10.py"
data = open(path, 'rb').read().rstrip(b'\x00')
open(path, 'wb').write(data)
```

### 3. Rocky Linux href 절대 URL 파싱 실패

**증상**: `download_gcc_el9.py` 실행 시 모든 패키지에서 `[WARN] 패키지 없음` 출력

**원인**: Rocky Linux 저장소가 `href`에 전체 URL을 반환하는데 `re.match`로 파일명 매칭 시도

**해결**: `basename = lnk.split("/")[-1]`로 파일명만 추출 후 패턴 매칭

### 4. EL9 gcc가 BaseOS에 없음

**증상**: BaseOS/g/ 디렉토리를 긁어도 gcc RPM이 없음

**원인**: EL9부터 gcc는 AppStream 채널로 이동

**해결**: 저장소 URL을 AppStream으로 변경

```python
# BaseOS (X)
ROCKY9_BASEOS = "https://dl.rockylinux.org/pub/rocky/9/BaseOS/x86_64/os/Packages/"

# AppStream (O)
ROCKY9_APPSTREAM = "https://dl.rockylinux.org/pub/rocky/9/AppStream/x86_64/os/Packages/"
```

## 실행 순서 요약

**인터넷 PC에서**

```bash
# 1. EL9용 파일 전체 다운로드
python download_gpu_el9.py --output ./gpu_files_el9

# 2. gcc/cpp만 별도 다운로드 (glibc-devel은 ISO에서 별도 확보)
python download_gcc_el9.py --output ./gpu_files_el9
```

**폐쇄망 서버 일괄 설치**

```bash
# ip_list.txt에 대상 서버 IP 나열 후 실행
python gpu_install10.py \
  --ip-list ip_list.txt \
  --gpu-files-el9 ./gpu_files_el9 \
  --ssh-port 18122 \
  --ssh-user dtsec
```

설치 결과는 `result_YYYYMMDD_HHMMSS.log` 파일로 자동 저장된다.

## 배운 점

1. **폐쇄망 = 패키지 관리자 무력화**: yum/dnf를 쓰지 못하니 `rpm -Uvh --nodeps --force`가 핵심 우회 방법
2. **EL8 → EL9 마이그레이션 주의점**: gcc 위치가 BaseOS → AppStream으로 이동, glibc-devel은 공개 미러에서 사라짐
3. **HTML 파싱의 함정**: 저장소 페이지의 href 형식이 언제든 바뀔 수 있으므로 절대 URL 대응 필수
4. **Prometheus 쿼리**: `avg()`와 `avg_over_time()`은 전혀 다른 결과 — 시계열 집계 시 반드시 시간 범위 지정
