/** @param {string | null | undefined} iso */
export function isSameLocalDay(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date();
  return d.toDateString() === t.toDateString();
}
