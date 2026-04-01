export const splitMultiValues = (raw: string): string[] => {
  const s = String(raw ?? '')
    .split(',')
    .map(x => String(x ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of s) {
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

