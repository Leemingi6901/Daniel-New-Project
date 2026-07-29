"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";

// r3f의 자동 리사이즈(useMeasure/ResizeObserver)가 이 레이아웃(clamp 높이 컨테이너)에서
// 간헐적으로 초기 사이즈를 못 잡는 경우가 있어, 컨테이너 크기를 직접 관찰해 렌더러에 반영한다.
function ForceResize() {
  const gl = useThree((s) => s.gl);
  const setSize = useThree((s) => s.setSize);
  useEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gl, setSize]);
  return null;
}

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

// 카테고리/문서 노드 배치용 결정론적 "무작위" — 서버/클라이언트가 항상 같은 값을 내야 한다.
function pseudo(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// 카테고리를 허브 둘레에 고르게 원형 배치 — 모두 같은 반경이라 겹치거나 중심에 몰리지 않는다.
function categoryPoint(i: number, n: number, radius: number) {
  const angle = (i / n) * Math.PI * 2 + Math.PI / n;
  const y = Math.sin(i * 2.7) * 0.75;
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function leafPoint(center: THREE.Vector3, index: number, seedBase: number, radius: number) {
  const theta = pseudo(seedBase + index * 3.1) * Math.PI * 2;
  const phi = Math.acos(2 * pseudo(seedBase + index * 5.7 + 1) - 1);
  const r = radius * (0.7 + pseudo(seedBase + index * 7.3 + 2) * 0.55);
  return center
    .clone()
    .add(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
}

// 배경을 채우는 은하 느낌의 별 입자 — 이미지 없이 순수 파티클로 생성해 팔레트와 자연스럽게 어울린다.
function Starfield({ count = 1600, radius = 26 }: { count?: number; radius?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(ACCENT),
      new THREE.Color(ACCENT2),
      new THREE.Color(ACCENT3),
      new THREE.Color("#e6ecff"),
      new THREE.Color("#e6ecff"),
      new THREE.Color("#e6ecff"),
    ];
    for (let i = 0; i < count; i++) {
      const r = radius * (0.3 + Math.cbrt(pseudo(i * 1.37 + 5)) * 0.7);
      const theta = pseudo(i * 2.19 + 11) * Math.PI * 2;
      const phi = Math.acos(2 * pseudo(i * 3.71 + 17) - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const c = palette[Math.floor(pseudo(i * 5.13 + 23) * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, [count, radius]);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.015;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.8} sizeAttenuation depthWrite={false} toneMapped={false} />
    </points>
  );
}

function EdgePulse({ a, b, color, duration, delay }: { a: THREE.Vector3; b: THREE.Vector3; color: string; duration: number; delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.elapsedTime - delay;
    if (elapsed < 0) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const t = (elapsed % duration) / duration;
    ref.current.position.lerpVectors(a, b, t);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function ClickRipple({ position, color, onDone }: { position: THREE.Vector3; color: string; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const t = (clock.elapsedTime - start.current) / 0.6;
    if (t >= 1) {
      onDone();
      return;
    }
    if (ref.current) ref.current.scale.setScalar(0.3 + t * 3.4);
    if (materialRef.current) materialRef.current.opacity = 0.75 * (1 - t);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.12, 12, 12]} />
      <meshBasicMaterial ref={materialRef} color={color} transparent opacity={0.75} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

interface NodeProps {
  position: THREE.Vector3;
  radius: number;
  color: string;
  active: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  label?: string;
  sublabel?: string;
  labelOffset?: number;
  bold?: boolean;
}

function Node({ position, radius, color, active, onHover, onLeave, onClick, label, sublabel, labelOffset = 0.28, bold }: NodeProps) {
  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onLeave();
          document.body.style.cursor = "auto";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
      >
        <sphereGeometry args={[radius, 20, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {active && (
        <mesh>
          <sphereGeometry args={[radius * 1.9, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {label && (
        <Html position={[0, radius + labelOffset, 0]} center style={{ pointerEvents: "none" }} occlude={false}>
          <div className={`nn3d-label ${bold ? "nn3d-label-bold" : ""}`}>
            <strong>{label}</strong>
            {sublabel && <span>{sublabel}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({ categories, docs }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [ripples, setRipples] = useState<{ id: number; position: THREE.Vector3; color: string }[]>([]);

  const spawnRipple = (position: THREE.Vector3, color: string) => {
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, position, color }]);
  };
  const removeRipple = (id: number) => setRipples((r) => r.filter((rp) => rp.id !== id));

  const hub = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const catPositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    categories.forEach((c, i) => map.set(c.key, categoryPoint(i, categories.length, 3.2)));
    return map;
  }, [categories]);
  const maxCount = Math.max(1, ...categories.map((c) => c.count));

  return (
    <>
      <ForceResize />
      <Starfield />
      <ambientLight intensity={0.8} />
      <OrbitControls
        enableZoom
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.4}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        minDistance={4}
        maxDistance={22}
        target={[0, 0, 0]}
      />

      <Node
        position={hub}
        radius={0.56}
        color={ACCENT}
        active={active === "hub"}
        onHover={() => setActive("hub")}
        onLeave={() => setActive((k) => (k === "hub" ? null : k))}
        onClick={() => spawnRipple(hub.clone(), ACCENT)}
        label="Tech Wiki"
        sublabel="learning graph"
        labelOffset={0.36}
        bold
      />

      {categories.map((c, i) => {
        const pos = catPositions.get(c.key)!;
        const catDocs = docs.filter((d) => d.category === c.key);
        const isCatActive = active === c.key || catDocs.some((d) => active === `${d.category}/${d.slug}`);
        const catRadius = 0.26 + (c.count / maxCount) * 0.18;
        const seedBase = c.key.length * 7 + i * 11;

        return (
          <group key={c.key}>
            <Line points={[hub, pos]} color={ACCENT} lineWidth={isCatActive ? 2.4 : 1.4} transparent opacity={isCatActive ? 1 : 0.5} />
            <EdgePulse a={hub} b={pos} color={i % 2 === 0 ? ACCENT : ACCENT2} duration={3.2 + i * 0.7} delay={i * 0.4} />

            <Node
              position={pos}
              radius={catRadius}
              color={ACCENT2}
              active={isCatActive}
              onHover={() => setActive(c.key)}
              onLeave={() => setActive((k) => (k === c.key ? null : k))}
              onClick={() => {
                spawnRipple(pos.clone(), ACCENT2);
                document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" });
              }}
              label={c.name}
              sublabel={`${c.count} docs`}
              bold
            />

            {catDocs.map((d, j) => {
              const leafKey = `${d.category}/${d.slug}`;
              const isDocActive = active === leafKey || active === c.key;
              const leafPos = leafPoint(pos, j, seedBase, 1.7);
              const short = d.title.length > 16 ? d.title.slice(0, 15) + "…" : d.title;
              return (
                <group key={leafKey}>
                  <Line points={[pos, leafPos]} color={ACCENT3} lineWidth={isDocActive ? 2 : 1.1} transparent opacity={isDocActive ? 1 : 0.4} />
                  <Node
                    position={leafPos}
                    radius={0.11}
                    color={ACCENT3}
                    active={isDocActive}
                    onHover={() => setActive(leafKey)}
                    onLeave={() => setActive((k) => (k === leafKey ? null : k))}
                    onClick={() => {
                      spawnRipple(leafPos.clone(), ACCENT3);
                      router.push(`/wiki/${d.category}/${d.slug}`);
                    }}
                    label={short}
                    labelOffset={0.17}
                  />
                </group>
              );
            })}
          </group>
        );
      })}

      {ripples.map((rp) => (
        <ClickRipple key={rp.id} position={rp.position} color={rp.color} onDone={() => removeRipple(rp.id)} />
      ))}
    </>
  );
}

export default function NeuralNetwork3D({ categories, docs }: Props) {
  return (
    <div className="nx-network-canvas" role="img" aria-label="카테고리 네트워크 맵 — 드래그로 회전할 수 있습니다">
      <Canvas camera={{ position: [0, 2.4, 12], fov: 48 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.75]}>
        <Scene categories={categories} docs={docs} />
      </Canvas>
    </div>
  );
}
