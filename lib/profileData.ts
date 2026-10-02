/** 프로필 데이터 — 화면(클라이언트)과 저장 API(서버)가 함께 쓴다. 저장된 값이 없으면 DEFAULT_PROFILE을 보여 준다. */

export interface Experience {
  company: string;
  period: string;
  role: string;
  desc: string;
}

export interface Education {
  school: string;
  period: string;
  degree: string;
}

export interface Profile {
  name: string;
  role: string;
  summary: string;
  career: string;
  photo: string;
  experience: Experience[];
  education: Education[];
  certs: string[];
  skills: string[];
}

export const DEFAULT_PROFILE: Profile = {
  name: "이민기",
  role: "인프라 엔지니어 · 정보보안 전문가",
  summary:
    "경력 5년 2개월 · AI/GPU 인프라부터 네트워크 보안까지, IT 라이프사이클 전반을 다뤄온 인프라 엔지니어입니다.",
  career: "경력 5년 2개월",
  photo: "/profile.jpg",
  experience: [
    {
      company: "오륜디지탈 (하나금융융합기술원 파견)",
      period: "2024.12 — 재직중",
      role: "SE · 대리",
      desc: "H100/A100 GPU 140장 클러스터 운영, CentOS → Rocky Linux 마이그레이션(130대), Grafana/Zabbix 통합 모니터링",
    },
    {
      company: "하이랜드푸드",
      period: "2023.06 — 2024.12",
      role: "네트워크·운영개발팀 · 선임",
      desc: "Zabbix·Grafana 자체 모니터링 환경 구축, DLP 도입, 전국 3개 거점 방화벽 정책 통합 관리",
    },
    {
      company: "바이오플러스",
      period: "2022.08 — 2023.06",
      role: "경영지원팀 · 주임",
      desc: "신규 사옥 서버실 구축(Rack/UPS/Cabling), 본사-지사 VPN 터널링, NextCloud 프라이빗 클라우드 도입",
    },
    {
      company: "블록체인컴퍼니",
      period: "2022.04 — 2022.07",
      role: "정보보안팀 · 사원",
      desc: "가상자산 거래소 ISMS 인증 심사 대응, 접근통제 정책 재설계, 취약점 점검 및 조치",
    },
    {
      company: "에코넷시스템",
      period: "2021.08 — 2022.04",
      role: "보안영업본부 · 사원",
      desc: "국방·공공기관 대상 SI 제안(RFP) 작성 및 입찰, 서버·보안 장비 구축 지원",
    },
  ],
  education: [
    {
      school: "영진전문대학 (2·3년제)",
      period: "2016.02 — 2022.02",
      degree: "컴퓨터정보계열 네트워크보안 · 전문학사",
    },
    {
      school: "학점은행제",
      period: "2022.12 — 2023.10",
      degree: "컴퓨터정보공학 · 학사",
    },
  ],
  certs: ["리눅스마스터 2급", "네트워크관리사 2급", "1종보통운전면허"],
  skills: [
    "Linux",
    "OpenStack",
    "Docker",
    "NVIDIA GPU",
    "Zabbix",
    "Grafana",
    "Firewall",
    "VPN",
    "ISMS",
    "취약점진단",
    "DLP",
  ],
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = <T,>(v: unknown, max: number, map: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.slice(0, max).filter((x) => x && typeof x === "object").map((x) => map(x as Record<string, unknown>)) : [];
const words = (v: unknown, max: number) =>
  Array.isArray(v) ? v.map((x) => str(x, 40)).filter(Boolean).slice(0, max) : [];

/** 사진은 사이트 기본 파일이거나, 이 사이트 Blob 저장소의 profile/photo 경로만 허용한다 */
export function isAllowedPhoto(url: unknown): url is string {
  if (url === DEFAULT_PROFILE.photo) return true;
  if (typeof url !== "string" || url.length > 300) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/profile/photo");
  } catch {
    return false;
  }
}

/** 저장·표시 전에 모양과 길이를 맞춘다. 이름이 비면 잘못된 값으로 본다. */
export function sanitizeProfile(raw: unknown, fallbackPhoto = DEFAULT_PROFILE.photo): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p: Profile = {
    name: str(r.name, 40),
    role: str(r.role, 80),
    summary: str(r.summary, 400),
    career: str(r.career, 40),
    photo: isAllowedPhoto(r.photo) ? r.photo : fallbackPhoto,
    experience: list(r.experience, 20, (x) => ({
      company: str(x.company, 80),
      period: str(x.period, 40),
      role: str(x.role, 80),
      desc: str(x.desc, 400),
    })).filter((e) => e.company),
    education: list(r.education, 10, (x) => ({
      school: str(x.school, 80),
      period: str(x.period, 40),
      degree: str(x.degree, 80),
    })).filter((e) => e.school),
    certs: words(r.certs, 20),
    skills: words(r.skills, 40),
  };
  return p.name ? p : null;
}
