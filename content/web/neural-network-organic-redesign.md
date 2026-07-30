---
title: "히어로 뉴럴 네트워크 리디자인 — 3D에서 2D 행성 그래프까지"
description: "Three.js 3D 그래프를 2.5D 패럴랙스, 완전 2D SVG를 거쳐 깊이감·행성 셰이딩·애니메이션을 더한 그래프로 반복 개선한 기록"
updated: "2026-07-30"
tags: [Next.js, SVG, React, TypeScript, Three.js]
---

daniel.wiki 홈 히어로의 카테고리·문서 그래프를 3D → 2.5D → 2D 순으로 갈아엎은 과정. 매 라운드 실사용 피드백을 받아 범위를 좁혀나갔다.

## 0. 시작 — 3D 항성 필드

Three.js + react-three-fiber + drei로 허브 → 카테고리 → 문서 3단 구조를 3D 공간에 배치했다. 노드는 커스텀 GLSL 셰이더로 "끓어오르는 항성 표면"을 표현했고(simplex noise + fbm + fresnel), 배경엔 나선팔 은하 파티클(`THREE.Points`, 4200개)을 깔았다. `OrbitControls`로 자유 드래그 회전 + 스크롤 확대를 지원했다.

```glsl
vec3 p = normalize(vPosition) * 2.4 + vec3(0.0, 0.0, uTime * 0.08);
float n = fbm(p) * 0.5 + 0.5;
vec3 color = mix(uColorDark, uColorBright, smoothstep(0.25, 0.85, n));
```

## 1. 스크롤이 캔버스에 붙잡히는 문제

`OrbitControls`가 항상 활성화돼 있어 캔버스 위에서 스크롤하면 페이지 스크롤 대신 3D 확대가 발생했다. 처음엔 클릭으로 활성화하고 바깥 클릭/마우스 이탈 시 비활성화하는 방식으로 대응했다.

```tsx
useEffect(() => {
  if (!engaged) return;
  const handlePointerDown = (e: PointerEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) setEngaged(false);
  };
  document.addEventListener("pointerdown", handlePointerDown);
  return () => document.removeEventListener("pointerdown", handlePointerDown);
}, [engaged]);
```

## 2. 3D 자체가 불편하다는 피드백 → 2.5D 패럴랙스

자유 회전을 제거하고 마우스 위치에 따라 카메라가 아주 살짝(좌우 ±23°, 상하 ±13° 이내)만 기울어지는 2.5D 패럴랙스로 전환했다. `THREE.Spherical`로 기준 각도에서의 오프셋을 계산하고, 손을 떼면 항상 원래 각도로 부드럽게 복귀한다.

```tsx
useFrame(() => {
  const targetTheta = base.theta - pointer.current.x * 0.4;
  current.theta += (targetTheta - current.theta) * 0.06;
  camera.position.setFromSpherical(current);
  camera.lookAt(0, 0, 0);
});
```

드래그·확대가 사라지면서 스크롤 캡처 문제도 자연히 해결됐다.

## 3. 완전 2D + 비정형 구조로 전환

`three`/`@react-three/fiber`/`@react-three/drei` 의존성을 이 컴포넌트에서 전부 제거하고 순수 SVG로 재작성했다. 노드는 완전한 원형 대신 각도·반경에 시드 기반 지터를 줘 비정형으로 배치하고, 연결선도 직선 대신 2차 베지어 곡선으로 그렸다.

```ts
function categoryPoint(i: number, n: number, w: number, h: number): Pt {
  const baseAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
  const jitter = (pseudo(i * 13.7 + 1) - 0.5) * 0.55;
  const angle = baseAngle + jitter;
  return clampPoint({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }, w, h, margin);
}
```

WebGL이 없어져 서버 렌더링이 가능해졌고, `ResizeObserver`로 컨테이너의 실제 픽셀 크기를 그대로 `viewBox`에 써서 화면비에 상관없이 레터박스 없이 꽉 차게 만들었다.

## 4. SSR/클라이언트 하이드레이션 불일치 버그

