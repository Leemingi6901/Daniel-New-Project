# Daniel Tech Wiki

IT 신기술을 공부하며 정리하는 학습 위키입니다. 개인 학습 기록이지만 누구나 참고할 수 있습니다.

**Live**: https://daniel-tech-wiki-korea97.vercel.app

## 스택

- Next.js 16 (App Router, SSG)
- 콘텐츠: `content/<카테고리>/<문서>.md` — frontmatter(title/description/updated/tags) + 마크다운
- 배포: Vercel

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드 (전체 정적 생성)
```

## 문서 추가하는 법

1. `content/` 아래 카테고리 폴더(ai, web, infra, tools)에 `.md` 파일 생성
2. frontmatter 작성:
   ```yaml
   ---
   title: "문서 제목"
   description: "한 줄 요약"
   updated: "YYYY-MM-DD"
   tags: [태그1, 태그2]
   ---
   ```
3. 커밋 & 푸시하면 Vercel이 자동 배포

카테고리를 추가하려면 `lib/wiki.ts`의 `CATEGORIES`에 항목을 추가하고 폴더를 만들면 됩니다.
