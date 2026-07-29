"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
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

// 항성 표면의 "끓어오르는 플라즈마" 질감을 만드는 심플렉스 노이즈 (Ashima Arts, MIT License) + fbm.
const noiseGLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 4; i++) {
    value += amplitude * snoise(p);
    p *= 2.05;
    amplitude *= 0.5;
  }
  return value;
}
`;

const starVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const starFragmentShader = `
uniform float uTime;
uniform vec3 uColorDark;
uniform vec3 uColorBright;
varying vec3 vNormal;
varying vec3 vPosition;
${noiseGLSL}
void main() {
  vec3 p = normalize(vPosition) * 2.4 + vec3(0.0, 0.0, uTime * 0.08);
  float n = fbm(p) * 0.5 + 0.5;
  vec3 color = mix(uColorDark, uColorBright, smoothstep(0.25, 0.85, n));
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.0);
  color += uColorBright * fresnel * 1.6;
  gl_FragColor = vec4(color, 1.0);
}
`;

// 노드 구체를 항성 표면처럼 렌더링 — 시간에 따라 끓어오르는 노이즈 + 가장자리 발광(fresnel).
function StarMaterial({ color }: { color: string }) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorDark: { value: new THREE.Color(color).multiplyScalar(0.5) },
      uColorBright: { value: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.7) },
    }),
    [color]
  );
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <shaderMaterial
      ref={ref}
      uniforms={uniforms}
      vertexShader={starVertexShader}
      fragmentShader={starFragmentShader}
      toneMapped={false}
    />
  );
}

// 노드를 항성처럼 보이게 하는 발광 텍스처 — 캔버스로 방사형 그라디언트를 한 번만 그려서 재사용한다.
let glowTexture: THREE.Texture | null = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

// 나선 은하 형태로 배치한 배경 파티클 — 이미지 없이 코드로 생성해 팔레트와 자연스럽게 어울린다.
function GalaxyField({ count = 2000, radius = 24, arms = 3, spin = 1.4 }: { count?: number; radius?: number; arms?: number; spin?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const core = new THREE.Color("#fff3d6");
    const outer = [new THREE.Color(ACCENT), new THREE.Color(ACCENT2), new THREE.Color(ACCENT3), new THREE.Color("#8ea6ff")];
    for (let i = 0; i < count; i++) {
      const rand = pseudo(i * 1.618 + 3);
      const r = Math.pow(rand, 1.7) * radius;
      const armOffset = ((i % arms) / arms) * Math.PI * 2;
      const spinAngle = r * spin;
      const scatterSpread = 0.22 + (r / radius) * 0.5;
      const scatter = (pseudo(i * 3.14 + 9) - 0.5) * scatterSpread;
      const theta = armOffset + spinAngle + scatter;
      const thickness = (pseudo(i * 7.77 + 4) - 0.5) * (0.55 + (1 - r / radius) * 0.35);
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = thickness;
      pos[i * 3 + 2] = Math.sin(theta) * r;

      const mixT = Math.min(1, r / radius);
      const c = core.clone().lerp(outer[i % outer.length], Math.pow(mixT, 0.7));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, [count, radius, arms, spin]);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.012;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.032} vertexColors transparent opacity={0.55} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

// 은하 중심부의 은은한 광채 — 발광 텍스처 스프라이트를 크게 깔아 코어가 밝게 빛나는 느낌을 준다.
function GalaxyCoreGlow() {
  const texture = useMemo(() => getGlowTexture(), []);
  return (
    <sprite scale={[9, 9, 1]} position={[0, 0, 0]} raycast={() => null}>
      <spriteMaterial map={texture} color="#fff3d6" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </sprite>
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
  const texture = useMemo(() => getGlowTexture(), []);
  const glowScale = radius * (active ? 6.5 : 5);
  const labelRef = useRef<HTMLDivElement>(null);

  // 카메라 기준 뒤쪽(먼) 노드의 라벨일수록 반투명해져 앞쪽 글자와 겹쳐 보이지 않게 한다.
  useFrame(({ camera }) => {
    if (!labelRef.current) return;
    const dist = camera.position.distanceTo(position);
    const camDist = camera.position.length();
    const t = THREE.MathUtils.clamp((dist - camDist + 2.2) / 4.5, 0, 1);
    const opacity = active ? 1 : THREE.MathUtils.lerp(1, 0.15, t);
    labelRef.current.style.opacity = String(opacity);
  });

  return (
    <group position={position}>
      {/* 항성 코로나 — 발광 텍스처를 입힌 스프라이트, 클릭/호버 판정에서 제외 */}
      <sprite scale={[glowScale, glowScale, 1]} raycast={() => null}>
        <spriteMaterial map={texture} color={color} transparent opacity={active ? 0.95 : 0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
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
        <sphereGeometry args={[radius, 32, 32]} />
        <StarMaterial color={color} />
      </mesh>
      {label && (
        <Html position={[0, radius + labelOffset, 0]} center style={{ pointerEvents: "none" }} occlude={false}>
          <div ref={labelRef} className={`nn3d-label ${bold ? "nn3d-label-bold" : ""}`}>
            <strong>{label}</strong>
            {sublabel && <span>{sublabel}</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

type PointerVec = { x: number; y: number };

// 드래그 없이 마우스 위치만으로 카메라를 살짝 기울이는 2.5D 패럴랙스 — 항상 기본 각도로 부드럽게 되돌아온다.
function ParallaxRig({ pointer }: { pointer: { current: PointerVec } }) {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Spherical().setFromVector3(new THREE.Vector3(0, 1.9, 9)), []);
  const current = useRef(new THREE.Spherical().copy(base));

  useFrame(() => {
    const targetTheta = base.theta - pointer.current.x * 0.4;
    const targetPhi = THREE.MathUtils.clamp(base.phi - pointer.current.y * 0.22, base.phi - 0.3, base.phi + 0.3);
    current.current.theta += (targetTheta - current.current.theta) * 0.06;
    current.current.phi += (targetPhi - current.current.phi) * 0.06;
    camera.position.setFromSpherical(current.current);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ categories, docs, pointer }: Props & { pointer: { current: PointerVec } }) {
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
      <GalaxyField />
      <GalaxyCoreGlow />
      <ambientLight intensity={0.8} />
      <ParallaxRig pointer={pointer} />

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
  const containerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<PointerVec>({ x: 0, y: 0 });

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  };
  const resetPointer = () => {
    pointer.current.x = 0;
    pointer.current.y = 0;
  };

  return (
    <div
      ref={containerRef}
      className="nx-network-canvas"
      role="img"
      aria-label="카테고리 네트워크 맵 — 마우스를 움직이면 시점이 살짝 따라옵니다"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <Canvas camera={{ position: [0, 1.9, 9], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.75]}>
        <Scene categories={categories} docs={docs} pointer={pointer} />
      </Canvas>
    </div>
  );
}