콘솔에 다음 경고가 떴다.

```
+ d="M 450 250 Q 497.0364655599632 177.22013004251698 501.06930457228583 90.6575817152962"
- d="M 450 250 Q 497.0364655598729 177.2201300424926 501.06930457210524 90.6575817152962"
```

서버(Node.js)와 클라이언트(브라우저)가 같은 좌표 계산식을 돌렸는데도 `Math.cos`/`Math.sin`/`Math.hypot`을 체이닝한 결과가 소수점 10자리쯤에서 미세하게 갈렸다. 두 환경 모두 V8이지만 빌드가 달라 초월함수 결과가 ULP 단위로 다를 수 있고, 여러 연산을 거치며 그 오차가 누적된 것으로 보인다. 시각적으로 티가 안 나는 차이(1e-10)지만 React의 하이드레이션 비교는 문자열이 한 글자라도 다르면 잡아낸다.

좌표를 그리기 직전 소수 둘째 자리로 반올림해 해결했다.

```ts
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
```

## 5. 라벨 겹침 문제

문서가 많은 카테고리(예: 인프라·클라우드 7개)는 완전 무작위 각도로 배치하면 우연히 몰려서 라벨이 겹치는 일이 잦았다. 두 가지로 해결했다.

- 완전 랜덤 각도 대신 문서 개수만큼 고르게 나눈 슬롯에 배정 (반경도 문서 수에 비례해 확장)
- 문서 라벨은 기본 `opacity: 0`으로 숨기고 호버/탭 시에만 표시 — 평상시엔 허브 1개 + 카테고리 4개, 5개 라벨만 보여 겹칠 일이 없다

## 6. z-depth 레이어로 입체감

완전 평면이라 밋밋하다는 피드백에, 각 노드에 고정된 가상의 깊이값(z)을 부여했다. z가 클수록 크고 밝고 선명하게, 작을수록 작고 흐릿하게(피사계심도) 그리고, 그리는 순서도 z가 작은 노드부터 그려 가까운 노드가 겹칠 때 자연스럽게 위에 놓이도록 정렬했다.

```ts
function depthScale(z: number) { return 0.68 + z * 0.5; }
function depthOpacity(z: number) { return 0.55 + z * 0.45; }
function depthBlur(z: number) { return Math.max(0, (0.82 - z) * 3); }
```

## 7. 행성 셰이딩 + 애니메이션

방사형 그라디언트의 중심을 한쪽으로 옮겨 광원이 한쪽에서 비추는 것처럼 하이라이트 → 원래 색 → 어두운 그림자로 이어지게 해서, 평평한 원이 구체처럼 보이게 했다.

```tsx
<radialGradient id="planet-accent" cx="36%" cy="32%" r="75%">
  <stop offset="0%" stopColor={mix(color, "#ffffff", 0.7)} />
  <stop offset="45%" stopColor={color} />
  <stop offset="100%" stopColor={mix(color, "#000000", 0.58)} />
</radialGradient>
```

노드 위치는 그대로 두고 코어 원을 감싼 내부 `<g>`에만 느린(30~90초) CSS 회전을 걸어 하이라이트가 표면을 스치듯 자전하게 했다. 허브엔 얇은 고리와 은은한 펄스를, 허브→카테고리 연결선엔 SVG `<animateMotion>`으로 데이터 흐름 펄스를 추가했다(JS 프레임 루프 없는 선언형 애니메이션이라 성능 부담이 없다). 위치 자체를 흔들지 않은 게 핵심인데, 흔들면 고정 좌표로 그려진 연결선이 노드에서 떨어져 보이는 버그가 생기기 때문이다.

## 마무리

기술적으로 화려한 것과 실제로 쓰기 편한 것 사이에서 계속 범위를 좁혀나간 과정이었다. 3D 항성 필드는 만들 때는 재밌었지만 실사용성에서 밀렸고, 가장 단순한 기술(SVG)로 돌아와 디테일(깊이감, 구체 셰이딩, 절제된 애니메이션)을 쌓는 쪽이 더 만족스러운 결과로 이어졌다.
