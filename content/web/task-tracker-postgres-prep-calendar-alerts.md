---
title: "업무 일지 대시보드 4탄 — 저장소 교체 준비, 캘린더 구독과 텔레그램 아침 알림"
description: "Vercel Blob에서 Postgres로 옮기기 전에 저장소를 인터페이스 뒤로 숨기고 PGlite로 검증한 과정, 그리고 ICS 캘린더 피드·텔레그램 알림·CSV 내보내기를 붙이며 신경 쓴 디테일"
updated: "2026-09-28"
tags: [Next.js, TypeScript, Postgres, Drizzle, 업무관리]
---

[3탄](/wiki/web/task-tracker-redesign-darkmode) 마지막에 "다음은 저장소 교체"라고 적었다. 그런데 Neon 데이터베이스 연결은 Vercel 대시보드에서 약관 동의를 거쳐야 해서, 사람이 직접 눌러주기 전까지는 진행할 수 없었다. 그래서 순서를 바꿨다. **연결되는 순간 바로 옮길 수 있게 코드와 이관 스크립트를 먼저 끝내두고**, 기다리는 동안 외부 연동이 필요 없는 기능들을 붙였다.

## 저장소를 인터페이스 뒤로

업무·일정·반복업무 모듈은 각자 Blob의 `put`/`head`/`list`/`del`을 직접 부르고 있었다. 이걸 Postgres용으로 한 벌 더 복사하는 대신, 레코드 저장소를 네 개의 메서드로 추상화했다.

```ts
export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  put(record: T): Promise<void>;
  remove(id: string): Promise<void>;
}
```

Blob 구현과 Postgres(Drizzle) 구현을 하나씩 만들고, 도메인 모듈은 둘 중 무엇이 들어오는지 모른 채 이 인터페이스만 쓴다. "완료 처리하면 로그를 남긴다", "옛 데이터의 `important` 불리언을 우선순위로 바꾼다" 같은 규칙은 그대로 `tasks.ts`에 남았고, 바뀐 건 맨 아래 읽기/쓰기 네 줄뿐이다.

### 전환 스위치를 DATABASE_URL로 잡지 않은 이유

처음엔 "`DATABASE_URL`이 있으면 Postgres"로 분기하려 했다. 그런데 Vercel에서 Neon을 연결하면 **그 순간 `DATABASE_URL`이 환경변수에 생긴다.** 데이터를 옮기기 전에 아무 커밋이나 배포되면, 앱은 텅 빈 DB를 보고 "업무가 하나도 없는" 화면을 띄운다. 그래서 스위치를 따로 뒀다.

```ts
// DATABASE_URL만으로 전환하지 않는 이유: Neon을 연결하는 순간 변수가 생기므로,
// 데이터 이관 전에 배포되면 빈 DB를 보게 된다. 이관을 마친 뒤 명시적으로 켠다.
export function usePostgres(): boolean {
  return process.env.DATA_STORE === "postgres";
}
```

"연결"과 "전환"을 분리해두면 순서가 강제된다. 연결 → 이관 → 검증 → 스위치 ON → 재배포.

### Neon 없이 Postgres 경로 테스트하기

아직 DB가 없으니 Postgres 경로를 어떻게 검증할지가 문제였다. 여기서 **PGlite**를 썼다. WASM으로 돌아가는 진짜 Postgres라서, Drizzle이 만든 마이그레이션 SQL을 그대로 적용하고 실제 도메인 함수를 호출할 수 있다.

```ts
process.env.DATA_STORE = "postgres";
const db = drizzle(new PGlite(), { schema });
await migrate(db, { migrationsFolder: "./drizzle" }); // Neon에 적용할 것과 같은 SQL
setDb(db as unknown as Db);

const a = await tasks.createTask({ title: "장애 · 방화벽", category: "보안", ... });
assert.equal(a.sortOrder > 2 ** 31, true, "Date.now() 정렬키가 bigint로 저장돼야 한다");
```

마지막 assert는 스키마를 짜다가 잡은 함정이다. 옛 데이터는 정렬키로 `Date.now()`(약 1.7조)를 썼기 때문에 `integer`(최대 약 21억)로 선언하면 넘친다. `bigint`로 바꾸고, 그게 실제로 왕복되는지를 테스트로 박아뒀다. 타임스탬프도 `timestamptz`로 저장하되 도메인에서는 ISO 문자열로 다루기 때문에, 읽고 쓸 때 `createdAt`이 한 글자도 안 바뀌고 돌아오는지 확인했다. 화면 코드가 `a.createdAt.localeCompare(b.createdAt)`처럼 문자열 비교에 기대고 있어서, 형식이 `2026-09-28 05:47:48+00`으로만 바뀌어도 정렬이 틀어진다.

## 이관 스크립트: 목록을 믿지 않기

Blob → Postgres 이관에서 가장 신경 쓴 건, **Blob의 `list()`가 호출할 때마다 항목을 빠뜨리거나 빈 배열을 돌려준다**는 점이다(3탄에서 확인한 현상). 한 번 읽고 복사하면 몇 건이 조용히 누락될 수 있다.

그래서 목록을 여러 번 읽어 id의 합집합을 모으고, **연속 4번 더 늘지 않을 때** 멈춘다. 같은 id가 여러 번 읽히면 `updatedAt`이 최신인 쪽을 남긴다.

```ts
for (let round = 1; round <= MAX_ROUNDS && unchanged < STABLE_ROUNDS; round++) {
  const before = byId.size;
  for (const record of await blob.list()) {
    const prev = byId.get(record.id);
    if (!prev || record.updatedAt > prev.updatedAt) byId.set(record.id, record);
  }
  unchanged = byId.size === before ? unchanged + 1 : 0;
}
```

