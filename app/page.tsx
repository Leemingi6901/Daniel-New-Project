import Link from "next/link";
import { CATEGORIES, listDocs } from "@/lib/wiki";

export default function Home() {
  const docs = listDocs();
  const recent = docs.slice(0, 5);

  return (
    <div className="home">
      <section className="hero">
        <h1>IT 신기술 학습 위키</h1>
        <p>
          새로운 기술을 공부하며 정리한 노트를 모아두는 공간입니다. 저의 학습 기록이지만,
          같은 주제를 공부하는 분들께도 참고가 되면 좋겠습니다.
        </p>
      </section>

      <section>
        <h2 className="section-title">카테고리</h2>
        <div className="category-grid">
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const count = docs.filter((d) => d.category === key).length;
            return (
              <div key={key} className="category-card">
                <h3>{cat.name}</h3>
                <p>{cat.description}</p>
                <span className="doc-count">문서 {count}개</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">최근 업데이트</h2>
        <ul className="recent-list">
          {recent.map((d) => (
            <li key={`${d.category}/${d.slug}`}>
              <Link href={`/wiki/${d.category}/${d.slug}`}>
                <strong>{d.title}</strong>
                <span className="recent-desc">{d.description}</span>
              </Link>
              <time>{d.updated}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
