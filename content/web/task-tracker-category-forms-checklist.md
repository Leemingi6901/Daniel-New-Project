---
title: "업무 일지 대시보드 2탄 — 카테고리별 입력 양식과 체크리스트, 드래그 정렬 붙이기"
description: "Work Tracker에 우선순위·체크리스트·드래그 정렬을 추가하고, 보안/인프라/IT 지원/기타마다 다른 입력 양식을 붙이면서 겪은 스키마 설계 고민"
updated: "2026-09-23"
tags: [Next.js, TypeScript, Vercel-Blob, UI-UX, 업무관리]
---

지난 글([Vercel Blob 최종적 일관성 트러블슈팅](/wiki/web/task-tracker-vercel-blob-consistency))에서 다룬 **W CONCEPT - Work Tracker**([daniel-work-tracker.vercel.app](https://daniel-work-tracker.vercel.app))를 계속 다듬었다. 이번엔 버그 수정이 아니라 실제로 매일 쓰면서 부족하다고 느낀 부분들 — 우선순위, 체크리스트, 정렬, 그리고 업무 카테고리마다 완전히 다른 입력 양식 — 을 붙였다.

## important 불리언을 priority enum으로

원래 업무에는 "중요 업무" 체크박스 하나만 있었다. 상/중/하 3단계 우선순위로 바꾸면서, 저장돼 있는 옛 데이터는 마이그레이션 스크립트 없이 읽는 시점에 변환하도록 했다.

```ts
// 예전에는 important(불리언) 하나뿐이었다. priority 필드가 없는 옛 데이터는
// important 여부로 상/중을 추정해 이관한다.
if (raw.priority === undefined) raw.priority = raw.important ? "high" : "medium";
```

체크리스트(서브태스크)와 카테고리 내 드래그앤드롭 순서 변경도 같은 시점에 추가했다. 드래그 정렬은 사실 재밌는 뒷이야기가 있는데, `.drag-over`라는 CSS 클래스가 예전부터 `globals.css`에 정의만 돼 있고 실제로 쓰이는 곳이 없었다 — 언젠가 드래그앤드롭을 붙일 생각으로 미리 만들어놓고 잊고 있었던 걸, 이번에 `sortOrder` 필드와 HTML5 drag-and-drop 이벤트를 엮어서 드디어 써먹었다.

## 카테고리마다 다른 입력 양식이 필요해졌다

보안/인프라 업무는 "장비명, 장애/작업 구분, 요청자, 신청일" 같은 정형 필드가 필요했고, IT 지원은 "요청자, 요청내용"이면 충분했고, 기타는 그냥 내용 한 줄이면 됐다. 문제는 검색·리포트·이력·캘린더 등 기존 기능이 전부 `task.title` / `task.description`이라는 공통 스키마를 전제로 짜여 있었다는 것. 카테고리마다 Task 타입 자체를 분기하면 이 기능들을 전부 다시 짜야 했다.

그래서 택한 방식은, Task 스키마에 `equipmentName` / `issueType` / `requester` / `remarks` 같은 구조화 필드를 선택적(nullable)으로 추가하되, **저장 시점에 title/description을 카테고리 규칙에 맞춰 자동으로 조합**하는 것이었다.

```ts
function buildPayload(): { title: string; description: string } | null {
  if (category === "보안" || category === "인프라") {
    if (!equipmentName.trim()) { setError("장비 및 솔루션 명을 입력해주세요."); return null; }
    return { title: `${issueType} · ${equipmentName.trim()}`, description: description.trim() };
  }
  if (category === "IT 지원") {
    if (!description.trim()) { setError("요청 내용을 입력해주세요."); return null; }
    return { title: requester.trim() ? `${requester.trim()} 요청` : "IT 지원 요청", description: description.trim() };
  }
  if (!content.trim()) { setError("내용을 입력해주세요."); return null; }
  return { title: content.trim(), description: "" };
}
```

이렇게 하면 검색창, 완료 이력, 리포트, 캘린더 — 전부 `title` 하나만 보고 동작하는 기존 코드를 한 줄도 안 고쳐도 됐다. 폼은 카테고리별로 완전히 다르게 보이지만, 저장되는 모양은 여전히 하나의 평평한 스키마다. 구조화된 입력이 필요한 건 "쓰는 사람" 쪽 UX 문제였지, 나머지 시스템이 그 구조를 다 알아야 할 이유는 없었다.

각 카테고리 제목 옆에는 ➕ 버튼을 달아서, 분류를 select에서 고르는 대신 원하는 카테고리로 바로 작성 모달이 열리게 했다. 새 업무 작성일 때만 신청일(구 시작일)을 카테고리에 맞춰 오늘 날짜로 미리 채워주는 것도 같이 넣었다 — 보안/인프라는 신청일만, IT 지원은 신청일·마감일 둘 다.

## 로컬 개발에서 또 만난 Blob 레이턴시

지난 글에서 다룬 건 "최신 데이터가 안 보이는" eventual consistency 문제였는데, 이번엔 결이 다른 걸 새로 확인했다. 프로덕션에서는 문제없이 빠른데, 로컬 `next dev`에서 Vercel Blob을 호출하면 요청 하나가 수 초에서 심하면 50초 넘게 걸린다.

```
POST /api/tasks 201 in 52s (application-code: 52s)
```

같은 코드가 배포하면 즉시 반응하니 로직 문제는 아니고, 로컬 환경과 Blob 사이의 네트워크 경로 자체가 원인으로 보인다. 결론은 단순하다 — 로컬에서 저장 버튼 눌렀는데 몇 초간 반응이 없어도 코드를 의심하기 전에 일단 기다려 보고, 기능 검증은 결국 배포본에서 한 번 더 확인하는 습관을 들이는 것.

## 마무리

우선순위와 체크리스트, 카테고리별 양식까지 붙이고 나니 "그냥 할 일 목록"에서 "부서 업무 접수 양식"에 가까워졌다. 다형적인 입력 요구사항이 생겼을 때 타입을 쪼개기보다 "공통 스키마 + 선택적 구조화 필드 + 저장 시점 정규화"로 풀면, 그 스키마에 의존하는 다른 기능들을 전혀 건드리지 않고도 UX만 다양화할 수 있다는 걸 다시 확인한 작업이었다.
