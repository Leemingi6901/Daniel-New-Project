import Link from "next/link";
import Reveal from "@/components/Reveal";

interface Doc {
  category: string;
  categoryName: string;
  slug: string;
  title: string;
  description: string;
  updated: string;
}

export default function DocList({ items }: { items: Doc[] }) {
  return (
    <div className="nx-doc-list">
      {items.map((d, i) => (
        <Reveal key={`${d.category}/${d.slug}`} className={`delay-${i % 5}`}>
          <Link href={`/wiki/${d.category}/${d.slug}`} className="nx-doc-row">
            <div>
              <strong>{d.title}</strong>
              <p>{d.description}</p>
            </div>
            <div className="nx-doc-side">
              <span className="nx-doc-cat">{d.categoryName}</span>
              <time>{d.updated}</time>
              <span className="nx-doc-arrow">→</span>
            </div>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
