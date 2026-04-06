import { toTableCellStringArray } from '@/lib/markdown/tableCellConventions'

export const splitMultiValues = (raw: string): string[] => {
  const vals = toTableCellStringArray(raw)
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of vals) {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}
