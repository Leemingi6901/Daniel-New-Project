import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, getDoc, listDocs } from "@/lib/wiki";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  return listDocs().map((d) => ({ slug: [d.category, d.slug] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length !== 2) return {};
  const doc = await getDoc(slug[0], slug[1]);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function WikiPage({ params }: Props) {
  const { slug } = await params;
  if (slug.length !== 2) notFound();
  const doc = await getDoc(slug[0], slug[1]);
  if (!doc) notFound();

  return (
    <article className="doc">
      <header className="doc-header">
        <span className="doc-category">{CATEGORIES[doc.category]?.name ?? doc.category}</span>
        <h1>{doc.title}</h1>
        <div className="doc-meta">
          {doc.updated && <time>업데이트: {doc.updated}</time>}
          {doc.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      </header>
      <div className="doc-body" dangerouslySetInnerHTML={{ __html: doc.html }} />
    </article>
  );
}
