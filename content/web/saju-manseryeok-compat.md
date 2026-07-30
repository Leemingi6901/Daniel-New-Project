---
title: "Daniel 사주팔자 — 만세력부터 궁합 점수화까지"
description: "lunar-javascript 기반 만세력 계산과 오행 상생상극 궁합 점수화, 대운/세운/신살까지 담은 개인 사주 사이트 개발기"
updated: "2026-07-30"
tags: [Next.js, TypeScript, lunar-javascript, Canvas]
---

생년월일시를 넣으면 사주팔자를 뽑아 해석하고, 두 사람의 궁합까지 점수화하는 개인 사이트. [daniel-saju.vercel.app](https://daniel-saju.vercel.app)에 배포되어 있으며, 별도 백엔드나 DB 없이 모든 계산이 클라이언트에서 결정론적으로 이뤄진다.

## 사주 계산 — lunar-javascript로 만세력 뽑기

`Solar.fromYmdHms(...)`로 양력 생년월일시를 만들고 `.getLunar().getEightChar()`로 년/월/일/시 네 기둥의 천간·지지를 얻는다. 시간을 모르면 시주 없이 세 기둥만으로 계산한다.

```ts
export function computeSaju(input: BirthInput): SajuResult {
  const solar = Solar.fromYmdHms(input.year, input.month, input.day, input.hour ?? 0, input.minute ?? 0, 0);
  const bazi = solar.getLunar().getEightChar();

  const elementCounts: Record<Element, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    elementCounts[p.ganElement]++;
    elementCounts[p.zhiElement]++;
  }
  return { input, hourKnown, year, month, day, time, dayMasterElement: day.ganElement, elementCounts, naYinDay: bazi.getDayNaYin() };
}
```

네 기둥의 오행을 세어 분포를 뽑고, 일간(日干)의 오행을 이 사람의 본질로 삼아 성격·연애·직업·재물·건강 콘텐츠와 궁합 계산의 기준으로 쓴다.

## 궁합 점수화

일간 오행 관계(상생/동일/상극), 일지 관계(육합/충/해), 서로의 부족한 오행을 채워주는지를 점수로 합산한다.

```ts
export function computeCompat(a: SajuResult, b: SajuResult): CompatResult {
  const stemScore = sRel === "generating" ? 35 : sRel === "same" ? 20 : 10;
  const branchScore = bRel === "harmony" ? 25 : bRel === "neutral" ? 15 : bRel === "harm" ? 8 : 0;
  const complementScore = Math.min(40, complements.length * 10);
  return { score: Math.round(stemScore + branchScore + complementScore) };
}
```

일지(日支)는 전통적으로 배우자 자리로 보는 자리라, 육합/충/해 관계가 궁합 해석의 핵심 축이다. 여기에 대운/세운 흐름을 얹어 향후 관계 흐름 그래프도 제공한다.

## 버그 — 대운이 전부 "토"로만 계산되던 문제

대운의 십성(비겁/식상/재성/관성/인성) 분포가 한쪽으로 쏠려 보이는 문제가 있었다. 원인은 다음 코드였다.

```ts
// 버그: 천간 한자를 그대로 두 번 이어붙여 wuxingPair에 넣음
const [ganElement] = wuxingPair(`${gh}${gh}`); // gh: "甲" 같은 간(干) 한자 1글자
```

`wuxingPair()`는 lunar-javascript가 돌려주는 "甲木" 형태의 간+오행 조합 문자열을 파싱하도록 만든 함수인데, 간 한자 하나를 그냥 두 번 이어붙인 값을 넣고 있었다. 매핑 테이블에 없는 키라 매번 매칭에 실패했고, 에러 없이 조용히 기본값 "토"로 폴백되고 있었다.

```ts
// 수정: 천간 한자 -> 오행 매핑을 직접 만들어 사용
export const GAN_ELEMENT: Record<string, Element> = {
  甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수",
};
const ganElement = GAN_ELEMENT[gh] ?? "토";
```

에러 없이 그럴듯한 값으로 조용히 폴백하는 코드가 가장 늦게, 가장 찾기 힘들게 발견된다는 걸 확인한 사례였다.

## 요약 카드 다운로드 — html-to-image가 계속 hang

사주/궁합 결과를 이미지로 저장하는 기능을 처음엔 `html-to-image`로 구현했다. 실제 DOM 카드를 캡처해주는 편한 방식이었지만, 이 개발 환경에서 DOM 캡처 단계가 원인 불명으로 계속 멈췄다.

원인을 더 파는 대신 **Canvas 2D API로 카드를 직접 그리는 방식**으로 교체했다. DOM 스냅샷에 의존하지 않고 텍스트·배경·구분선을 좌표 계산해 코드로 직접 그리므로, 비동기 DOM 캡처 단계 자체가 없어 hang될 지점이 사라졌다.

```ts
ctx.fillStyle = "#0f172a";
ctx.fillRect(0, 0, width, height);
ctx.font = "bold 28px sans-serif";
ctx.fillText(title, x, y);
const dataUrl = canvas.toDataURL("image/png");
```

동기적으로 끝까지 완결되는 방식이라 원인 모르게 멈추는 부류의 문제 자체가 원천 차단된다. 라이브러리가 내부적으로 뭘 하는지 통제가 안 될 때는 직접 그리기가 오히려 안전한 선택이 될 수 있다.

## 그 외 소소한 버그들

- **드롭다운 순서대로 골랐는데 값이 리셋됨**: 년/월/일을 하나의 문자열로 합쳐 파생시키던 구조라 순서대로 고르면 중간 선택값이 초기화됐다. `year`/`month`/`day`를 독립 state로 분리해 해결.
- **신살 카드 제목이 밀림**: 예전 grid 레이아웃의 `align-self: end`가 flex-column 구조로 바뀐 뒤에도 남아 있었다. 리팩터링 시 옛 CSS 잔재를 같이 정리하지 않으면 뒤늦게 드러난다.
- **같은 신살이 중복 카드로 표시됨**: 하나의 신살이 여러 기둥에서 동시에 매칭될 때 카드가 매칭 개수만큼 중복 생성되던 것을, 같은 신살은 한 칸으로 병합하도록 일반화했다.
