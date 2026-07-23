---
title: "macOS launchd로 상시 실행 서비스 만들기"
description: "맥미니를 홈서버처럼 쓰기 위한 launchd 기초 — cron과의 차이, plist 구조, 디버깅"
updated: "2026-07-23"
tags: [macOS, launchd, 홈서버, 자동화]
---

## launchd란

macOS의 서비스 관리자. Linux의 systemd에 해당한다. "재부팅해도 자동으로 다시 뜨는 프로그램"을 만들려면 launchd에 등록해야 한다.

- **LaunchDaemon** (`/Library/LaunchDaemons`): 시스템 전역, 로그인 전에도 실행
- **LaunchAgent** (`~/Library/LaunchAgents`): 사용자 로그인 시 실행 — 개인 서버 용도는 대부분 이것

## cron과의 차이

macOS에도 cron이 있지만 launchd가 권장된다. 결정적 차이는 **잠자기 처리** — cron은 기기가 잠들어 있던 시간의 작업을 건너뛰지만, launchd(`StartCalendarInterval`)는 깨어났을 때 밀린 작업을 실행해준다.

## plist 기본 구조

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.example.myserver</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/me/app/server.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/myserver.log</string>
  <key>StandardErrorPath</key><string>/tmp/myserver.err</string>
</dict>
</plist>
```

- `RunAtLoad`: 로그인(로드) 시 즉시 실행
- `KeepAlive`: 죽으면 자동 재시작

## 등록/해제 명령

```bash
launchctl load ~/Library/LaunchAgents/com.example.myserver.plist    # 등록
launchctl unload ~/Library/LaunchAgents/com.example.myserver.plist  # 해제
launchctl list | grep myserver                                      # 확인
```

## 실전에서 겪는 함정

1. **PATH가 다르다** — launchd는 셸 초기화 파일을 읽지 않으므로 `nvm` 등 버전 매니저 경로의 실행 파일은 절대 경로로 지정해야 한다. nvm으로 Node 버전을 바꾸면 경로가 바뀌어 서비스가 깨진다.
2. **로그를 안 남기면 디버깅 불가** — `StandardOutPath`/`StandardErrorPath`는 반드시 지정하자.
3. **환경 변수** — 필요하면 `EnvironmentVariables` 키로 명시해야 한다.

> 많은 CLI 도구(OpenClaw 등)는 `install` 명령으로 plist 생성을 자동화해준다. 직접 쓸 일이 줄었지만, 깨졌을 때 고치려면 구조를 알아야 한다.
