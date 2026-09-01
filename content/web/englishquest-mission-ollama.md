---
title: "EnglishQuest — 미션 기반 영어회화 연습 앱, Claude에서 로컬 Ollama로"
description: "완전 초급자용 영어회화 연습 앱을 미션/레벨업 구조로 만들고, AI 대화 엔진을 Claude API에서 맥미니 로컬 Ollama로 바꾼 개발기"
updated: "2026-09-01"
tags: [Next.js, TypeScript, Ollama, LLM, Claude, 영어학습]
---

완전 초급자가 미션을 깨면서 AI 캐릭터와 짧은 영어 대화를 연습하는 앱 **EnglishQuest**를 만든 과정. [englishquest-ecru.vercel.app](https://englishquest-ecru.vercel.app)에 배포되어 있다. 텔레그램으로 매일 비동기 미션을 받고, 웹에서는 OPIc 스타일로 AI와 실시간 대화 연습을 하는 걸 최종 목표로 잡았고, 이번 글은 그중 첫 단계인 웹 프로토타입 구현기다.

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- AI 대화 엔진: 초기엔 **Claude API**, 이후 **맥미니 로컬 Ollama**로 전환
- 진행 상황(XP, 클리어 레벨)은 `localStorage`에만 저장 — 프로토타입 단계에서 굳이 클라우드 DB를 붙여 [PaceLab Vercel Blob 정지 사건](/wiki/web/pacelab-vdot-marathon-ai) 같은 과금 걱정을 또 만들고 싶지 않았다

## 미션/레벨업 구조

완전 초급자가 부담 없이 시작하도록 레벨을 5개로 쪼갰다. 인사 나누기 → 카페 주문 → 길 묻기 → 취미 이야기 → OPIc 스타일 자기소개 순으로 난이도가 올라가고, 이전 레벨을 깨야 다음이 열린다.

```ts
export const SCENARIOS: Scenario[] = [
  { id: "greetings", order: 1, targetTurns: 4, xpReward: 80, /* ... */ },
  { id: "cafe-order", order: 2, targetTurns: 5, xpReward: 100, /* ... */ },
  // ...
  { id: "self-intro", order: 5, targetTurns: 6, xpReward: 150, /* ... */ },
];
```

각 시나리오는 AI가 연기할 캐릭터/상황(`persona`)과 목표 턴 수(`targetTurns`)만 정의하면 되는 구조라, 레벨을 추가하는 비용이 낮다.

## 핵심 기능 — 리캐스트(recast) 교정

언어학습에서 리캐스트라고 부르는 기법을 썼다. 학습자의 실수를 대놓고 지적하는 대신, AI가 자기 대사 안에서 자연스럽게 맞는 표현으로 되받아 말해준다. 그래서 AI 응답을 항상 `{reply, correctionNote}` 구조로 강제했다 — `reply`는 캐릭터 대사 그대로, `correctionNote`는 화면에 "💡 팁"으로 따로 뜨는 한국어 설명이고, 교정할 게 없으면 비워둔다.

## AI 엔진 전환 — Claude tool-use → Ollama 구조화 출력

처음엔 Claude API의 강제 tool-use로 구현했다.

```ts
const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      correctionNote: { type: "string" },
    },
    required: ["reply"],
  },
};

const msg = await client.messages.create({
  model: MODEL,
  tools: [RESPOND_TOOL],
  tool_choice: { type: "tool", name: "respond" },
  // ...
});
```

`tool_choice`로 도구 호출을 강제하면 모델이 무조건 이 스키마대로만 응답해서, 파싱 실패 걱정 없이 구조화된 응답을 받을 수 있었다. 문제는 Anthropic API 키가 없다는 것 — 마침 맥미니가 있으니 완전 무료로 로컬 LLM을 쓰는 쪽을 택했다. [OpenClaw 텔레그램 봇](/wiki/ai/local-llm-ollama) 때도 같은 이유로 Ollama를 썼다.

Ollama는 Claude의 `tool_choice` 같은 강제 도구 호출은 없지만, `format`에 JSON 스키마를 넣으면 그 형식을 지키도록 강제하는 구조화 출력을 지원한다.

```ts
const RESPONSE_FORMAT = {
  type: "object",
  properties: {
    reply: { type: "string" },
    correctionNote: { type: "string" },
  },
  required: ["reply", "correctionNote"],
};

const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
  method: "POST",
  body: JSON.stringify({
    model: MODEL, // 예: llama3.1
    stream: false,
    format: RESPONSE_FORMAT,
    messages: [{ role: "system", content: systemPrompt }, ...history],
  }),
});
```

다만 로컬 소형 모델은 Claude만큼 스키마를 완벽히 지키지 않을 수 있어서, JSON 파싱에 안전장치를 하나 더 넣었다. `JSON.parse`가 바로 실패하면, 응답 텍스트 전체에서 가장 바깥 `{ ... }` 블록만 정규식으로 추출해 재시도한다 — 일부 모델이 JSON 앞뒤로 "Sure, here's the response:" 같은 잡담을 붙이는 경우를 대비한 폴백이다.

```ts
function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}
```

연결 실패와 응답 파싱 실패도 에러 메시지를 구분했다 — "맥미니에서 Ollama가 켜져 있는지 확인해주세요" vs "AI 응답을 해석하지 못했습니다"처럼. 사무실 PC에서 개발 중이라 실제 Ollama에 붙을 수는 없었는데, 이 에러 메시지가 정확히 뜨는 걸 확인하고 나서야 코드가 의도대로 동작한다는 걸 검증할 수 있었다.

## 배포

GitHub에 private 저장소로 올리고(`englishquest`), Vercel 프로젝트를 연결해 배포했다.

```bash
gh repo create Leemingi6901/englishquest --private --source=. --remote=origin --push
vercel link --yes --project englishquest --scope korea97
vercel --prod --yes
```

지금은 `OLLAMA_BASE_URL`이 아직 로컬(`localhost:11434`)만 가리키고 있어서, 배포된 사이트에서 AI 대화 기능은 맥미니가 외부에서 접근 가능해지기 전까지는 동작하지 않는다.

## 남은 숙제

- **맥미니에 Ollama 모델 받기** — 구조화 출력을 잘 지키는 모델(`qwen2.5` 계열 등) 위주로 테스트
- **맥미니 밖에서 접근 가능하게 열기** — Cloudflare Tunnel/Tailscale로 `OLLAMA_BASE_URL`을 외부에서도 닿게 하기
- **텔레그램 봇** — 매일 미션을 비동기로 보내는 쪽
- **DB 연동** — `localStorage`를 Supabase/Neon으로 옮겨 웹 대시보드와 텔레그램이 같은 진행 상황을 공유하게 하기
