---
title: "업무 일지 대시보드 만들기 — Vercel Blob을 DB처럼 쓸 때의 최종적 일관성 문제"
description: "Next.js + Vercel Blob으로 만든 팀 업무 관리 대시보드 개발기와, 상태 변경이 새로고침하면 되돌아가던 버그를 고친 과정"
updated: "2026-09-17"
tags: [Next.js, TypeScript, Vercel-Blob, Eventual-Consistency, 업무관리]
---

회사에서 쓸 개인 업무 관리 대시보드 **W CONCEPT - Work Tracker**를 만든 과정. 보안/인프라/IT 지원/기타로 업무를 분류하고, 접수→진행중→완료 3단계로 상태를 관리하며, [task-tracker-virid-phi.vercel.app](https://task-tracker-virid-phi.vercel.app)에 배포해 실제로 매일 쓰고 있다.

## 기술 스택

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- **Vercel Blob** — 업무 하나당 JSON 파일 하나(`data/tasks/<id>.json`)로 저장, 별도 DB 없음
- 쿠키 기반 비밀번호 게이트 인증, Vercel Cron으로 매일 08시(KST) 완료 업무 자동 이관

PaceLab 때와 마찬가지로 혼자(또는 소수 팀) 쓰는 데이터라 스키마 마이그레이션 부담 없이 객체 하나 읽고 쓰는 구조로 충분했다.

## 기능 구조

- **분류별 업무 현황** — 보안/인프라/IT 지원/기타 카테고리별로 그룹핑, 중요 업무는 볼드체로 각 그룹 최상단에 노출
- **상태 제어** — 접수/진행중/완료 3단계 버튼, 완료로 바꿀 때는 처리 방법을 적는 팝업을 띄움
- **캘린더** — 날짜별로 업무 리스트 대신 카테고리별 건수만 표시(`보안 1건`, `IT 지원 2건` 식)해서 한눈에 부하를 파악
- **자동 이관** — `vercel.json`의 cron이 매일 UTC 23시(KST 08시)에 완료된 업무를 완료 이력으로 이관

```json
{
  "crons": [{ "path": "/api/cron/archive-done", "schedule": "0 23 * * *" }]
}
```

## 트러블슈팅 — 상태 변경이 새로고침하면 되돌아가는 버그

진행중으로 바꿔놓고 다른 탭에 갔다 돌아오면 다시 접수로 보이는 증상이 있었다. 처음엔 Vercel의 엣지 캐시를 의심해서 `Cache-Control: no-store`를 명시하고 응답 헤더로 `x-vercel-cache: MISS`까지 확인했지만 재현됐다 — HTTP 캐싱 문제가 아니었다.

원인은 Vercel Blob 자체의 **최종적 일관성(eventual consistency)**. `list()`로 반환되는 메타데이터(uploadedAt/url)가 방금 한 덮어쓰기를 곧바로 반영하지 못하는 경우가 있었다. 1차로는 `list()`를 파일 목록 조회용으로만 쓰고, 각 파일의 실제 내용은 독립적인 `head()` + `fetch()`로 다시 읽도록 바꿔서 상당 부분 완화했다.

```ts
export async function listTasks(): Promise<Task[]> {
  // list()는 어떤 id가 있는지 확인하는 용도로만 쓴다 — 그 자체의 메타데이터는
  // 방금 한 덮어쓰기를 늦게 반영할 수 있어서, 각 업무는 head()+fetch()로 다시 읽는다.
  const { blobs } = await list({ prefix: PREFIX });
  const ids = blobs.map((b) => b.pathname.slice(PREFIX.length).replace(/\.json$/, ""));
  const tasks = await Promise.all(ids.map((id) => readTask(id)));
  return tasks.filter((t): t is Task => t !== null);
}
```

그런데도 완전히 사라지지 않았다. `head()`가 반환하는 `uploadedAt`/`url` 자체도 순간적으로 이전 값을 가리킬 때가 있어서, 서버가 정말로 오래된 콘텐츠를 돌려주는 케이스가 남아 있었다. 서버 쪽에서 100% 없앨 수 없다면, **클라이언트가 알고 있는 최신 상태보다 더 오래된 응답은 무시**하도록 방어선을 하나 더 두기로 했다.

```ts
// 로컬에 캐시된 값이 서버 응답보다 최신(updatedAt 기준)이면 캐시 값을 유지해
// 화면이 이전 상태로 되돌아가는 현상을 막는다.
function mergeFresh(server: Task[], known: Task[]): Task[] {
  const knownById = new Map(known.map((t) => [t.id, t]));
  return server.map((s) => {
    const k = knownById.get(s.id);
    return k && k.updatedAt > s.updatedAt ? k : s;
  });
}
```

이 최신 상태는 `localStorage`에 캐시해서 컴포넌트가 언마운트됐다 다시 마운트돼도(탭 이동, 새로고침) 비교 기준이 남아있게 했다. 상태 변경 시 낙관적 업데이트(optimistic update)로 `updatedAt`을 즉시 갱신해두면, 뒤이어 들어오는 서버 응답이 설령 오래된 스냅샷이더라도 타임스탬프 비교에서 자동으로 걸러진다.

서버 쪽 지연을 완전히 없애는 대신, "더 최신 정보를 알고 있다면 오래된 응답에 절대 덮어쓰이지 않는다"는 불변식을 클라이언트에 두는 쪽으로 문제를 옮긴 셈이다. Blob이든 다른 이벤추얼 컨시스턴시 스토리지든, 쓰기 직후 읽기 패턴이 잦은 UI에는 이런 타임스탬프 기반 방어선이 서버 튜닝보다 훨씬 확실했다.

## 마무리

카테고리 분류, 중요도 정렬, 캘린더 요약까지 붙이고 나니 실제로 매일 열어보는 대시보드가 됐다. Vercel Blob을 가벼운 DB로 쓸 때는 PaceLab의 CDN 캐시 문제에 이어 이번엔 API 자체의 일관성 문제까지 겪었는데, 공통된 교훈은 같다 — 쓰기 직후 읽기가 잦다면 스토리지의 일관성 보장 수준을 먼저 확인하고, 안 되면 클라이언트가 최신성을 스스로 판단할 수 있는 기준(타임스탬프)을 반드시 남겨둬야 한다.
