import Link from "next/link";
import { CATEGORIES, listDocs } from "@/lib/wiki";
import NeuralNetwork from "@/components/NeuralNetwork";
import Reveal from "@/components/Reveal";

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
          <a href="https://leemingi6901.github.io" target="_blank" rel="noreferrer">
            블로그
          </a>
          <a href="https://github.com/Leemingi6901/Daniel-New-Project" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      {/* 섹션 1: 히어로 + 뉴럴 네트워크 */}
      <section className="nx-hero">
        <h1>
          기술을 <em>연결하며</em> 배웁니다
        </h1>
        <p>
          IT 신기술 학습 노트가 하나의 지식 그래프로 이어지는 공간.
          <br />
          노드를 눌러 탐색을 시작하세요.
        </p>
        <div className="nx-network">
          <NeuralNetwork
            categories={categories.map(({ key, name, count }) => ({ key, name, count }))}
            docs={docs.map(({ category, slug, title }) => ({ category, slug, title }))}
          />
        </div>
        <div className="nx-scroll-hint" aria-hidden>
          <span>SCROLL</span>
          <i />
        </div>
      </section>

      {/* 섹션 2: 카테고리 */}
      <section className="nx-section" id="categories">
        <Reveal>
          <span className="nx-eyebrow">CATEGORIES</span>
          <h2>네 갈래의 학습 트랙</h2>
        </Reveal>
        <div className="nx-cards">
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
      </section>

      {/* 섹션 3: 최근 문서 */}
      <section className="nx-section">
        <Reveal>
          <span className="nx-eyebrow">LATEST NOTES</span>
          <h2>최근 업데이트</h2>
        </Reveal>
        <div className="nx-doc-list">
          {docs.slice(0, 5).map((d, i) => (
            <Reveal key={`${d.category}/${d.slug}`} className={`delay-${i}`}>
              <Link href={`/wiki/${d.category}/${d.slug}`} className="nx-doc-row">
                <div>
                  <strong>{d.title}</strong>
                  <p>{d.description}</p>
                </div>
                <div className="nx-doc-side">
                  <span className="nx-doc-cat">{CATEGORIES[d.category]?.name}</span>
                  <time>{d.updated}</time>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 섹션 4: CTA */}
      <section className="nx-section nx-cta">
        <Reveal>
          <h2>
            배움은 기록될 때 <em>지식</em>이 됩니다
          </h2>
          <p>이 위키는 매일 조금씩 자랍니다. 같은 길을 걷는 분들께 좋은 이정표가 되기를.</p>
          <div className="nx-cta-links">
            <a href="https://github.com/Leemingi6901/Daniel-New-Project" target="_blank" rel="noreferrer" className="nx-btn">
              GitHub에서 보기 ↗
            </a>
            <a href="https://leemingi6901.github.io" target="_blank" rel="noreferrer" className="nx-btn nx-btn-ghost">
              블로그 방문 ↗
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="nx-footer">© 2026 Daniel Tech Wiki — 개인 학습 기록이지만, 모두에게 열려 있습니다.</footer>
    </div>
  );
}
