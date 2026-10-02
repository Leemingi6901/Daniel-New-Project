"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { IconBrain, IconCode, IconServer2, IconTools, IconChevronDown, IconListDetails, IconSearch, IconX } from "@tabler/icons-react";
import { matchesQuery } from "@/lib/search";

export interface NavDoc {
  category: string;
  slug: string;
  title: string;
  label: string;
  pinned: boolean;
  description: string;
  tags: string[];
}

export type NavItem = { type: "doc"; doc: NavDoc } | { type: "series"; name: string; docs: NavDoc[] };

export interface NavCategory {
  key: string;
  name: string;
  count: number;
  items: NavItem[];
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  ai: <IconBrain size={16} stroke={1.8} />,
  web: <IconCode size={16} stroke={1.8} />,
  infra: <IconServer2 size={16} stroke={1.8} />,
  tools: <IconTools size={16} stroke={1.8} />,
};

const hrefOf = (d: NavDoc) => `/wiki/${d.category}/${d.slug}`;

/** 위키 글 화면 왼쪽 목록 — 카테고리별로 접고 펴며, 지금 보는 글의 카테고리·시리즈만 펼쳐 둔다 */
export default function SidebarNav({ categories, total }: { categories: NavCategory[]; total: number }) {
  const pathname = usePathname();
  const [, , activeCat] = pathname.split("/"); // /wiki/<category>/<slug>
  const activeSeries = categories
    .find((c) => c.key === activeCat)
    ?.items.find((it) => it.type === "series" && it.docs.some((d) => hrefOf(d) === pathname));

  const [open, setOpen] = useState<Set<string>>(() => new Set([activeCat, activeSeries?.type === "series" ? `s:${activeSeries.name}` : ""]));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  // 다른 글로 이동하면 그 글의 카테고리·시리즈를 펼치고, 모바일 목록은 닫는다
  useEffect(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.add(activeCat);
      if (activeSeries?.type === "series") next.add(`s:${activeSeries.name}`);
      return next;
    });
    setMobileOpen(false);
  }, [pathname, activeCat, activeSeries]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allDocs = categories.flatMap((c) => c.items.flatMap((it) => (it.type === "doc" ? [it.doc] : it.docs)));
  const results = query.trim() ? allDocs.filter((d) => matchesQuery(d, query)) : null;
  const nameOf = (key: string) => categories.find((c) => c.key === key)?.name ?? "";

  const docLink = (d: NavDoc) => {
    const active = hrefOf(d) === pathname;
    return (
      <Link href={hrefOf(d)} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined} title={d.title}>
        <span className="sb-label">{d.label}</span>
        {d.pinned && <span className="sb-pick">추천</span>}
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <button type="button" className="sb-mobile-toggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
        <IconListDetails size={16} stroke={1.8} />
        카테고리별 문서 <span className="sb-count">{total}</span>
        <IconChevronDown size={16} stroke={2} className="sb-chev" />
      </button>

      <nav className={`sb-nav${mobileOpen ? " is-open" : ""}`} aria-label="문서 목록">
        <label className="sb-search">
          <IconSearch size={15} stroke={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="문서 검색"
            aria-label="문서 검색 (제목·요약·태그)"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">
              <IconX size={14} stroke={2} />
            </button>
          )}
        </label>

        {results && (
          <section className="sb-results" aria-live="polite">
            <p className="sb-results-head">
              검색 결과 <span className="sb-count">{results.length}</span>
            </p>
            {results.length === 0 ? (
              <p className="sb-empty">맞는 문서가 없어요. 다른 단어로 찾아보세요.</p>
            ) : (
              <ul className="sb-list">
                {results.map((d) => (
                  <li key={`${d.category}/${d.slug}`}>
                    <Link
                      href={hrefOf(d)}
                      className={hrefOf(d) === pathname ? "is-active" : undefined}
                      title={d.title}
                    >
                      <span className="sb-label">{d.title}</span>
                      <span className="sb-result-cat">{nameOf(d.category)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!results && categories.map((c) => {
          const isOpen = open.has(c.key);
          return (
            <section key={c.key} className={`sb-cat${c.key === activeCat ? " is-current" : ""}`}>
              <button type="button" className="sb-cat-head" aria-expanded={isOpen} onClick={() => toggle(c.key)}>
                <span className="sb-cat-icon">{CATEGORY_ICONS[c.key]}</span>
                <span className="sb-cat-name">{c.name}</span>
                <span className="sb-count">{c.count}</span>
                <IconChevronDown size={15} stroke={2} className="sb-chev" />
              </button>

              {isOpen && (
                <ul className="sb-list">
                  {c.items.map((it) =>
                    it.type === "doc" ? (
                      <li key={it.doc.slug}>{docLink(it.doc)}</li>
                    ) : (
                      <li key={`s:${it.name}`} className="sb-series">
                        <button
                          type="button"
                          className="sb-series-head"
                          aria-expanded={open.has(`s:${it.name}`)}
                          onClick={() => toggle(`s:${it.name}`)}
                        >
                          <span className="sb-label">{it.name}</span>
                          <span className="sb-count">{it.docs.length}</span>
                          <IconChevronDown size={14} stroke={2} className="sb-chev" />
                        </button>
                        {open.has(`s:${it.name}`) && (
                          <ul className="sb-sub">
                            {it.docs.map((d) => (
                              <li key={d.slug}>{docLink(d)}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
