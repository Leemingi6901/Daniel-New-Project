---
title: "업무 일지 대시보드 3탄 — 명령 팔레트, 레퍼런스 기반 리디자인, 다크 모드와 색 검증"
description: "Work Tracker에 ⌘K 명령 팔레트·되돌리기 토스트·dnd-kit을 붙이고, Awwwards와 아임웹을 참고해 레이아웃을 갈아엎은 뒤 다크 모드와 차트용 색 팔레트를 수치로 검증한 과정"
updated: "2026-09-28"
tags: [Next.js, TypeScript, UI-UX, 다크모드, 데이터시각화, 업무관리]
---

[지난 글](/wiki/web/task-tracker-category-forms-checklist)에서 카테고리별 입력 양식을 붙인 **Work Tracker**([daniel-work-tracker.vercel.app](https://daniel-work-tracker.vercel.app))를 이번엔 크게 손봤다. "디자인을 좀 더 감각적으로, 쓰기 편하게"라는 막연한 목표를 네 단계로 쪼개서 순서대로 진행했다.

1. 저장소 교체 (Vercel Blob → Postgres) — 진행 대기 중
2. 쓰는 감각 다듬기 — 모달, 토스트, 드래그 정렬
3. 빠르게 움직이는 도구 — 명령 팔레트, PWA
4. 보기 좋게 — 다크 모드, 애니메이션, 차트

중간에 레퍼런스 사이트를 보고 헤더와 대시보드 레이아웃을 새로 짜는 작업도 끼어 들어갔다.

## 2단계: 작은 불편을 없애는 라이브러리들

### 모달은 Radix Dialog로 통일

업무·일정·반복업무·완료 처리 모달이 각자 `fixed inset-0` div로 직접 구현돼 있었다. 포커스가 모달 밖으로 새고, 뒤 페이지가 스크롤되고, Esc 처리도 제각각이었다. 공용 `Modal` 컴포넌트를 Radix Dialog 위에 만들고 네 모달을 전부 옮겼다. 첫 입력칸 자동 포커스는 `data-autofocus` 속성을 달아두고 `onOpenAutoFocus`에서 찾아 포커스하는 방식으로 통일했다.

### 삭제는 확인창 대신 "되돌리기"

`confirm()` 창을 없애고 sonner 토스트에 **되돌리기** 버튼을 달았다. 삭제를 누르면 화면에서는 즉시 사라지지만 실제 DELETE 요청은 5초 뒤에 나간다. 그 사이 되돌리기를 누르면 요청 자체가 나가지 않는다.

```ts
export function deleteWithUndo({ key, message, commit, restore }: UndoOptions) {
  const timer = setTimeout(() => flush(key), UNDO_WINDOW_MS); // 5초
  pending.set(key, { timer, commit, restore });
  toast(message, { action: { label: "되돌리기", onClick: () => cancel(key) } });
}
// 5초 안에 탭을 닫아도 삭제가 유실되지 않게 pagehide에서 남은 삭제를 즉시 보낸다.
window.addEventListener("pagehide", flushAll);
```

`pagehide`에서 보내는 요청은 페이지가 사라지는 중이라 끊길 수 있어서, DELETE fetch에 `keepalive: true`를 붙였다.

### 드래그 정렬은 dnd-kit으로 — 키보드 버그 하나

지난 글에서 HTML5 드래그앤드롭으로 붙였던 정렬을 dnd-kit으로 바꿨다. 터치와 키보드 지원 때문이다. 그런데 키보드로 옮기면(스페이스 → ↓ → 스페이스) 제자리에 놓이는 현상이 있었다.

원인은 KeyboardSensor가 이동할 때 **부드러운 스크롤을 먼저 하고, 스크롤이 끝난 뒤에야 위치를 반영**한다는 것이었다. ↓ 직후 바로 스페이스를 누르면 아직 이동이 반영되기 전이라 원래 자리에 떨어진다.

```ts
useSensor(KeyboardSensor, {
  coordinateGetter: sortableKeyboardCoordinates,
  scrollBehavior: "auto", // smooth면 스크롤 완료 전 드롭 시 제자리에 놓인다
});
```

스크린리더 안내 문구도 기본값은 영어에 항목 ID(UUID)를 그대로 읽어서, `announcements`로 "'방화벽 점검'을 3번째 위치에 놓았습니다" 같은 한국어 문장을 직접 지정했다.

체크리스트는 체크할 때마다 즉시 저장되게 바꿨다. 빠르게 여러 개를 체크하면 PATCH 요청 순서가 뒤바뀔 수 있어서, 저장 요청을 Promise 체인 하나에 직렬로 이어 붙였다.

## 3단계: ⌘K 명령 팔레트와 PWA

### cmdk로 검색 + 명령을 한 곳에

검색창을 cmdk 기반 팔레트로 바꿨다. Ctrl/⌘+K 한 번으로 업무·일정·반복업무를 찾고, "새 업무", "일정 등록" 같은 명령과 페이지 이동도 할 수 있다.

바로 부딪힌 문제는 **cmdk 기본 필터가 퍼지 매칭**이라는 점이었다. 글자가 순서대로만 들어 있으면 매칭되니, 한글 검색어가 엉뚱한 항목에 걸렸다. 항목마다 `keywords`를 달고 부분 일치만 허용하는 필터로 바꿨다.

```ts
function matchKeywords(_value: string, search: string, keywords?: string[]) {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  return (keywords ?? []).some((k) => k.toLowerCase().includes(q)) ? 1 : 0;
}
```

팔레트에서 항목을 고르면 해당 페이지로 이동해서 모달을 열어야 한다. 이건 `/?new=event`, `/?meeting=<id>`, `/recurring?open=<id>` 같은 쿼리 딥링크로 처리하고, 각 페이지가 파라미터를 읽어 모달을 연 뒤 URL을 정리하게 했다. 덕분에 PWA 홈 화면 바로가기("새 업무")도 같은 링크를 그대로 쓴다.

### 덤으로 찾은 버그: 크론이 매일 401을 받고 있었다

PWA manifest와 아이콘을 로그인 없이 열리게 하려고 인증 프록시(`proxy.ts`)를 보다가 발견했다. 프록시는 세션 쿠키가 없는 `/api/*` 요청을 전부 401로 막는데, **Vercel Cron은 쿠키 없이 `Authorization: Bearer <CRON_SECRET>`으로 호출**한다. 매일 밤 완료 업무를 보관 처리하는 크론이 아마 한 번도 제대로 돌지 않았던 셈이다. 크론 라우트가 이미 자체적으로 시크릿을 검사하고 있어서, 프록시에서는 `/api/cron/*`을 통과시키기만 하면 됐다.

아이콘은 PNG 파일을 커밋하는 대신 `next/og`의 `ImageResponse`로 라우트에서 그리고, `generateStaticParams`로 빌드 때 180/192/512 크기를 미리 생성했다.

## 레퍼런스 기반 리디자인

"감각적인 사이트를 주면 그 디자인을 가져올 수 있냐"는 요청에 두 사이트를 받았다. 헤더와 검색은 **Awwwards**, 페이지 레이아웃은 **아임웹**을 참고했다. 소스를 복사하지 않고, 브라우저에서 계산된 스타일 값을 측정해서 우리 스택으로 다시 만들었다.

```js
// 레퍼런스 사이트의 헤더·검색창 실측 (브라우저 콘솔)
getComputedStyle(document.querySelector(".search-form"))
// → height 42px, radius 8px, background #e9e9e9, transition background .3s
```

- **헤더 (Awwwards)**: 높이 54px 둥근 회색 바 하나에 로고, 타일형 메뉴, 검색, 검정 CTA 버튼을 담았다. 검색창에 포커스하면 메뉴가 숨고 검색창이 헤더 전체 폭으로 늘어나며, 헤더 아래로 결과 패널이 붙어 열리고 뒤 페이지가 어두워진다. 앞에서 만든 명령 팔레트를 가운데 모달 대신 이 헤더 패널 안에 넣었다.
- **모바일 메뉴 (Awwwards 하단 바 응용)**: 메뉴를 화면 하단의 떠 있는 알약 모양 바로 옮겨 엄지가 닿게 했다.
- **공지 바 (아임웹)**: 최상단의 검정 둥근 띠 배너를 "오늘의 반복 업무"로 썼다.
- **히어로 + 입력 카드 (아임웹)**: 큰 제목과 가운데 AI 입력창 구성을, 큰 날짜 + 한 줄 통계 + **빠른 등록 카드**로 바꿨다. '기타'는 적고 Enter를 누르면 바로 등록되고, 양식이 있는 분류는 내용이 채워진 채로 등록 모달이 열린다.

빠른 등록에서 놓치기 쉬운 부분이 하나 있다. 한글은 조합 중에 누르는 Enter가 **글자를 확정하는 입력**이기도 하다. 이걸 제출로 처리하면 마지막 글자가 중복되거나 잘린다.

```ts
if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
  e.preventDefault();
  submit();
}
```

그리고 모든 버튼에 붙어 있던 `hover:scale-[1.03]` 류의 효과 85곳을 걷어내고 색만 바뀌게 했다. 두 레퍼런스 모두 hover 시 불투명도나 배경색만 바꿀 뿐 크기를 키우지 않는다는 걸 측정하다 알게 됐다. 화면이 들썩이지 않으니 훨씬 차분해졌다.

## 4단계: 다크 모드, 애니메이션, 차트

### 다크 모드는 토큰 한 벌 더

색이 전부 CSS 변수(`--bg`, `--surface`, `--text-primary`…)로 돼 있어서, next-themes가 `<html data-theme="dark">`를 바꿔주면 `:root[data-theme="dark"]`에 같은 이름의 값을 한 벌 더 정의하는 것으로 끝났다. 헤더 CTA처럼 `bg-[var(--text-primary)] text-[var(--surface)]`로 만든 반전 버튼은 다크 모드에서 자동으로 밝은 버튼이 된다. 반대로 `text-white`처럼 하드코딩한 곳은 다크 모드에서 밝은 배경 위 흰 글씨가 돼 사라졌다. 그래서 전부 토큰으로 바꿨다.

### 차트 색은 눈대중 대신 계산

리포트에 분류별 완료 추이를 쌓은 막대 차트(Recharts)를 넣으면서 분류 색 4개를 검증 스크립트에 돌렸다. 결과는 **실패**였다.

```
[FAIL] Chroma floor     #17181b (기타) — 채도가 없어 회색으로 읽힘
[FAIL] Normal-vision    #8a6a13 ↔ #a03b33 ΔE 13.0 — 정상 시력으로도 구분이 어려움
```

지금까지 앱 전체에서 쓰던 보안(적갈색)과 IT 지원(황갈색)이, 색각 이상이 아니어도 헷갈릴 만큼 가까웠다. 점 하나로만 쓸 때는 잘 몰랐는데, 막대 차트처럼 면적으로 붙어 나오면 바로 티가 난다.

라이트 모드는 검증된 기준 색상에서 같은 색 계열(빨강·파랑·노랑·청록)을 골라 통과시켰다. 다크 모드는 허용 밝기 범위(OKLCH L 0.48–0.67)가 좁아서 손으로 맞추기가 어려웠다. 빨강·노랑 후보를 격자로 돌려 모든 검사를 통과하는 조합을 찾았다.

```js
for (const red of redCandidates) for (const yel of yellowCandidates) {
  const out = validate([red, blue, yel, aqua], { mode: "dark", surface: "#1c1b18", pairs: "all" });
  if (out.ok) passing.push({ red, yel });
}
// → 370개 통과, 경고가 가장 적은 #c84040 / #b08800 채택
```

통과했지만 빨강↔청록의 색각 이상 구분도(ΔE 6.9)는 경고 구간이라, 색만으로 구분하지 않게 보조 장치를 달았다.

- 범례를 항상 표시하고 분류별 합계를 함께 적는다.
- 쌓인 조각 사이에 표면색 2px 간격을 둔다.
- 빨강과 청록이 맞닿지 않게 쌓는 순서를 고정한다.
- **표로 보기** 전환을 둔다.

막대 위쪽 끝만 둥글게 하는 것도 Recharts `radius`로는 조각마다 적용돼서, 커스텀 `shape`로 "이 조각 위에 값이 있는 분류가 없을 때만" 둥근 path를 그리게 했다.

### 애니메이션은 상태가 바뀌는 순간에만

motion으로 넣은 건 네 가지다.

- 히어로 영역이 순차적으로 떠오르고, 통계 숫자가 올라간다.
- 오늘 할 일에서 완료 처리한 업무가 접히며 사라진다.
- 캘린더가 넘긴 방향으로 밀려 들어온다.
- 모달이 살짝 확대되며 열린다.

스크롤할 때마다 요소가 날아오는 류는 넣지 않았다. 매일 여는 도구에서는 처음 한 번만 멋있고 그 뒤로는 기다림이 되기 때문이다. `MotionConfig reducedMotion="user"`로 OS의 '동작 줄이기' 설정도 따른다.

## 남은 것: 저장소

작업 내내 로컬 개발에서 괴롭혔던 게 Vercel Blob이다. [예전 글](/wiki/web/task-tracker-vercel-blob-consistency)의 최종적 일관성 문제에 더해, 이번엔 목록 조회가 **호출할 때마다 항목을 빼먹거나 빈 배열을 돌려주는** 현상까지 봤다. 같은 요청을 몇 번 반복해야 원하는 업무가 보였다. 화면에서는 로컬 캐시와 병합하는 `mergeFresh` 같은 우회 코드로 가려왔다. 하지만 업무 기록이 쌓이는 도구에서 "있는지 없는지 매번 다르다"는 건 버틸 문제가 아니다. 다음 작업은 Neon Postgres + Drizzle로의 이전이고, 그게 끝나면 이 우회 코드들을 전부 지울 수 있다.
