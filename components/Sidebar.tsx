import { CATEGORIES, listDocs, type WikiDocMeta } from "@/lib/wiki";
import SidebarNav, { type NavCategory, type NavDoc, type NavItem } from "@/components/SidebarNav";

// "업무 일지 대시보드 8탄 — 부제" 꼴의 제목을 시리즈로 묶는다
const SERIES_RE = /^(.+?) (\d+)탄 — (.+)$/;

function toNavDoc(d: WikiDocMeta, label: string): NavDoc {
  return { category: d.category, slug: d.slug, title: d.title, label, pinned: d.pinned, description: d.description, tags: d.tags };
}

function buildItems(docs: WikiDocMeta[]): NavItem[] {
  // 번호가 붙은 글이 2개 이상인 시리즈만 묶는다
  const counts = new Map<string, number>();
  for (const d of docs) {
    const m = d.title.match(SERIES_RE);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  const seriesNames = [...counts].filter(([, n]) => n >= 2).map(([name]) => name);

  const items: NavItem[] = [];
  const buckets = new Map<string, { order: number; doc: NavDoc }[]>();
  for (const d of docs) {
    const name = seriesNames.find((s) => d.title.startsWith(`${s} `));
    if (!name) {
      items.push({ type: "doc", doc: toNavDoc(d, d.title) });
      continue;
    }
    if (!buckets.has(name)) {
      buckets.set(name, []);
      items.push({ type: "series", name, docs: [] }); // 가장 최신 글 자리에 시리즈를 둔다
    }
    const m = d.title.match(SERIES_RE);
    const label = m
      ? `${m[2]}탄 · ${m[3]}`
      : d.title.slice(name.length).trim().replace(/^—\s*/, "").replace(" — ", " · ");
    buckets.get(name)!.push({ order: m ? Number(m[2]) : 0, doc: toNavDoc(d, label) });
  }
  // 시리즈 안은 읽는 순서(번호 오름차순, 번호 없는 첫 편이 맨 앞)
  for (const it of items) {
    if (it.type === "series") it.docs = buckets.get(it.name)!.sort((a, b) => a.order - b.order).map((b) => b.doc);
  }
  return items;
}

export default function Sidebar() {
  const docs = listDocs();
  const categories: NavCategory[] = Object.entries(CATEGORIES)
    .map(([key, cat]) => {
      const catDocs = docs.filter((d) => d.category === key);
      return { key, name: cat.name, count: catDocs.length, items: buildItems(catDocs) };
    })
    .filter((c) => c.count > 0);

  return <SidebarNav categories={categories} total={docs.length} />;
}
