import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORIES, listDocs } from "@/lib/wiki";
import ProfileCard from "@/components/ProfileCard";
import Reveal from "@/components/Reveal";
import {
  IconShieldCheck,
  IconRun,
  IconMoonStars,
  IconServer2,
  IconShieldLock,
  IconBrain,
  IconBook2,
  IconRobot,
  IconTrendingUp,
  IconCode,
  IconTools,
  IconLanguage,
  IconPin,
  IconClipboardCheck,
} from "@tabler/icons-react";

interface Project {
  name: string;
  description: string;
  stack: string[];
  /** 외부 주소는 새 탭, /로 시작하면 위키 안 링크. 없으면 비공개 */
  link: string | null;
  linkLabel: string;
  live?: boolean;
  icon: ReactNode;
}

const PROJECTS: Project[] = [
  {
    name: "Daniel IT Infra & Security",
    description: "국내외 인프라·보안 뉴스를 자동 수집해 지금 가장 뜨는 기술 키워드를 추적합니다.",
    stack: ["Next.js", "크롤링", "키워드 분석"],
    link: "https://daniel-infra-security.vercel.app",
    linkLabel: "사이트",
    live: true,
    icon: <IconShieldCheck size={22} stroke={1.7} />,
  },
  {
    name: "Work Tracker",
    description: "IT Ops 업무 일지. 슬랙으로 알림을 받고 명령어로 등록하며, 반기 성과 요약을 자동으로 만듭니다.",
    stack: ["Next.js", "Neon", "Slack"],
    link: "/wiki/web/task-tracker-product-overview",
    linkLabel: "소개서",
    icon: <IconClipboardCheck size={22} stroke={1.7} />,
  },
  {
    name: "PaceLab",
    description: "공식 대회 기록 × 인바디 데이터로 예상 PB와 대회 구간 기록을 예측합니다.",
    stack: ["Next.js", "VDOT", "AI"],
    link: "https://pacelab-korea97.vercel.app",
    linkLabel: "사이트",
    live: true,
    icon: <IconRun size={22} stroke={1.7} />,
  },
  {
    name: "Daniel 사주팔자",
    description: "생년월일시를 만세력으로 환산해 사주를 풀고, 상대방과의 궁합을 점수화합니다.",
    stack: ["Next.js", "만세력"],
    link: "https://daniel-saju.vercel.app",
    linkLabel: "사이트",
    live: true,
    icon: <IconMoonStars size={22} stroke={1.7} />,
  },
  {
    name: "EnglishQuest",
    description: "완전 초급자가 미션을 깨며 AI와 짧은 영어 대화를 연습하고, 리캐스트로 교정받습니다.",
    stack: ["Next.js", "Ollama"],
    link: "https://englishquest-ecru.vercel.app",
    linkLabel: "사이트",
    live: true,
    icon: <IconLanguage size={22} stroke={1.7} />,
  },
  {
    name: "Daniel Tech Wiki",
    description: "인프라·네트워크·보안 업무와 공부한 기술을 문서로 남기는 위키. 지금 보고 계신 사이트입니다.",
    stack: ["Next.js 16", "SSG", "Vercel"],
    link: "https://github.com/Leemingi6901/Daniel-New-Project",
    linkLabel: "GitHub",
    icon: <IconBook2 size={22} stroke={1.7} />,
  },
  {
    name: "OpenClaw AI 비서",
    description: "맥미니에서 상시 구동되는 텔레그램 AI 비서. 로컬 LLM으로 API 비용 없이 운영합니다.",
    stack: ["OpenClaw", "Ollama", "launchd"],
    link: null,
    linkLabel: "비공개",
    icon: <IconRobot size={22} stroke={1.7} />,
  },
  {
    name: "Daily Growth",
    description: "매일 자정 뉴스와 영어 단어를 자동 수집·요약하는 자기계발 사이트.",
    stack: ["Next.js", "Prisma", "Ollama"],
    link: null,
    linkLabel: "비공개",
    icon: <IconTrendingUp size={22} stroke={1.7} />,
  },
  {
    name: "RUN-Project",
    description: "전국 러닝 대회 정보를 매일 자동 크롤링해 최신 접수 정보를 보여 줍니다.",
    stack: ["Next.js", "Prisma", "SQLite"],
    link: null,
    linkLabel: "비공개",
    icon: <IconRun size={22} stroke={1.7} />,
  },
];

