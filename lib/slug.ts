export function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return normalized || "game";
}

export function ensureUniqueIds(rawIds: string[]): string[] {
  const seen = new Map<string, number>();
  return rawIds.map((id) => {
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count === 0) return id;
    return `${id}-${count + 1}`;
  });
}
