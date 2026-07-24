"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Reveal from "@/components/Reveal";

interface Interest {
  title: string;
  body: string;
}

export default function InterestCards({ items }: { items: Interest[] }) {
  const [active, setActive] = useState<number | null>(null);
  const current = active !== null ? items[active] : null;

  return (
    <>
      <div className="nx-cards nx-cards-3">
        {items.map((it, i) => (
          <Reveal key={it.title} className={`delay-${i}`}>
            <button type="button" className="nx-card nx-card-btn" onClick={() => setActive(i)}>
              <h3>{it.title}</h3>
              <p>{it.body}</p>
            </button>
          </Reveal>
        ))}
      </div>

      <Modal open={current !== null} onClose={() => setActive(null)}>
        {current && (
          <>
            <span className="nx-modal-eyebrow">관심 분야</span>
            <h3 className="nx-modal-title">{current.title}</h3>
            <p className="nx-modal-body">{current.body}</p>
          </>
        )}
      </Modal>
    </>
  );
}
