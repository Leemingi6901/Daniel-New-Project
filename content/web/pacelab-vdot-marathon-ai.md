---
title: "PaceLab — VDOT 기반 마라톤 훈련 AI 분석 사이트 만들기"
description: "러닝 기록과 인바디 데이터로 VDOT을 추정하고 대회 예상 기록·구간 페이스를 예측하는 개인 프로젝트 개발기"
updated: "2026-07-27"
tags: [Next.js, TypeScript, Vercel-Blob, VDOT, 마라톤]
---

개인 러닝 기록과 인바디 데이터를 넣으면 현재 체력(VDOT)을 추정하고, 다음 대회의 예상 PB와 구간(스플릿) 기록까지 예측해주는 개인용 사이트 **PaceLab**을 만든 과정. [pacelab-korea97.vercel.app](https://pacelab-korea97.vercel.app)에 배포되어 실제로 매일 훈련 기록을 넣으며 쓰고 있다.

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Vercel Blob** — 별도 DB 없이 JSON 파일 하나로 전체 데이터(대회 기록/인바디/훈련 로그/예정 대회) 저장
- **Vercel** 배포, GitHub 소스 관리

DB 없이 Blob에 JSON 하나를 두는 구조로 잡은 이유는 단순하다. 혼자 쓰는 데이터라 스키마 마이그레이션을 신경 쓸 필요 없이, 객체 하나 읽고 쓰는 걸로 충분했다.

## VDOT 예측 엔진

Jack Daniels의 VDOT 공식으로 기록(거리·시간)을 체력 지표 하나로 환산한다.

```ts
export function vdotFromRace(distanceM: number, timeMin: number): number {
  const v = distanceM / timeMin; // m/min
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pctMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMin) + 0.2989558 * Math.exp(-0.1932605 * timeMin);
  return vo2 / pctMax;
}
```

여러 대회 기록이 쌓이면 어떤 걸 기준으로 삼을지가 문제라, 두 가지를 반영했다.

- **최신성 가중** — 최근 대회일수록 가중치를 높게, 6개월을 반감기로 지수적으로 낮춤
- **체중 보정** — 상대 VO2max는 체중에 반비례하므로 `기록 당시 체중 / 현재 체중` 비율을 곱해 보정 (±5% 캡)

```ts
const w = Math.pow(0.5, Math.max(0, ageDays) / 180);
const factor = Math.min(1.05, Math.max(0.95, baseWeight / latestWeight));
```

이렇게 나온 `weightAdjustedVdot` 하나로 5K/10K/하프/풀코스 예상 기록을 전부 역산한다. VDOT → 기록은 역함수가 없어서 이분 탐색으로 풀었다.

## 구간(스플릿) 예측 — 고도까지 반영

대회 코스를 5km 단위로 쪼개 구간별 예상 페이스를 보여준다. 균등 페이스가 아니라 두 가지를 보정한다.

- **후반 감속 드리프트** — 후반부로 갈수록 최대 +4%까지 선형적으로 느려진다고 가정
- **고도 보정** — 상승 10m당 +9초, 하강 10m당 −4초

```ts
const drift = 1 + 0.04 * (mid / upcoming.distanceKm);
const elevAdj = (s.elevGain / 10) * 9 + (s.elevLoss / 10) * 4;
const segmentSec = basePace * len * drift + elevAdj;
```

같은 계수를 반대로 적용하면 훈련 기록의 "고도 보정 페이스(GAP)"도 구할 수 있어, 업/다운힐 훈련도 평지 환산 페이스로 강도를 분류하는 데 재사용했다.

## 트레드밀 보정

벨트가 다리를 끌어주고 공기저항도 없어 같은 페이스라도 실외보다 체감 강도가 낮다. 실측 비교(실내 30분/6'00" 페이스 ≈ 실외 33분/6'36" 페이스 강도)를 기준으로 **+10% 시간 보정**을 적용해 트레드밀 기록도 실외 환산 강도로 분류되게 했다.

## 데이터 저장 — Blob 캐시 일관성 버그

처음엔 고정 경로(`pacelab/data.json`)에 매번 덮어쓰는 방식으로 짰는데, 저장 직후 새로고침해도 방금 넣은 기록이 안 보이는 증상이 있었다. 원인은 Vercel Blob의 CDN 엣지 캐시가 **경로를 키로 캐싱**하기 때문에, 같은 경로를 덮어써도 캐시가 짧게는 수십 초간 이전 내용을 반환하는 것이었다.

해결책은 저장할 때마다 **타임스탬프를 붙인 새 경로**에 쓰고, 읽을 때는 그중 최신 버전을 찾아 읽는 것. 새 경로는 캐시된 적이 없으니 즉시 최신 내용을 반환한다. `list()`는 CDN이 아니라 Blob 제어 평면 API라 강한 일관성을 갖는다는 점을 이용했고, 오래된 버전은 저장할 때마다 최근 3개만 남기고 정리한다.

```ts
export async function saveData(data: PaceLabData): Promise<void> {
  const version = Date.now();
  await put(`${BLOB_PREFIX}${version}.json`, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
  });
  // 최근 3개만 남기고 나머지 삭제
}
```

## 인증 없이 공개 사이트에 데이터 입력하기

로그인 시스템 대신 `/admin` 페이지에서 **인증번호(PIN) 하나**로 입력을 막는 방식을 택했다. 대신 두 가지는 챙겼다.

- 문자열 비교를 `timingSafeEqual`로 구현해 타이밍 공격 여지를 줄임
- 검증마다 400ms 지연을 둬 무차별 대입을 조금이라도 늦춤

```ts
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

읽기(GET)는 인증 없이 누구나 볼 수 있게 열어뒀고, 쓰기(POST/PUT/DELETE)만 PIN을 요구한다.

## 그 외 붙인 기능들

- **다음 훈련 추천** — 최근 4주 평균 주행량 대비 이번 주 과부하 여부, 마지막 고강도(템포/인터벌/레페티션) 훈련 이후 경과일을 종합해 회복/템포/인터벌 중 지금 시점에 맞는 걸 추천
- **월간 마일리지 캘린더** — 대회+훈련을 날짜 기준으로 합산해 달력에 표시
- **글로벌 러너 티어** — 마라톤 완주 기록의 대략적인 퍼센타일 벤치마크를 VDOT로 환산해 챌린저~언랭크 7단계 배지로 표시

## 트러블슈팅 — 회사 네트워크의 SSL 인터셉션

집에서 만들던 걸 회사 PC로 옮겨 이어서 작업하려고 `git clone` + `.env.local`에 Vercel Blob 토큰까지 넣었는데, 로컬에서만 계속 "데이터 없음"으로 떴다. `@vercel/blob`의 `list()`는 성공하는데 실제 JSON을 다운로드하는 `fetch()`만 `SELF_SIGNED_CERT_IN_CHAIN` 에러로 조용히 실패하고 있었다.

원인은 회사 네트워크가 보안(DLP) 목적으로 모든 HTTPS 트래픽을 자체 인증서로 가로채고 있었기 때문. Windows는 IT가 그 루트 인증서를 이미 신뢰하도록 설치해뒀지만, **Node.js는 Windows 인증서 저장소를 안 쓰고 자체 CA 목록만 신뢰**해서 벌어진 문제였다. 루트 인증서를 `.pem`으로 추출해 `NODE_EXTRA_CA_CERTS` 환경변수로 알려주니 바로 해결됐다.

```
NODE_EXTRA_CA_CERTS=D:\PaceLab\corporate-ca.pem
```

같은 코드가 환경마다 다르게 실패할 수 있고, `catch`로 에러를 조용히 삼키면 원인 찾기가 몇 배로 힘들어진다는 걸 다시 확인한 하루였다.

## 마무리

VDOT 하나로 시작해서 체중 보정·고도 보정·트레드밀 보정까지 붙이고 나니 실제로 쓸 만한 개인 훈련 대시보드가 됐다. 다음엔 실제 코스 고도 데이터(GPX)를 붙여 5km 단위 평지 가정 대신 진짜 업/다운힐 구간을 반영해볼 계획이다.
