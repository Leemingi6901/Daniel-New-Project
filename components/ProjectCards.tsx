"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import Reveal from "@/components/Reveal";

interface Project {
  name: string;
  period: string;
  description: string;
  stack: string[];
  link: string | null;
  linkLabel: string;
}

export default function ProjectCards({ items }: { items: Project[] }) {
  const [active, setActive] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const current = active !== null ? items[active] : null;

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <>
      <div className="nx-carousel">
        <div className="nx-projects" ref={trackRef}>
          {items.map((p, i) => (
            <Reveal key={p.name} className={`delay-${i % 3}`}>
              <button type="button" className="nx-project nx-card-btn" onClick={() => setActive(i)}>
                <div className="nx-project-head">
                  <h3>{p.name}</h3>
                  <span className="nx-project-period">{p.period}</span>
                </div>
                <p>{p.description}</p>
                <div className="nx-project-foot">
                  <div className="nx-stack">
                    {p.stack.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  <span className={`nx-project-link ${p.link ? "" : "nx-project-private"}`}>{p.linkLabel}</span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        {items.length > 3 && (
          <div className="nx-carousel-controls">
            <button type="button" className="nx-carousel-btn" onClick={() => scrollByPage(-1)} aria-label="이전 프로젝트">
              ‹
            </button>
            <button type="button" className="nx-carousel-btn" onClick={() => scrollByPage(1)} aria-label="다음 프로젝트">
              ›
            </button>
          </div>
        )}
      </div>

      <Modal open={current !== null} onClose={() => setActive(null)}>
        {current && (
          <>
            <span className="nx-modal-eyebrow">{current.period}</span>
            <h3 className="nx-modal-title">{current.name}</h3>
            <p className="nx-modal-body">{current.description}</p>
            <div className="nx-modal-project-stack">
              {current.stack.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            {current.link ? (
              <a href={current.link} target="_blank" rel="noreferrer" className="nx-btn">
                {current.linkLabel}
              </a>
            ) : (
              <span className="nx-project-link nx-project-private">{current.linkLabel}</span>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
