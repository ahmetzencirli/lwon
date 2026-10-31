/** Sorts object keys so values compare equal regardless of key order. */
export function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v === null || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).sort()) {
    Object.defineProperty(out, k, { value: canonical((v as Record<string, unknown>)[k]), enumerable: true });
  }
  return out;
}
