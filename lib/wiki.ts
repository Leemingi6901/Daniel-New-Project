import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

const CONTENT_DIR = path.join(process.cwd(), "content");

export const CATEGORIES: Record<string, { name: string; description: string }> = {
  ai: { name: "AI · LLM", description: "생성형 AI, LLM, 에이전트 관련 학습 노트" },
  web: { name: "웹 개발", description: "프론트엔드·백엔드 프레임워크와 웹 표준" },
  infra: { name: "인프라 · 클라우드", description: "서버, 배포, 클라우드, 자동화" },
  tools: { name: "개발 도구", description: "생산성을 올려주는 도구와 워크플로우" },
};

export interface WikiDocMeta {
  category: string;
  slug: string;
  title: string;
  description: string;
  updated: string; // YYYY-MM-DD
  tags: string[];
}

export interface WikiDoc extends WikiDocMeta {
  html: string;
}

function docPath(category: string, slug: string) {
  return path.join(CONTENT_DIR, category, `${slug}.md`);
}

function parseMeta(category: string, slug: string, raw: string): { meta: WikiDocMeta; body: string } {
  const { data, content } = matter(raw);
  return {
    meta: {
      category,
      slug,
      title: data.title ?? slug,
      description: data.description ?? "",
      updated: data.updated ?? "",
      tags: data.tags ?? [],
    },
    body: content,
  };
}

export function listDocs(): WikiDocMeta[] {
  const docs: WikiDocMeta[] = [];
  for (const category of Object.keys(CATEGORIES)) {
    const dir = path.join(CONTENT_DIR, category);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(docPath(category, slug), "utf8");
      docs.push(parseMeta(category, slug, raw).meta);
    }
  }
  return docs.sort((a, b) => (a.updated < b.updated ? 1 : -1));
}

export async function getDoc(category: string, slug: string): Promise<WikiDoc | null> {
  const file = docPath(category, slug);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { meta, body } = parseMeta(category, slug, raw);
  const html = String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeHighlight)
      .use(rehypeStringify)
      .process(body)
  );
  return { ...meta, html };
}
