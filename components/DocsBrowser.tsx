"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  IconBrain,
  IconCode,
  IconServer2,
  IconTools,
  IconLayoutGrid,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { matchesQuery } from "@/lib/search";

const PAGE_SIZE = 5;

export interface BrowserDoc {
  category: string;
  slug: string;
  title: string;
  description: string;
  updated: string;
  pinned: boolean;
  tags: string[];
}

export interface BrowserCategory {
  key: string;
  name: string;
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  all: <IconLayoutGrid size={18} stroke={1.7} />,
  ai: <IconBrain size={18} stroke={1.7} />,
  web: <IconCode size={18} stroke={1.7} />,
  infra: <IconServer2 size={18} stroke={1.7} />,
  tools: <IconTools size={18} stroke={1.7} />,
};

function shortDate(d: string) {
  return d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : "";
}

/**
 * 홈의 문서 영역 — 위에는 카테고리 칸(누르면 거르기), 아래에는 최근 문서 5개씩 페이지.
 * frontmatter `pinned: true` 글은 listDocs 정렬로 맨 위에 오고 '추천'으로 표시한다.
 */
export default function DocsBrowser({ docs, categories }: { docs: BrowserDoc[]; categories: BrowserCategory[] }) {
  const [cat, setCat] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");

  const list = (cat === "all" ? docs : docs.filter((d) => d.category === cat)).filter((d) => matchesQuery(d, query));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = list.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const nameOf = (key: string) => categories.find((c) => c.key === key)?.name ?? "";
  const tiles = [{ key: "all", name: "전체" }, ...categories].map((c) => {
    const inCat = c.key === "all" ? docs : docs.filter((d) => d.category === c.key);
    return { ...c, count: inCat.length, latest: inCat.find((d) => !d.pinned) ?? inCat[0] };
  });

  const choose = (key: string) => {
    setCat(key);
    setPage(0);
  };

  return (
    <>
      <div className="hm-cat-row hm-span-3" role="group" aria-label="카테고리로 거르기">
        {tiles.map((c) => (
          <button key={c.key} type="button" className="hm-cat" aria-pressed={cat === c.key} onClick={() => choose(c.key)}>
            <span className="hm-cat-head">
              <span className="hm-cat-icon">{CATEGORY_ICONS[c.key]}</span>
              <strong>{c.name}</strong>
            </span>
            <span className="hm-cat-count">{c.count}</span>
            {c.latest && <span className="hm-cat-latest">{c.latest.title}</span>}
          </button>
        ))}
      </div>

      <div className="hm-panel hm-span-3">
        <div className="hm-panel-head">
          <h2>
            {query.trim() ? "검색 결과" : "최근 문서"}
            {cat !== "all" && <em> · {nameOf(cat)}</em>}
            <span className="hm-panel-meta">
              {list.length}개 · {current + 1}/{pages}쪽
            </span>
          </h2>
          <label className="hm-search">
            <IconSearch size={15} stroke={2} />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="제목·요약·태그 검색"
              aria-label="문서 검색"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">
                <IconX size={14} stroke={2} />
              </button>
            )}
          </label>
        </div>

        {list.length === 0 && <p className="hm-empty">맞는 문서가 없어요. 다른 단어로 찾거나 카테고리를 전체로 바꿔 보세요.</p>}

        <ul className="hm-recent" key={`${cat}-${current}`}>
          {shown.map((d) => (
            <li key={`${d.category}/${d.slug}`} className={d.pinned ? "is-pick" : undefined}>
              <Link href={`/wiki/${d.category}/${d.slug}`}>
                <time>{shortDate(d.updated)}</time>
                <span className="hm-recent-main">
                  <span className="hm-recent-title">
                    {d.pinned && <span className="hm-pick">추천</span>}
                    {d.title}
                  </span>
                  <span className="hm-recent-desc">{d.description}</span>
                </span>
                <span className="hm-recent-cat">{nameOf(d.category)}</span>
              </Link>
            </li>
          ))}
        </ul>

        {pages > 1 && (
          <nav className="hm-pager" aria-label="최근 문서 페이지">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="이전 쪽">
              <IconChevronLeft size={16} stroke={2} />
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" onClick={() => setPage(i)} aria-current={i === current ? "page" : undefined}>
                {i + 1}
              </button>
            ))}
            <button type="button" onClick={() => setPage(current + 1)} disabled={current === pages - 1} aria-label="다음 쪽">
              <IconChevronRight size={16} stroke={2} />
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
