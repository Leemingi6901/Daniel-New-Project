---
title: "Daniel IT Infra & Security — 인프라·보안 뉴스 트렌드 레이더 만들기"
description: "국내외 RSS를 매일 자동 수집해 인프라·보안 키워드를 토픽별로 집계하는 개인 프로젝트 개발기"
updated: "2026-07-30"
tags: [Next.js, RSS, Vercel-Blob, Vercel-Cron, TypeScript]
---

국내외 인프라·보안 뉴스를 매일 자동으로 모아 지금 가장 많이 언급되는 키워드를 토픽별로 보여주는 개인 사이트. [daniel-infra-security.vercel.app](https://daniel-infra-security.vercel.app)에 배포되어 매일 아침 자동으로 새 기사를 수집한다.

## 기본 구조

- **수집**: 국내(보안뉴스, 데일리시큐, 지디넷코리아) + 해외(Hacker News, The Register Security, KrebsOnSecurity, InfoQ) RSS를 `rss-parser`로 파싱
- **트렌드 엔진**: 기사 본문에서 키워드(별칭 여러 개 등록)를 매칭해 빈도 집계, 보안·네트워크·인프라·AI 4개 토픽으로 그룹핑
- **저장**: Vercel Blob (DB 없이 JSON)
- **자동화**: Vercel Cron으로 매일 1회 크롤

```ts
export const KEYWORDS: KeywordDef[] = [
  { key: "zero-trust", label: "제로트러스트", aliases: ["zero trust", "zero-trust", "제로트러스트"], topic: "security" },
  { key: "kubernetes", label: "Kubernetes", aliases: ["kubernetes", "k8s", "쿠버네티스"], topic: "infra" },
];
```

키워드마다 한글/영문/약어 별칭을 여러 개 등록해두고 제목+본문 어디든 하나라도 매칭되면 같은 키워드로 집계한다. 데이터 저장은 PaceLab에서 겪었던 Vercel Blob CDN 캐시 일관성 문제를 알고 있었기 때문에, 처음부터 "타임스탬프 붙인 새 경로에 쓰고 `list()`로 최신 버전을 찾아 읽는" 패턴을 그대로 재사용했다.

## RSS 인코딩 문제

국내 매체 RSS 중 일부(보안뉴스 등)가 EUC-KR이라 기본 UTF-8 디코딩만으로는 한글이 깨졌다. `Content-Type` 헤더와 XML 선언의 encoding 속성을 확인해 인코딩을 판별한 뒤 `iconv-lite`로 디코딩하도록 고쳤다.

```ts
function detectCharset(contentType: string, head: string): string {
  const ctMatch = /charset=["']?([\w-]+)/i.exec(contentType);
  if (ctMatch) return ctMatch[1];
  const xmlMatch = /encoding=["']([\w-]+)["']/i.exec(head);
  if (xmlMatch) return xmlMatch[1];
  return "utf-8";
}
```

지디넷코리아 등 일반 IT 매체 피드엔 부고·유통·실적 뉴스처럼 무관한 기사도 섞여 있어, 키워드 매칭이 0건인 기사는 목록에서 제외했다.

## Cron 실행 제한

Vercel Hobby 플랜은 cron job을 하루 1회까지만 허용한다. 스케줄을 하루 한 번(22:00 UTC = 한국시간 07:00)으로 조정했다.

```json
{ "crons": [{ "path": "/api/cron/crawl", "schedule": "0 22 * * *" }] }
```

## 히어로 — daniel.wiki 스타일 재사용과 filter 애니메이션 성능 문제

히어로는 daniel.wiki 홈의 비정형 SVG 네트워크 그래프 패턴을 재사용해, 시간창(오늘/이번주/이번달/올해) 기반에서 보안·네트워크·인프라·AI 토픽 기반으로 발전시켰다.

한 라운드에서 허브 레이더 핑, 회전 궤도 링, 트레일 펄스, 클릭 리플까지 추가해 화려하게 만들었는데, 저사양 PC에서 스크롤 시 버벅임이 있었다. 원인은 허브/노드의 breathing glow를 `filter: drop-shadow(...)`로 구현한 것 — 이 값을 매 프레임 바꾸면 브라우저가 매번 해당 영역을 다시 래스터화해야 해서 비용이 크다. GPU 합성만으로 처리되는 `opacity`/`transform`과 달리, filter 값 변경은 CPU/GPU 래스터화 단계를 다시 태운다.

같은 시각 효과를 filter 없이 재구현했다 — 색이 도는 효과는 `stroke` 색상 자체를 순환시키고, breathing 효과는 opacity/transform 기반 pulse로 대체했다.

```
- filter: drop-shadow(0 0 Npx currentColor)  // 매 프레임 재래스터화
+ stroke: <순환하는 색상값>                    // GPU 합성만으로 처리
+ opacity/transform 기반 pulse
```

시각적으로는 거의 동일하지만 스크롤이 눈에 띄게 부드러워졌다. 애니메이션은 가능하면 `opacity`/`transform`만으로 설계해야 GPU 합성만으로 끝난다는 걸 다시 확인했다.
