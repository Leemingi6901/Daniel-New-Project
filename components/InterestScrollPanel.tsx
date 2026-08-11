"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Interest {
  title: string;
  body: string;
  /** 서버 컴포넌트 경계를 넘길 수 있도록 아이콘 컴포넌트 참조 대신 렌더링된 엘리먼트로 받는다 */
  icon: ReactNode;
  accent: string;
}

/**
 * animejs.com의 "스크롤이 곧 타임라인" 데모 패널을 참고한 섹션 — 오른쪽에 텍스트 블록이
 * 쌓여있고, 왼쪽 패널은 sticky로 붙어있다가 지금 뷰포트 중앙을 지나는 블록에 맞춰
 * 아이콘·색을 크로스페이드한다. 정적 카드 목록보다 "스크롤하는 동안 뭔가 계속 반응한다"는
 * 느낌을 준다.
 */
export default function InterestScrollPanel({ items }: { items: Interest[] }) {
  const [active, setActive] = useState(0);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = blockRefs.current.findIndex((el) => el === e.target);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    for (const el of blockRefs.current) {
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <div className="nx-interest-scroll">
      <div className="nx-interest-visual" style={{ "--nx-interest-accent": items[active].accent } as React.CSSProperties}>
        <div className="nx-interest-glow" />
        {items.map((it, i) => (
          <div key={it.title} className={`nx-interest-icon-wrap ${i === active ? "is-active" : ""}`}>
            {it.icon}
          </div>
        ))}
        <div className="nx-interest-dots">
          {items.map((it, i) => (
            <span key={it.title} className={i === active ? "is-active" : ""} />
          ))}
        </div>
      </div>

      <div className="nx-interest-list">
        {items.map((it, i) => (
          <div key={it.title} ref={(el) => { blockRefs.current[i] = el; }} className={`nx-interest-block ${i === active ? "is-active" : ""}`}>
            <span className="nx-interest-index">0{i + 1}</span>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
