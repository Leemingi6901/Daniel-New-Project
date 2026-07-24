"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CatNode {
  key: string;
  name: string;
  count: number;
}

interface DocNode {
  category: string;
  slug: string;
  title: string;
}

interface Props {
  categories: CatNode[];
  docs: DocNode[];
}

const HUB = { x: 450, y: 300 };

// 각 카테고리마다 각도·반경을 다르게 줘서 완전 대칭인 X자 배치를 깨뜨린다.
const CAT_LAYOUT: Record<string, { angle: number; radius: number }> = {
  ai: { angle: 205, radius: 275 },
  web: { angle: 332, radius: 295 },
  infra: { angle: 158, radius: 260 },
  tools: { angle: 22, radius: 285 },
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function catPos(key: string): { x: number; y: number } | null {
  const l = CAT_LAYOUT[key];
  if (!l) return null;
  const rad = (l.angle * Math.PI) / 180;
  return {
    x: round(HUB.x + Math.cos(rad) * l.radius),
    y: round(HUB.y + Math.sin(rad) * l.radius),
  };
}

// 문서 키(카테고리 안 순번)로부터 결정론적 "무작위" 값을 뽑는다 — 서버/클라이언트가 항상 같은 값을 내야 하므로 Math.random 대신 사용.
function pseudo(seed: number) {
  return Math.sin(seed * 12.9898) * 43758.5453 % 1;
}

function leafPositions(cx: number, cy: number, n: number, seedBase: number): { x: number; y: number }[] {
  const away = Math.atan2(cy - HUB.y, cx - HUB.x);
  const spread = Math.PI * 0.72;
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const jitterA = pseudo(seedBase + i * 3.1) * 0.16 - 0.08;
    const jitterR = pseudo(seedBase + i * 5.7 + 1) * 22 - 11;
    const a = away - spread / 2 + spread * t + jitterA;
    const r = 100 + jitterR;
    return { x: round(cx + Math.cos(a) * r), y: round(cy + Math.sin(a) * r) };
  });
}