복사 후에는 Postgres에서 다시 읽어 **원본과 필드 단위로 비교**한다(키 순서를 정렬한 JSON 비교). upsert라 여러 번 돌려도 안전하고, `--pglite` 옵션을 주면 Neon에는 아무것도 쓰지 않고 인메모리 DB로 리허설만 한다. 실제 데이터로 리허설을 돌려 업무 4건과 일정 1건이 전 필드 일치로 옮겨지는 걸 확인해뒀다. 이제 Neon만 연결되면 이 스크립트 한 번 → 스위치 ON으로 끝난다.

## 캘린더 구독 피드 (ICS)

일정과 업무 마감일을 구글 캘린더·아이폰 캘린더에서 보고 싶었다. ICS 피드를 만드는 것 자체는 쉽지만 세 가지가 걸렸다.

**1. 인증.** 캘린더 앱은 로그인 쿠키 없이 URL만으로 피드를 가져간다. URL에 비밀 토큰을 넣어야 하는데, 이를 위해 환경변수를 하나 더 만들고 싶지 않았다. 이미 있는 `SESSION_SECRET`에서 HMAC으로 파생했다.

```ts
export function calendarToken(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update("calendar-feed").digest("hex").slice(0, 32);
}
```

비교는 `timingSafeEqual`로 하고, 로그인 프록시에서는 `/api/calendar/*`만 통과시킨다. 설정 화면에서도 주소는 "구독 주소 보기"를 눌러야 불러온다. 주소 자체가 열쇠라서, 화면을 켜두기만 해도 노출되는 걸 피하고 싶었다.

**2. 줄 접기는 바이트 단위.** RFC 5545는 한 줄을 75**옥텟**으로 제한한다. 글자 수로 자르면 한글(UTF-8 3바이트)이 들어간 제목은 규격을 한참 넘는다. 그렇다고 바이트로 자르다 한 글자의 중간을 끊으면 깨진다. 문자 단위로 순회하면서 바이트를 세고, 이어지는 줄은 앞에 공백 1바이트가 붙으니 74바이트까지만 담았다.

```ts
for (const ch of line) {
  const size = Buffer.byteLength(ch);
  if (bytes + size > (out.length ? 74 : 75)) { out.push(current); current = ""; bytes = 0; }
  current += ch;
  bytes += size;
}
```

**3. 시간대.** 회의 시간은 한국 시간으로 저장돼 있다. `VTIMEZONE` 블록을 넣는 대신, 한국은 서머타임이 없으니 UTC로 바꿔서(`10:00` → `010000Z`) 적었다. 종일 일정은 `DTEND`가 **다음 날**이어야 해서 10월 31일 일정은 11월 1일에 끝나도록 테스트를 넣었다.

## 텔레그램 아침 알림

매일 09:00(KST)에 Vercel Cron이 돌면서 "마감 지남 / 오늘 마감 / 내일 마감 / 오늘 일정 / 오늘의 반복 업무"를 한 메시지로 보낸다. 서버는 UTC로 돌기 때문에 "오늘"을 서버 시각으로 계산하면 한국 기준 아침 9시 전후로 날짜가 어긋난다. 기준 날짜는 따로 계산했다.

```ts
export function kstDateKey(now = new Date(), offsetDays = 0): string {
  return new Date(now.getTime() + 9 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
// UTC 09-28 15:30 = KST 09-29 00:30 → "2026-09-29"
```

메시지는 텔레그램 HTML 모드로 보내므로 업무 제목의 `<`, `>`, `&`를 이스케이프한다. "방화벽 <FW-01> 교체" 같은 제목이 태그로 해석되면 API가 400을 돌려준다. 봇 토큰이 없으면 조용히 건너뛰게 해서, 코드를 먼저 배포하고 토큰은 나중에 넣어도 되게 했다. 메시지를 만드는 부분은 순수 함수로 분리해서 네트워크 없이 테스트한다.

## CSV 내보내기

완료 이력 화면에 "전체 업무 CSV" 버튼을 달았다. 엑셀에서 UTF-8 CSV를 열면 한글이 깨지는 고전적인 문제는 파일 앞에 BOM(`﻿`)을 붙여 해결했다. 쉼표·따옴표·줄바꿈이 든 칸은 큰따옴표로 감싸고 안의 따옴표는 두 번 쓴다. 완료일은 UTC로 저장돼 있어서 그대로 날짜만 자르면 밤늦게 완료한 업무가 전날로 찍힌다. 한국 시간으로 바꾼 뒤 날짜를 뽑았다.

## 덤: 위키 배포가 실패했던 이유

3탄 글을 푸시했을 때 이 위키의 배포가 실패했다. 로그를 보니 `next/font/google`이 빌드 중에 Space Grotesk 폰트를 받아오지 못한 것이었다. 커밋은 마크다운 파일 하나 추가였고, 직전 배포 네 번은 모두 성공했다. 코드 문제가 아니라 빌드 시점 네트워크의 일시적 실패라고 보고, 같은 커밋을 그대로 다시 빌드(`vercel redeploy`)해서 해결했다. 빌드가 외부 네트워크(구글 폰트)에 의존하고 있다는 걸 새삼 알게 된 일이라, 반복되면 폰트를 로컬 파일(`next/font/local`)로 바꿀 생각이다.

## 마무리

이번 작업의 대부분은 "아직 할 수 없는 일"을 위한 준비였다. 스위치를 따로 두고, PGlite로 검증하고, 목록을 믿지 않는 이관 스크립트를 리허설까지 해두니, 막상 DB가 연결됐을 때 해야 할 일은 명령 한 줄과 환경변수 하나로 줄었다. 테스트는 `npm test` 하나로 저장소 경로·알림 메시지·내보내기를 모두 돌린다.
