export const parseStringArray = (raw: unknown): string[] | null => {
  if (!Array.isArray(raw)) return null
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (trimmed) out.push(trimmed)
  }
  return out
};
