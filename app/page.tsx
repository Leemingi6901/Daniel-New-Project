import Link from "next/link";
import { CATEGORIES, listDocs } from "@/lib/wiki";
import NeuralNetworkOrganic from "@/components/NeuralNetworkOrganic";
import ProfileCard from "@/components/ProfileCard";
import InterestScrollPanel from "@/components/InterestScrollPanel";
import ProjectCards from "@/components/ProjectCards";
import DocList from "@/components/DocList";
import Reveal from "@/components/Reveal";
import { IconShieldCheck, IconRun, IconMoonStars, IconServer2, IconShieldLock, IconBrain } from "@tabler/icons-react";

const PROJECTS = [
  {
    name: "Daniel Tech Wiki",
    period: "2026 —",
    description: "IT 신기술 학습 노트를 지식 그래프로 엮은 위키. 지금 보고 계신 이 사이트입니다.",
    stack: ["Next.js 16", "SSG", "Vercel"],
    link: "https://github.com/Leemingi6901/Daniel-New-Project",
    linkLabel: "GitHub ↗",
  },
  {
    name: "OpenClaw AI 비서",
    period: "2026",
    description: "맥미니에서 상시 구동되는 텔레그램 AI 비서. 로컬 LLM으로 API 비용 없이 운영합니다.",
    stack: ["OpenClaw", "Ollama", "launchd"],
    link: null,
    linkLabel: "Private",
  },
  {
    name: "Daily Growth",
    period: "2026",
    description: "매일 자정 뉴스와 영어 단어를 자동 수집·요약하는 자기계발 사이트. 크롤링부터 로컬 LLM 가공까지 전 과정 자동화.",
    stack: ["Next.js", "Prisma", "Ollama", "크롤링"],
    link: null,
    linkLabel: "Private",
  },
  {
    name: "RUN-Project",
    period: "2025 —",
    description: "전국 러닝 대회 정보를 모아 보여주는 서비스. 매일 자동 크롤링으로 최신 접수 정보를 유지합니다.",
    stack: ["Next.js", "Prisma", "SQLite"],
    link: null,
    linkLabel: "Private",
  },
];

const INTERESTS = [
  {
    title: "인프라 · 자동화",
    body: "리눅스, 홈서버, launchd/cron 자동화. '한 번 만들면 알아서 돌아가는 것'을 좋아합니다.",
    icon: <IconServer2 size={56} stroke={1.4} />,
    accent: "34, 211, 238",
  },
  {
    title: "네트워크 보안",
    body: "트래픽 분석, 취약점 진단, 위협 대응. 시스템을 지키는 관점에서 기술을 들여다봅니다.",
    icon: <IconShieldLock size={56} stroke={1.4} />,
    accent: "251, 113, 133",
  },
  {
    title: "AI · LLM",
    body: "로컬 LLM 운영, RAG, AI 에이전트. 직접 굴려보며 한계와 가능성을 몸으로 배우는 중.",
    icon: <IconBrain size={56} stroke={1.4} />,
    accent: "163, 230, 53",
  },
];

