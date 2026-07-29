"use client";

import { useRef } from "react";
import Link from "next/link";
import Reveal from "@/components/Reveal";

interface Doc {
  category: string;
  categoryName: string;
  slug: string;
  title: string;
  description: string;
  updated: string;
}

export default function DocList({ items }: { items: Doc[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="nx-carousel">
      <div className="nx-doc-track" ref={trackRef}>
        {items.map((d, i) => (
          <Reveal key={`${d.category}/${d.slug}`} className={`delay-${i % 3}`}>
            <Link href={`/wiki/${d.category}/${d.slug}`} className="nx-doc-row">
              <div>
                <strong>{d.title}</strong>
                <p>{d.description}</p>
              </div>
              <div className="nx-doc-side">
                <span className="nx-doc-cat">{d.categoryName}</span>
                <time>{d.updated}</time>
                <span className="nx-doc-arrow">→</span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      {items.length > 2 && (
        <div className="nx-carousel-controls">
          <button type="button" className="nx-carousel-btn" onClick={() => scrollByPage(-1)} aria-label="이전 문서">
            ‹
          </button>
          <button type="button" className="nx-carousel-btn" onClick={() => scrollByPage(1)} aria-label="다음 문서">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
