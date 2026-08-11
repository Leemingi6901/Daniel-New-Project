"use client";

import { Children, useEffect, useRef } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** 켜면 직접 자식들을 한 박자씩 늦게(순서대로) 등장시킨다 — eyebrow → 헤드라인 → 본문 */
  stagger?: boolean;
}

export default function Reveal({ children, className = "", stagger = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (stagger) {
    return (
      <div ref={ref} className={`reveal-group ${className}`}>
        {Children.map(children, (child, i) => (
          <div className="reveal-child" style={{ transitionDelay: `${i * 0.09}s` }}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