export default function Home() {
  const docs = listDocs();
  const categories = Object.entries(CATEGORIES).map(([key, cat]) => ({
    key,
    name: cat.name,
    description: cat.description,
    count: docs.filter((d) => d.category === key).length,
  }));

  return (
    <div className="nx">
      <header className="nx-header">
        <Link href="/" className="nx-logo">
          Daniel<span>.wiki</span>
        </Link>
        <nav>
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#wiki">Wiki</a>
          <a href="https://github.com/Leemingi6901" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      {/* 히어로 */}
      <section className="nx-hero">
        <p className="nx-hello">Daniel Tech Wiki</p>
        <div className="nx-hero-title">
          <h1>Daniel</h1>
          <ProfileCard />
        </div>
        <p className="nx-tagline">
          이 사이트는 인간 이민기의 기술 블로그입니다.
          <br />
          제가 경험했던 인프라, 네트워크, 보안 업무를 문서화 하였습니다.
        </p>
        <div className="nx-network">
          <NeuralNetworkOrganic
            categories={categories.map(({ key, name, count }) => ({ key, name, count }))}
            docs={docs.map(({ category, slug, title }) => ({ category, slug, title }))}
          />
        </div>
        <div className="nx-scroll-hint" aria-hidden>
          <span>SCROLL</span>
          <i />
        </div>
      </section>

      {/* 외부 프로젝트 배너 */}
      <section className="nx-banner-wrap">
        <Reveal>
          <div className="nx-banner-group">
            <a href="https://daniel-infra-security.vercel.app" target="_blank" rel="noreferrer" className="nx-banner-row">
              <span className="nx-banner-tag">NEW</span>
              <IconShieldCheck className="nx-banner-icon" size={20} stroke={1.8} />
              <div className="nx-banner-row-text">
                <strong>
                  Daniel IT <em>Infra & Security</em>
                </strong>
                <p>국내외 인프라·보안 뉴스를 자동 수집해 지금 가장 뜨는 기술 키워드를 추적합니다.</p>
              </div>
              <span className="nx-banner-cta">→</span>
            </a>
            <a href="https://pacelab-korea97.vercel.app" target="_blank" rel="noreferrer" className="nx-banner-row">
              <span className="nx-banner-tag">PROJECT</span>
              <IconRun className="nx-banner-icon" size={20} stroke={1.8} />
              <div className="nx-banner-row-text">
                <strong>
                  Pace<em>Lab</em>
                </strong>
                <p>공식 대회 기록 × 인바디 데이터로 예상 PB와 대회 구간 기록을 예측합니다.</p>
              </div>
              <span className="nx-banner-cta">→</span>
            </a>
            <a href="https://daniel-saju.vercel.app" target="_blank" rel="noreferrer" className="nx-banner-row">
              <span className="nx-banner-tag">PROJECT</span>
              <IconMoonStars className="nx-banner-icon" size={20} stroke={1.8} />
              <div className="nx-banner-row-text">
                <strong>
                  Daniel <em>사주팔자</em>
                </strong>
                <p>생년월일시를 만세력으로 환산해 사주팔자를 분석하고, 나와 상대방의 궁합까지 점수화합니다.</p>
              </div>
              <span className="nx-banner-cta">→</span>
            </a>
          </div>
        </Reveal>
      </section>

      {/* 01 About */}
      <section className="nx-section nx-about" id="about">
        <div className="nx-about-head">
          <Reveal stagger>
            <span className="nx-eyebrow">01 — ABOUT</span>
            <h2>
              요즘 이런 것들에 <em>집중</em>하고 있습니다
            </h2>
            <p className="nx-about-intro">
              인프라 자동화, 네트워크 보안, AI·LLM 세 갈래를 오가며 직접 굴려보고 기록합니다.
            </p>
          </Reveal>
        </div>
        <InterestScrollPanel items={INTERESTS} />
      </section>

      {/* 02 Projects */}
      <section className="nx-section" id="projects">
        <Reveal stagger>
          <span className="nx-eyebrow">02 — PROJECTS</span>
          <h2>
            직접 만들고 <em>운영</em>한 것들
          </h2>
        </Reveal>
        <ProjectCards items={PROJECTS} />
      </section>

      {/* 03 Wiki */}
      <section className="nx-section" id="wiki">
        <Reveal stagger>
          <span className="nx-eyebrow">03 — LEARNING WIKI</span>
          <h2>
            경험/기술 <em>기록</em>
          </h2>
        </Reveal>
        <div className="nx-cards" id="categories">
          {categories.map((c, i) => (
            <Reveal key={c.key} className={`delay-${i}`}>
              <div className="nx-card">
                <h3>{c.name}</h3>
                <p>{c.description}</p>
                <span className="nx-card-count">문서 {c.count}개</span>
              </div>
            </Reveal>
          ))}
        </div>
        <DocList
          items={docs.slice(0, 10).map((d) => ({
            category: d.category,
            categoryName: CATEGORIES[d.category]?.name ?? "",
            slug: d.slug,
            title: d.title,
            description: d.description,
            updated: d.updated,
          }))}
        />
      </section>

      {/* 04 Contact */}
      <section className="nx-section nx-cta" id="contact">
        <Reveal stagger>
          <span className="nx-eyebrow">04 — CONTACT</span>
          <h2>
            더 자세히 <em>알아보고</em> 싶다면
          </h2>
          <p>피드백, 질문, 제안 모두 환영합니다. 가벼운 마음으로 연락 부탁드립니다.</p>
          <div className="nx-cta-links">
            <a href="https://github.com/Leemingi6901" target="_blank" rel="noreferrer" className="nx-btn">
              GitHub ↗
            </a>
            <a href="https://leemingi6901.github.io" target="_blank" rel="noreferrer" className="nx-btn nx-btn-ghost">
              기술 블로그 ↗
            </a>
            <a
              href="https://instagram.com/2mg_2"
              target="_blank"
              rel="noreferrer"
              className="nx-btn nx-btn-ghost"
            >
              Instagram ↗
            </a>
            <a href="mailto:leemingi69012@gmail.com" className="nx-btn nx-btn-ghost">
              Email
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="nx-footer">© 2026 Daniel — 만들며 배우고, 배우며 기록합니다.</footer>
    </div>
  );
}