const INTERESTS = [
  {
    title: "인프라 · 자동화",
    body: "리눅스, 홈서버, cron 자동화. 한 번 만들면 알아서 돌아가는 것을 좋아합니다.",
    icon: <IconServer2 size={20} stroke={1.7} />,
  },
  {
    title: "네트워크 보안",
    body: "트래픽 분석, 취약점 진단, 위협 대응. 지키는 관점에서 기술을 봅니다.",
    icon: <IconShieldLock size={20} stroke={1.7} />,
  },
  {
    title: "AI · LLM",
    body: "로컬 LLM 운영, RAG, AI 에이전트. 직접 굴려 보며 한계와 가능성을 배웁니다.",
    icon: <IconBrain size={20} stroke={1.7} />,
  },
];

const CATEGORY_ICONS: Record<string, ReactNode> = {
  ai: <IconBrain size={18} stroke={1.7} />,
  web: <IconCode size={18} stroke={1.7} />,
  infra: <IconServer2 size={18} stroke={1.7} />,
  tools: <IconTools size={18} stroke={1.7} />,
};

function shortDate(d: string) {
  return d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : "";
}

function ProjectLink({ p }: { p: Project }) {
  if (!p.link) return <span className="hm-proj-link is-private">{p.linkLabel}</span>;
  if (p.link.startsWith("/"))
    return (
      <Link href={p.link} className="hm-proj-link">
        {p.linkLabel} →
      </Link>
    );
  return (
    <a href={p.link} target="_blank" rel="noreferrer" className="hm-proj-link">
      {p.linkLabel} ↗
    </a>
  );
}

