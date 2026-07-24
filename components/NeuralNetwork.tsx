"use client";

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

const CAT_POS: Record<string, { x: number; y: number }> = {
  ai: { x: 210, y: 150 },
  web: { x: 700, y: 130 },
  infra: { x: 185, y: 455 },
  tools: { x: 715, y: 465 },
};

function leafPositions(cx: number, cy: number, n: number): { x: number; y: number }[] {
  // 허브 반대 방향으로 부채꼴 배치
  const away = Math.atan2(cy - HUB.y, cx - HUB.x);
  const spread = Math.PI * 0.7;
  const r = 105;
  return Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? away : away - spread / 2 + (spread * i) / (n - 1);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

export default function NeuralNetwork({ categories, docs }: Props) {
  const router = useRouter();

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
        const p = CAT_POS[c.key];
        if (!p) return null;
        const id = `e-${c.key}`;
        const dur = 3.2 + i * 0.7;
        return (
          <g key={id}>
            <path id={id} d={`M${HUB.x},${HUB.y} L${p.x},${p.y}`} className="nn-edge" />
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
        const p = CAT_POS[c.key];
        if (!p) return null;
        const catDocs = docs.filter((d) => d.category === c.key);
        const leaves = leafPositions(p.x, p.y, catDocs.length);
        return catDocs.map((d, i) => (
          <path
            key={`${d.category}/${d.slug}-edge`}
            d={`M${p.x},${p.y} L${leaves[i].x},${leaves[i].y}`}
            className="nn-edge nn-edge-thin nn-edge-flow"
          />
        ));
      })}

      {/* 문서 리프 노드 */}
      {categories.map((c) => {
        const p = CAT_POS[c.key];
        if (!p) return null;
        const catDocs = docs.filter((d) => d.category === c.key);
        const leaves = leafPositions(p.x, p.y, catDocs.length);
        return catDocs.map((d, i) => {
          const short = d.title.length > 14 ? d.title.slice(0, 13) + "…" : d.title;
          const anchor = leaves[i].x < p.x - 10 ? "end" : leaves[i].x > p.x + 10 ? "start" : "middle";
          return (
            <g
              key={`${d.category}/${d.slug}`}
              className="nn-node nn-doc"
              style={{ animationDelay: `${(i * 0.7 + 0.3).toFixed(1)}s` }}
              onClick={() => router.push(`/wiki/${d.category}/${d.slug}`)}
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
        const p = CAT_POS[c.key];
        if (!p) return null;
        return (
          <g
            key={c.key}
            className="nn-node nn-cat"
            style={{ animationDelay: `${i * 0.9}s` }}
            onClick={() => document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" })}
            role="link"
            aria-label={`${c.name} 카테고리`}
          >
            <circle cx={p.x} cy={p.y} r="34" filter="url(#soft)" />
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
          r="46"
          className="nn-radar"
          style={{
            stroke: i % 2 === 0 ? "var(--nx-accent)" : "var(--nx-accent2)",
            animationDelay: `${i * 1.4}s`,
          }}
        />
      ))}

      {/* 중앙 허브 */}
      <g className="nn-node nn-hub">
        <circle cx={HUB.x} cy={HUB.y} r="120" fill="url(#hubGlow)" />
        <circle cx={HUB.x} cy={HUB.y} r="46" filter="url(#soft)" />
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
