import Link from "next/link";
import { CATEGORIES, listDocs } from "@/lib/wiki";

export default function Sidebar() {
  const docs = listDocs();
  return (
    <aside className="sidebar">
      {Object.entries(CATEGORIES).map(([key, cat]) => {
        const catDocs = docs.filter((d) => d.category === key);
        if (catDocs.length === 0) return null;
        return (
          <section key={key} className="sidebar-section">
            <h3>{cat.name}</h3>
            <ul>
              {catDocs.map((d) => (
                <li key={d.slug}>
                  <Link href={`/wiki/${d.category}/${d.slug}`}>{d.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