export default function Home() {
  const docs = listDocs();
  const pinned = docs.find((d) => d.pinned);
  const recent = docs.filter((d) => d !== pinned).slice(0, 9);
  const lastUpdated = docs.reduce((m, d) => (d.updated > m ? d.updated : m), "");
  const categories = Object.entries(CATEGORIES).map(([key, cat]) => {
    const list = docs.filter((d) => d.category === key);
    return { key, name: cat.name, count: list.length, top: list.slice(0, 3) };
  });
  const maxCount = Math.max(1, ...categories.map((c) => c.count));

  return (
    <div className="nx">
      <header className="nx-header">
        <Link href="/" className="nx-logo">
          Daniel<span>.wiki</span>
        </Link>
        <nav>
          <a href="#docs">문서</a>
          <a href="#projects">프로젝트</a>
          <a href="#about">소개</a>
          <a href="https://github.com/Leemingi6901" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main className="hm">
        {/* 첫 화면: 소개 + 고정 글 */}
        <section className="hm-hero">
          <div className="hm-intro">
            <p className="nx-hello">Daniel Tech Wiki</p>
            <div className="nx-hero-title">
              <h1>Daniel</h1>
              <ProfileCard />
            </div>
            <p className="nx-tagline">
              인프라 엔지니어 이민기의 기술 위키입니다.
              <br />
              직접 겪은 인프라·네트워크·보안 업무와 만든 프로젝트를 문서로 남깁니다.
            </p>
            <dl className="hm-stats">
              <div>
                <dt>문서</dt>
                <dd>{docs.length}</dd>
              </div>
              <div>
                <dt>프로젝트</dt>
                <dd>{PROJECTS.length}</dd>
              </div>
              <div>
                <dt>최근 업데이트</dt>
                <dd>{shortDate(lastUpdated)}</dd>
              </div>
            </dl>
          </div>

          {pinned && (
            <Link href={`/wiki/${pinned.category}/${pinned.slug}`} className="hm-pinned">
              <span className="hm-pinned-tag">
                <IconPin size={14} stroke={2} /> 고정 글
              </span>
              <strong>{pinned.title}</strong>
              <p>{pinned.description}</p>
              <span className="hm-pinned-foot">
                {CATEGORIES[pinned.category]?.name} · {pinned.updated}
                <span className="hm-arrow">읽기 →</span>
              </span>
            </Link>
          )}
        </section>

        {/* 문서: 최근 문서 + 카테고리 */}
        <section className="hm-docs" id="docs">
          <Reveal className="hm-panel">
            <div className="hm-panel-head">
              <h2>최근 문서</h2>
              <span>{docs.length}개 중 최신순</span>
            </div>
            <ul className="hm-recent">
              {recent.map((d) => (
                <li key={`${d.category}/${d.slug}`}>
                  <Link href={`/wiki/${d.category}/${d.slug}`} title={d.description}>
                    <time>{shortDate(d.updated)}</time>
                    <span className="hm-recent-title">{d.title}</span>
                    <span className="hm-recent-cat">{CATEGORIES[d.category]?.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="hm-panel delay-1">
            <div className="hm-panel-head">
              <h2>카테고리</h2>
            </div>
            <ul className="hm-cats">
              {categories.map((c) => (
                <li key={c.key}>
                  <div className="hm-cat-head">
                    <span className="hm-cat-icon">{CATEGORY_ICONS[c.key]}</span>
                    <strong>{c.name}</strong>
                    <span className="hm-cat-count">{c.count}</span>
                  </div>
                  <div className="hm-cat-bar" aria-hidden>
                    <i style={{ width: `${(c.count / maxCount) * 100}%` }} />
                  </div>
                  <ul className="hm-cat-docs">
                    {c.top.map((d) => (
                      <li key={d.slug}>
                        <Link href={`/wiki/${d.category}/${d.slug}`}>{d.title}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* 프로젝트 */}
        <section className="hm-section" id="projects">
          <div className="hm-section-head">
            <h2>직접 만들고 운영하는 것들</h2>
            <p>운영 중인 서비스는 바로 써 볼 수 있습니다.</p>
          </div>
          <Reveal stagger className="hm-proj-grid">
            {PROJECTS.map((p) => (
              <article key={p.name} className="hm-proj">
                <div className="hm-proj-head">
                  <span className="hm-proj-icon">{p.icon}</span>
                  {p.live && <span className="hm-live">운영 중</span>}
                </div>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <div className="hm-proj-foot">
                  <div className="hm-stack">
                    {p.stack.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  <ProjectLink p={p} />
                </div>
              </article>
            ))}
          </Reveal>
        </section>

        {/* 소개 */}
        <section className="hm-section" id="about">
          <div className="hm-section-head">
            <h2>요즘 집중하는 것</h2>
          </div>
          <Reveal stagger className="hm-interests">
            {INTERESTS.map((it) => (
              <div key={it.title} className="hm-interest">
                <span className="hm-proj-icon">{it.icon}</span>
                <div>
                  <h3>{it.title}</h3>
                  <p>{it.body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </section>

        {/* 연락 */}
        <Reveal className="hm-contact">
          <div>
            <h2>더 이야기하고 싶다면</h2>
            <p>피드백, 질문, 제안 모두 환영합니다.</p>
          </div>
          <div className="nx-cta-links">
            <a href="https://github.com/Leemingi6901" target="_blank" rel="noreferrer" className="nx-btn">
              GitHub ↗
            </a>
            <a href="https://leemingi6901.github.io" target="_blank" rel="noreferrer" className="nx-btn nx-btn-ghost">
              기술 블로그 ↗
            </a>
            <a href="https://instagram.com/2mg_2" target="_blank" rel="noreferrer" className="nx-btn nx-btn-ghost">
              Instagram ↗
            </a>
            <a href="mailto:leemingi69012@gmail.com" className="nx-btn nx-btn-ghost">
              Email
            </a>
          </div>
        </Reveal>
      </main>

      <footer className="nx-footer">© 2026 Daniel — 만들며 배우고, 배우며 기록합니다.</footer>
    </div>
  );
}
