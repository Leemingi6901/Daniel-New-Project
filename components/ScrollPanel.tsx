"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollItem {
  /** 서버 컴포넌트 경계를 넘길 수 있도록 아이콘 컴포넌트 참조 대신 렌더링된 엘리먼트로 받는다 */
  icon: ReactNode;
  /** "R, G, B" 형태의 accent 색상 — CSS 변수로 꽂아서 rgba()에 재사용한다 */
  accent: string;
  content: ReactNode;
}

interface ScrollPanelProps {
  /** 왼쪽 sticky 컬럼 위쪽에 함께 붙어서 내려가는 섹션 헤더(eyebrow/h2/intro) */
  header?: ReactNode;
  items: ScrollItem[];
}

/**
 * animejs.com의 "스크롤이 곧 타임라인" 데모 패널을 참고한 섹션 레이아웃 — 오른쪽에 내용
 * 블록이 쌓여있고, 왼쪽은 헤더+아이콘 패널이 통째로 sticky로 붙어있다가 지금 뷰포트
 * 중앙을 지나는 블록에 맞춰 아이콘·색을 크로스페이드한다. About/Projects/Wiki 세 섹션이
 * 전부 이 컴포넌트 하나를 공유한다.
 */
export default function ScrollPanel({ header, items }: ScrollPanelProps) {
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
    <div className="nx-scroll-panel">
      <div className="nx-scroll-sticky">
        {header && <div className="nx-scroll-header">{header}</div>}
        <div className="nx-scroll-visual" style={{ "--nx-scroll-accent": items[active].accent } as React.CSSProperties}>
          <div className="nx-scroll-glow" />
          {items.map((it, i) => (
            <div key={i} className={`nx-scroll-icon-wrap ${i === active ? "is-active" : ""}`}>
              {it.icon}
            </div>
          ))}
          <div className="nx-scroll-dots">
            {items.map((_, i) => (
              <span key={i} className={i === active ? "is-active" : ""} />
            ))}
          </div>
        </div>
      </div>

      <div className="nx-scroll-list">
        {items.map((it, i) => (
          <div
            key={i}
            ref={(el) => {
              blockRefs.current[i] = el;
            }}
            className={`nx-scroll-block ${i === active ? "is-active" : ""}`}
          >
            <span className="nx-scroll-index">0{i + 1}</span>
            {it.content}
          </div>
        ))}
      </div>
    </div>
  );
}
