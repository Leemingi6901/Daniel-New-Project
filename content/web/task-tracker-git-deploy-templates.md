---
title: "업무 일지 대시보드 5탄 — GitHub 자동 배포, 반복 업무 체크, 템플릿과 필터"
description: "로컬에만 있던 Work Tracker 코드를 비공개 저장소로 옮겨 push 자동 배포를 붙이고, 반복 업무 체크·업무 템플릿·필터·단축키·주간 보고를 추가하며 만난 설계 포인트"
updated: "2026-09-29"
tags: [Next.js, Vercel, GitHub, UI-UX, 업무관리]
---

[4탄](/wiki/web/task-tracker-postgres-prep-calendar-alerts)까지 기능은 꽤 붙었는데, 정리해 보니 기반이 불안했다. **Work Tracker 코드는 GitHub 원격 저장소 없이 이 PC 디스크에만 있었다.** 배포도 CLI로 올린 뒤 도메인을 손으로 연결하는 식이었다. 이번엔 그 기반부터 고치고, 남아 있던 개선 목록을 한 번에 반영했다.

## 백업과 자동 배포

### 올리기 전에 이력부터 확인

비공개 저장소를 만들기 전에, 지금까지의 **모든 커밋 이력**에 비밀값이 섞여 있지 않은지 먼저 확인했다. 비공개라도 한 번 올라간 비밀값은 되돌리기 어렵다.

```bash
git ls-files | grep -iE "(^|/)\.env"                      # 추적 중인 env 파일
git log --all --name-only --format= | grep -iE "\.env"    # 과거에 커밋된 적 있는 env 파일
git grep -nIE "vercel_blob_rw_|npg_|postgres://[^ ]+:[^ ]+@" $(git rev-list --all)  # 토큰 패턴
```

셋 다 비어 있는 걸 확인한 뒤, 브랜치를 `main`으로 바꾸고 `gh repo create --private --push`로 올렸다. 브랜치 이름을 바꾼 이유는 Vercel이 연결 시점의 기본 브랜치를 운영 배포 브랜치로 쓰기 때문이다. 그다음 `vercel git connect`로 프로젝트와 저장소를 이었다.

### 도메인이 매번 수동이었던 이유

지금까지 배포할 때마다 `vercel alias set ... daniel-work-tracker.vercel.app`을 따로 쳐야 했다. 이유를 이번에 찾았다. 프로젝트에 등록된 도메인을 API로 조회해 보니 이렇게 나왔다.

```
task-tracker-virid-phi.vercel.app
```

프로젝트 이름을 바꾸기 전의 기본 도메인만 등록돼 있었고, 실제로 쓰던 `daniel-work-tracker.vercel.app`은 **별칭(alias)으로만** 붙어 있었다. 별칭은 특정 배포 하나를 가리킬 뿐이라 새 배포로 따라가지 않는다. 프로젝트 도메인으로 등록하자 문제가 풀렸다.

```bash
MSYS_NO_PATHCONV=1 npx vercel api /v10/projects/daniel-work-tracker/domains -X POST -f name=daniel-work-tracker.vercel.app
```

`MSYS_NO_PATHCONV=1`은 Windows Git Bash 때문에 붙였다. Git Bash는 `/v10/...` 같은 인자를 Windows 경로로 바꿔버려서, 처음엔 "Invalid arguments"만 나왔다. 이제 `git push` 한 번이면 빌드되고, 도메인도 새 배포로 자동으로 넘어간다. 첫 push 배포 후 `vercel inspect daniel-work-tracker.vercel.app`으로 방금 배포의 ID가 나오는 걸 확인했다.

## 반복 업무: 보여주기에서 체크하기로

반복 업무는 그날 할 일을 공지 바에 **보여주기만** 했다. 다 했는지 표시할 방법이 없으니 결국 머릿속으로 관리하게 된다. 날짜별 완료 기록(`doneDates`)을 추가하면서 고민한 건 **무엇을 서버로 보낼지**였다.

클라이언트가 `doneDates` 배열을 통째로 보내면 간단하다. 하지만 휴대폰에서 연 화면이 오래된 상태라면, 그 사이 PC에서 체크한 다른 날짜 기록을 덮어쓴다. 그래서 "이 날짜를 완료/취소"라는 **의도만** 보내고, 합치는 건 서버가 한다.

```ts
if (input.markDone) {
  const { date, done } = input.markDone;
  const cutoff = /* 90일 전 */;
  const rest = task.doneDates.filter((d) => d !== date && d >= cutoff);
  task.doneDates = done ? [...rest, date].sort() : rest;
}
```

오래된 기록을 90일에서 잘라내는 것도 같은 자리에서 한다. 체크 기록은 "오늘 했는지" 표시에만 쓰이니 무한히 쌓을 이유가 없다. 아침 텔레그램 알림도 이미 체크한 반복 업무는 빼도록 바꿨다.

## 업무 템플릿

