/** 제목·요약·태그에서 찾는다. 띄어 쓴 단어는 모두 들어 있어야 맞는다(대소문자 무시). */
export function matchesQuery(doc: { title: string; description?: string; tags?: string[] }, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = [doc.title, doc.description ?? "", ...(doc.tags ?? [])].join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
}
