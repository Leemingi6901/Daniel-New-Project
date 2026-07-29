"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const ACCENT = "#22d3ee";
const ACCENT2 = "#fb7185";
const ACCENT3 = "#a3e635";

type Pt = { x: number; y: number };

// 카테고리/문서 노드 배치용 결정론적 "무작위" — 서버/클라이언트가 항상 같은 값을 내야 한다.
function pseudo(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// 삼각함수 연산 체인 끝에서 서버/클라이언트의 미세한 부동소수점 오차가 그대로 문자열로
// 직렬화되면 하이드레이션 불일치가 나기 때문에, 좌표를 그리기 직전 소수 둘째 자리로 반올림한다.
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function clampPoint(p: Pt, w: number, h: number, margin: number): Pt {
  return {
    x: round2(clamp(p.x, margin, w - margin)),
    y: round2(clamp(p.y, margin, h - margin)),
  };
}

// 카메라 회전 없이도 입체감이 느껴지도록, 각 노드에 고정된 가상의 깊이(z)를 부여한다.
// z가 클수록 "카메라에 가까운" 노드로 취급해 크고 밝고 선명하게, 작을수록 멀리 흐릿하게 그린다.
function depthScale(z: number) {
  return 0.68 + z * 0.5;
}
function depthOpacity(z: number) {
  return 0.55 + z * 0.45;
}
function depthBlur(z: number) {
  return round2(Math.max(0, (0.82 - z) * 3));
}

// 완전한 원형 대신 각도·반경에 살짝 흔들림을 줘서 손으로 흩뿌린 듯한 비정형 배치를 만든다.
function categoryPoint(i: number, n: number, w: number, h: number): Pt {
  const cx = w / 2;
  const cy = h / 2;
  const baseAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
  const jitter = (pseudo(i * 13.7 + 1) - 0.5) * 0.55;
  const angle = baseAngle + jitter;
  const rx = w * 0.3 * (0.8 + pseudo(i * 7.3 + 2) * 0.4);
  const ry = h * 0.32 * (0.8 + pseudo(i * 5.1 + 3) * 0.4);
  return clampPoint({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }, w, h, Math.min(w, h) * 0.14);
}

// 완전 무작위 각도 대신 문서 개수만큼 슬롯을 고르게 나눈 뒤 살짝만 흔들어서, 문서가 많은
// 카테고리에서도 라벨이 한쪽으로 몰려 겹치지 않게 한다. 반경도 문서 수에 비례해 넓힌다.
function leafPoint(center: Pt, index: number, count: number, seedBase: number, w: number, h: number): Pt {
  const slots = Math.max(count, 1);
  const baseAngle = (index / slots) * Math.PI * 2;
  const jitter = (pseudo(seedBase + index * 3.1) - 0.5) * (Math.PI / Math.max(slots, 2)) * 1.3;
  const angle = baseAngle + jitter;
  const spreadBase = Math.min(w, h) * (0.15 + Math.min(count, 8) * 0.013);
  const r = spreadBase * (0.62 + pseudo(seedBase + index * 5.7 + 1) * 0.65);
  const raw = { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r * 0.82 };
  return clampPoint(raw, w, h, Math.min(w, h) * 0.06);
}

// 직선 대신 살짝 휘어진 곡선으로 이어 유기적인 느낌을 준다.
function curvePath(a: Pt, b: Pt, seed: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = (pseudo(seed) - 0.5) * len * 0.32;
  const cx = round2(mx + nx * bend);
  const cy = round2(my + ny * bend);
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

interface NodeProps {
  pos: Pt;
  r: number;
  color: string;
  glowId: string;
  active: boolean;
  label?: string;
  sublabel?: string;
  bold?: boolean;
  labelMode: "always" | "hover";
  scale: number;
  blur: number;
  glowOpacity: number;
  labelOpacity: number;
  onEnter: () => void;
  onLeave: () => void;
  onClick?: () => void;
}

function Node2D({
  pos,
  r,
  color,
  glowId,
  active,
  label,
  sublabel,
  bold,
  labelMode,
  scale,
  blur,
  glowOpacity,
  labelOpacity,
  onEnter,
  onLeave,
  onClick,
}: NodeProps) {
  const finalLabelOpacity = active ? 1 : labelMode === "hover" ? 0 : labelOpacity;
  const finalGlowOpacity = active ? Math.max(glowOpacity, 0.9) : glowOpacity;
  const scaledR = round2(r * scale);

  return (
    <g
      transform={`translate(${pos.x} ${pos.y})`}
      className={`nx-node${active ? " is-active" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <g style={blur > 0.05 ? { filter: `blur(${blur}px)` } : undefined}>
        <circle r={scaledR * 3.4} className="nx-node-glow" fill={`url(#${glowId})`} style={{ opacity: finalGlowOpacity }} />
        <circle r={scaledR} className="nx-node-core" fill={color} />
      </g>
      {label && (
        <text y={scaledR + 16} textAnchor="middle" className={`nx-node-label${bold ? " is-bold" : ""}`} style={{ opacity: finalLabelOpacity }}>
          {label}
        </text>
      )}
      {sublabel && (
        <text y={scaledR + 30} textAnchor="middle" className="nx-node-sublabel" style={{ opacity: finalLabelOpacity }}>
          {sublabel}
        </text>
      )}
    </g>
  );
}

function NetworkSvg({ width, height, categories, docs }: Props & { width: number; height: number }) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  const hub: Pt = { x: round2(width / 2), y: round2(height / 2) };
  const maxCount = Math.max(1, ...categories.map((c) => c.count));
  const hubR = round2(Math.min(width, height) * 0.075);

  const catPositions = useMemo(() => {
    const map = new Map<string, Pt>();
    categories.forEach((c, i) => map.set(c.key, categoryPoint(i, categories.length, width, height)));
    return map;
  }, [categories, width, height]);

  const catDepth = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c, i) => map.set(c.key, 0.45 + pseudo(i * 9.1 + 21) * 0.4));
    return map;
  }, [categories]);

  const leafPositions = useMemo(() => {
    const map = new Map<string, Pt>();
    categories.forEach((c, i) => {
      const pos = catPositions.get(c.key)!;
      const catDocs = docs.filter((d) => d.category === c.key);
      const seedBase = c.key.length * 7 + i * 11;
      catDocs.forEach((d, j) => {
        map.set(`${d.category}/${d.slug}`, leafPoint(pos, j, catDocs.length, seedBase, width, height));
      });
    });
    return map;
  }, [categories, docs, catPositions, width, height]);

  const nodes = useMemo(() => {
    const list: (NodeProps & { key: string })[] = [
      {
        key: "hub",
        pos: hub,
        r: hubR,
        color: ACCENT,
        glowId: "glow-accent",
        active: active === "hub",
        label: "Tech Wiki",
        sublabel: "learning graph",
        bold: true,
        labelMode: "always",
        scale: 1,
        blur: 0,
        glowOpacity: 1,
        labelOpacity: 1,
        onEnter: () => setActive("hub"),
        onLeave: () => setActive((k) => (k === "hub" ? null : k)),
      },
    ];

    categories.forEach((c, i) => {
      const pos = catPositions.get(c.key)!;
      const catDocs = docs.filter((d) => d.category === c.key);
      const isCatActive = active === c.key || catDocs.some((d) => active === `${d.category}/${d.slug}`);
      const catR = round2(Math.min(width, height) * (0.034 + (c.count / maxCount) * 0.02));
      const catZ = catDepth.get(c.key)!;

      list.push({
        key: c.key,
        pos,
        r: catR,
        color: ACCENT2,
        glowId: "glow-accent2",
        active: isCatActive,
        label: c.name,
        sublabel: `${c.count} docs`,
        bold: true,
        labelMode: "always",
        scale: depthScale(catZ),
        blur: depthBlur(catZ),
        glowOpacity: depthOpacity(catZ),
        labelOpacity: Math.max(0.8, depthOpacity(catZ)),
        onEnter: () => setActive(c.key),
        onLeave: () => setActive((k) => (k === c.key ? null : k)),
        onClick: () => document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" }),
      });

      catDocs.forEach((d, j) => {
        const leafKey = `${d.category}/${d.slug}`;
        const isDocActive = active === leafKey || active === c.key;
        const leafPos = leafPositions.get(leafKey)!;
        const seedBase = c.key.length * 7 + i * 11;
        const leafZ = clamp(catZ + (pseudo(seedBase + j * 2.9 + 31) - 0.5) * 0.6, 0.1, 0.95);
        const short = d.title.length > 14 ? d.title.slice(0, 13) + "…" : d.title;

        list.push({
          key: leafKey,
          pos: leafPos,
          r: round2(Math.min(width, height) * 0.014),
          color: ACCENT3,
          glowId: "glow-accent3",
          active: isDocActive,
          label: short,
          labelMode: "hover",
          scale: depthScale(leafZ),
          blur: depthBlur(leafZ),
          glowOpacity: depthOpacity(leafZ),
          labelOpacity: 1,
          onEnter: () => setActive(leafKey),
          onLeave: () => setActive((k) => (k === leafKey ? null : k)),
          onClick: () => router.push(`/wiki/${d.category}/${d.slug}`),
        });
      });
    });

    // 먼 노드(z가 작은)를 먼저, 가까운 노드를 나중에 그려 가까운 쪽이 겹칠 때 자연스럽게 앞에 놓이게 한다.
    return list.sort((a, b) => a.scale - b.scale);
  }, [categories, docs, catPositions, catDepth, leafPositions, active, width, height, hub, hubR, maxCount, router]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="nx-network-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        {[
          ["glow-accent", ACCENT],
          ["glow-accent2", ACCENT2],
          ["glow-accent3", ACCENT3],
        ].map(([id, color]) => (
          <radialGradient key={id} id={id} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <stop offset="55%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {categories.map((c, i) => {
        const pos = catPositions.get(c.key)!;
        const catDocs = docs.filter((d) => d.category === c.key);
        const isCatActive = active === c.key || catDocs.some((d) => active === `${d.category}/${d.slug}`);

        return (
          <g key={c.key}>
            <path d={curvePath(hub, pos, i * 3.3 + 1)} className={`nx-edge${isCatActive ? " is-active" : ""}`} stroke={ACCENT} fill="none" />
            {catDocs.map((d, j) => {
              const leafKey = `${d.category}/${d.slug}`;
              const isDocActive = active === leafKey || active === c.key;
              const leafPos = leafPositions.get(leafKey)!;
              const seedBase = c.key.length * 7 + i * 11;
              return (
                <path
                  key={leafKey}
                  d={curvePath(pos, leafPos, seedBase + j * 4.4 + 2)}
                  className={`nx-edge nx-edge-leaf${isDocActive ? " is-active" : ""}`}
                  stroke={ACCENT3}
                  fill="none"
                />
              );
            })}
          </g>
        );
      })}

      {nodes.map(({ key, ...n }) => (
        <Node2D key={key} {...n} />
      ))}
    </svg>
  );
}

export default function NeuralNetworkOrganic({ categories, docs }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="nx-network-svg-wrap" role="img" aria-label="카테고리 네트워크 맵">
      <NetworkSvg width={size.w} height={size.h} categories={categories} docs={docs} />
    </div>
  );
}