// 완전한 직선 대신 살짝 휜 곡선 — 유기적인 느낌을 준다.
function curvePath(x1: number, y1: number, x2: number, y2: number, bow: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = round(mx + nx * bow);
  const cy = round(my + ny * bow);
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export default function NeuralNetwork({ categories, docs }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const spawnRipple = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x, y }]);
  };

  const removeRipple = (id: number) => {
    setRipples((r) => r.filter((rp) => rp.id !== id));
  };

  const maxCount = Math.max(1, ...categories.map((c) => c.count));
  const catRadius = (count: number) => round(26 + (count / maxCount) * 18);

  return (
    <svg className="nn" viewBox="0 0 900 620" role="img" aria-label="카테고리 네트워크 맵">
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 간선 + 펄스 */}
      {categories.map((c, i) => {
        const p = catPos(c.key);
        if (!p) return null;
        const id = `e-${c.key}`;
        const dur = 3.2 + i * 0.7;
        const catDocs = docs.filter((d) => d.category === c.key);
        const isActive = active === c.key || catDocs.some((d) => active === `${d.category}/${d.slug}`);
        const bow = 16 + (i % 3) * 9 * (i % 2 === 0 ? 1 : -1);
        return (
          <g key={id}>
            <path id={id} d={curvePath(HUB.x, HUB.y, p.x, p.y, bow)} className={`nn-edge ${isActive ? "is-active" : ""}`} />
            <circle r="3.2" className="nn-pulse">
              <animateMotion dur={`${dur}s`} repeatCount="indefinite">
                <mpath href={`#${id}`} />
              </animateMotion>
            </circle>
            <circle r="2.2" className="nn-pulse nn-pulse-alt">
              <animateMotion dur={`${dur}s`} begin={`${dur / 2}s`} repeatCount="indefinite">
                <mpath href={`#${id}`} />
              </animateMotion>
            </circle>
          </g>
        );
      })}
      {categories.map((c) => {
        const p = catPos(c.key);
        if (!p) return null;
        const catDocs = docs.filter((d) => d.category === c.key);
        const seedBase = c.key.length * 7 + p.x * 0.01;
        const leaves = leafPositions(p.x, p.y, catDocs.length, seedBase);
        return catDocs.map((d, i) => {
          const leafKey = `${d.category}/${d.slug}`;
          const isActive = active === leafKey || active === c.key;
          const bow = 8 + (i % 2 === 0 ? 1 : -1) * (6 + i * 2);
          return (
            <path
              key={`${leafKey}-edge`}
              d={curvePath(p.x, p.y, leaves[i].x, leaves[i].y, bow)}
              className={`nn-edge nn-edge-thin nn-edge-flow ${isActive ? "is-active" : ""}`}
            />
          );
        });
      })}

      {/* 문서 리프 노드 */}
      {categories.map((c) => {
        const p = catPos(c.key);
        if (!p) return null;
        const catDocs = docs.filter((d) => d.category === c.key);
        const seedBase = c.key.length * 7 + p.x * 0.01;
        const leaves = leafPositions(p.x, p.y, catDocs.length, seedBase);
        return catDocs.map((d, i) => {
          const short = d.title.length > 14 ? d.title.slice(0, 13) + "…" : d.title;
          const anchor = leaves[i].x < p.x - 10 ? "end" : leaves[i].x > p.x + 10 ? "start" : "middle";
          const leafKey = `${d.category}/${d.slug}`;
          return (
            <g
              key={leafKey}
              className="nn-node nn-doc"
              style={{ animationDelay: `${(i * 0.7 + 0.3).toFixed(1)}s` }}
              onPointerEnter={() => setActive(leafKey)}
              onPointerLeave={() => setActive((k) => (k === leafKey ? null : k))}
              onClick={() => {
                spawnRipple(leaves[i].x, leaves[i].y);
                router.push(`/wiki/${d.category}/${d.slug}`);
              }}
              role="link"
              aria-label={d.title}
            >
              <circle cx={leaves[i].x} cy={leaves[i].y} r="7" />
              <text x={leaves[i].x + (anchor === "end" ? -14 : anchor === "start" ? 14 : 0)} y={leaves[i].y + (anchor === "middle" ? 24 : 4)} textAnchor={anchor}>
                {short}
              </text>
            </g>
          );
        });
      })}

      {/* 카테고리 노드 */}
      {categories.map((c, i) => {
        const p = catPos(c.key);
        if (!p) return null;
        return (
          <g
            key={c.key}
            className="nn-node nn-cat"
            style={{ animationDelay: `${i * 0.9}s` }}
            onPointerEnter={() => setActive(c.key)}
            onPointerLeave={() => setActive((k) => (k === c.key ? null : k))}
            onClick={() => {
              spawnRipple(p.x, p.y);
              document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" });
            }}
            role="link"
            aria-label={`${c.name} 카테고리`}
          >
            <circle cx={p.x} cy={p.y} r={catRadius(c.count)} filter="url(#soft)" />
            <text x={p.x} y={p.y - 2} textAnchor="middle" className="nn-cat-name">
              {c.name}
            </text>
            <text x={p.x} y={p.y + 15} textAnchor="middle" className="nn-cat-count">
              {c.count} docs
            </text>
          </g>
        );
      })}

      {/* 레이더 핑 */}
      {[0, 1, 2].map((i) => (
        <circle
          key={`radar-${i}`}
          cx={HUB.x}
          cy={HUB.y}
          r="54"
          className="nn-radar"
          style={{
            stroke: i % 2 === 0 ? "var(--nx-accent)" : "var(--nx-accent2)",
            animationDelay: `${i * 1.4}s`,
          }}
        />
      ))}

      {/* 클릭/터치 리플 */}
      {ripples.map((rp) => (
        <circle
          key={rp.id}
          cx={rp.x}
          cy={rp.y}
          r="8"
          className="nn-ripple"
          onAnimationEnd={() => removeRipple(rp.id)}
        />
      ))}

      {/* 중앙 허브 */}
      <g
        className="nn-node nn-hub"
        onPointerEnter={() => setActive("hub")}
        onPointerLeave={() => setActive((k) => (k === "hub" ? null : k))}
        onClick={() => spawnRipple(HUB.x, HUB.y)}
      >
        <circle cx={HUB.x} cy={HUB.y} r="132" fill="url(#hubGlow)" />
        <circle cx={HUB.x} cy={HUB.y} r="54" filter="url(#soft)" />
        <text x={HUB.x} y={HUB.y - 2} textAnchor="middle" className="nn-hub-title">
          Tech Wiki
        </text>
        <text x={HUB.x} y={HUB.y + 16} textAnchor="middle" className="nn-hub-sub">
          learning graph
        </text>
      </g>
    </svg>
  );
}