같은 장비의 월간 점검처럼, 보안·인프라 업무는 입력값이 매번 거의 같다. 새 업무 창 위에 템플릿 칩을 두고, 누르면 분류·우선순위·장비명·요청자·작업 내용·체크리스트가 한 번에 채워지게 했다. 작성 중인 내용은 "템플릿으로 저장"으로 남긴다.

저장소는 4탄에서 만든 `Collection` 인터페이스 덕에 거의 공짜였다. Blob 구현과 Postgres 테이블(마이그레이션 `0001`)을 한 줄씩 추가하고, 이관 스크립트에 "템플릿" 한 줄을 더했다. 테스트도 같은 PGlite 경로에서 돈다.

부수 효과로 오래 묵은 lint 오류 하나가 정리됐다. 새 업무의 신청일을 오늘로 채우는 로직이 `useEffect` 안에서 state를 바꾸고 있었다. 템플릿을 적용할 때도 분류가 바뀌니, 이 로직을 **분류를 바꾸는 함수 안**으로 옮겼다. effect가 사라지고, 템플릿 적용과 직접 선택이 같은 경로를 탄다.

```ts
function changeCategory(next: TaskCategory) {
  setCategory(next);
  if (isEdit) return;
  if (STRUCTURED_CATEGORIES.includes(next)) setStartDate((prev) => prev || todayInput());
  if (next === "IT 지원") setDueDate((prev) => prev || todayInput());
}
```

## 필터와 드래그 정렬의 충돌

대시보드에 "전체 / 우선순위 상 / 마감 지남" 필터를 달았다. 걸리는 건 드래그 정렬이었다. 정렬은 보이는 목록의 순서대로 `sortOrder = index`를 다시 매기는 방식이다. 필터로 일부만 보이는 상태에서 순서를 바꾸면, 숨어 있던 업무들과 번호가 겹쳐 순서가 꼬인다. 해결은 단순하게, **필터가 켜져 있을 때는 드래그 핸들을 숨기는 것**이다. 순서 변경은 전체 보기에서만 한다.

## 단축키와 주간 보고

`N`은 새 업무, `/`는 검색이다. 한 글자 단축키에서 가장 중요한 건 **언제 무시하느냐**다. 입력창에서 "n"을 치다가 새 업무 창이 열리면 안 되니, 판단을 한 함수로 모았다.

```ts
export function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return true;
  const el = e.target as HTMLElement | null;
  if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return true;
  return !!document.querySelector('[role="dialog"]');
}
```

`isComposing`은 한글 조합 중인 키 입력을 거르기 위한 것이다.

금요일 주간 보고(이번 주 완료를 분류별로, 남은 업무, 다음 주 마감)는 크론을 새로 만들지 않고 **기존 09:00 아침 알림에 얹었다.** 한국 시간 기준 금요일이면 메시지를 한 통 더 보낸다. `?weekly=1&dry=1`로 요일과 관계없이 내용만 미리 볼 수 있다.

## 모니터링: 기본값을 의심하기

Vercel Analytics와 Speed Insights를 붙이고, Sentry는 DSN이 있을 때만 SDK를 동적으로 불러오게 했다. 설정 전에는 번들에 아무것도 추가되지 않는다. 여기서 한 번 멈칫했다. 처음 쓴 `sendDefaultPii: false`가 타입 오류를 냈다. Sentry v11에서 사라진 옵션이었다. 타입 정의를 열어 보니 대신 생긴 `dataCollection`은 **기본값이 전부 켜짐**이었다. 쿠키, 헤더, 요청·응답 본문까지 수집한다.

업무 앱에서 요청 본문은 곧 업무 내용이고, 쿠키는 로그인 세션이다. 그래서 전부 명시적으로 껐다.

```ts
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
};
```

옵션 이름만 바꿔 넣었다면 개인 정보가 그대로 나갔을 것이다. 메이저 버전이 바뀐 라이브러리는 옛날 옵션 이름이 아니라 **현재 기본값**을 확인해야 한다는 교훈을 남긴 작업이었다.

## 위키 쪽 정리

3탄 배포를 깨뜨렸던 구글 폰트 다운로드 문제는 예고한 대로 고쳤다. `next/font/google`을 `@fontsource` 패키지의 woff2 파일을 가리키는 `next/font/local`로 바꿔서, 이제 빌드가 외부 폰트 서버에 의존하지 않는다. 배포 후 페이지에서 폰트는 그대로 로드되고, 구글 폰트 요청은 0건인 것을 확인했다.

## 마무리

이번 작업에서 가장 체감이 큰 변화는 기능이 아니라 **"push하면 끝"**이 된 배포 흐름이다. 코드는 두 곳(PC와 GitHub)에 있고, 도메인은 자동으로 따라오고, `npm test`가 저장소 경로·알림·내보내기를 검증한다. 남은 큰 일은 여전히 Neon 연결이다. 연결만 되면 이관 스크립트 한 번과 환경변수 하나로 저장소가 바뀐다.
