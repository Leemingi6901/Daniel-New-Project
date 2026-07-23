---
title: "Next.js 16 주요 변경점 정리"
description: "Next.js 15에서 16으로 넘어갈 때 알아야 할 브레이킹 체인지"
updated: "2026-07-23"
tags: [Next.js, React, 프론트엔드]
---

## 핵심 요약

Next.js 16은 15에서 예고했던 변화들을 강제로 확정한 버전이다. "경고만 뜨던 것들이 이제 에러가 된다"고 이해하면 쉽다.

## 1. Async Request API 완전 전환 (Breaking)

`params`, `searchParams`, `cookies()`, `headers()`의 **동기 접근이 완전히 제거**됐다. 15에서는 경고와 함께 동작했지만 16에서는 반드시 `await` 해야 한다.

```tsx
// ❌ Next.js 15까지 (호환 모드)
export default function Page({ params }) {
  const { slug } = params;
}

// ✅ Next.js 16
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
```

타입도 `Promise<...>`로 감싸야 한다는 점에 주의.

## 2. middleware → proxy 개명

`middleware.ts` 파일명과 `middleware` export가 deprecated 되고 `proxy.ts` / `proxy`로 바뀌었다. 네트워크 경계에서 동작한다는 역할을 명확히 하려는 의도. 관련 설정 플래그도 함께 개명됐다 (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`).

## 3. Turbopack 기본화

빌드/개발 서버가 기본으로 Turbopack을 사용한다. webpack 설정에 의존하던 프로젝트는 Turbopack 설정으로 옮기거나 opt-out 해야 한다.

## 4. 캐싱 API 변경

`revalidateTag(tag)`의 단일 인자 형태가 deprecated — 이제 `cacheLife` 프로필을 두 번째 인자로 요구한다. `updateTag`, `refresh` 등 새 캐시 API도 추가됐다.

## 5. 기타

- React 19.2 기반
- React Compiler 지원
- `next/image` 기본값 변경 (`minimumCacheTTL`, `imageSizes` 등)
- sitemap/OG 이미지 생성 함수의 `params`, `id`도 Promise로 전달

## 마이그레이션 팁

공식 codemod가 대부분을 자동 처리해준다.

```bash
npx @next/codemod@latest upgrade latest
```

> 교훈: 프레임워크 메이저 업그레이드 전에 항상 upgrade 가이드부터 읽자. 특히 "동기 → 비동기" 전환은 컴파일 에러가 아니라 런타임에서 터지는 경우가 있다.
