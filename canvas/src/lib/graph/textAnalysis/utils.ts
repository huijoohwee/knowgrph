export const isVerbLike = (token: string): boolean => {
  const t = String(token || '').toLowerCase()
  if (!t) return false
  if (t === 'is' || t === 'are' || t === 'was' || t === 'were' || t === 'be') return true
  if (t === 'has' || t === 'have' || t === 'had') return true
  if (t === 'uses' || t === 'use' || t === 'using') return true
  if (t === 'make' || t === 'makes' || t === 'made') return true
  if (t === 'build' || t === 'builds' || t === 'built') return true
  if (t.endsWith('ed') || t.endsWith('ing')) return true
  return false
}

export const normalizeWhitespace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim()

export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const normalizeNounPhrase = (s: string): string => {
  const raw = normalizeWhitespace(s)
  if (!raw) return ''
  const cleaned = raw.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '').trim()
  return cleaned
}

export const splitSentences = (text: string): string[] => {
  const raw = normalizeWhitespace(text)
  if (!raw) return []
  const parts = raw.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
  return parts.map(x => x.trim()).filter(Boolean)
}

export const splitSentencesWithOffsets = (text: string): Array<{ start: number; end: number }> => {
  const raw = String(text || '')
  if (!raw.trim()) return []
  const ranges: Array<{ start: number; end: number }> = []
  const re = /[^.!?\n]+(?:[.!?]+|\n+|$)/g
  for (const m of raw.matchAll(re)) {
    const s = m.index ?? -1
    if (s < 0) continue
    const e = s + m[0].length
    const chunk = raw.slice(s, e)
    if (!chunk.trim()) continue
    ranges.push({ start: s, end: e })
  }
  return ranges
}

export const inferEntityLabel = (phrase: string): 'PERSON' | 'ORG' | 'GPE' | 'LOC' | 'FAC' | 'PRODUCT' | 'DATE' | 'QUANTITY' | 'ENTITY' => {
  const t = normalizeWhitespace(phrase)
  if (!t) return 'ENTITY'
  if (/^\d{4}(?:-\d{2}-\d{2})?$/.test(t)) return 'DATE'
  if (/^(?:\d+(?:\.\d+)?)(?:\s*(?:%|percent|kg|km|m|cm|mm|billion|million|thousand))\b/i.test(t)) return 'QUANTITY'
  if (/\b(inc|corp|ltd|llc|company|university|institute|agency)\b/i.test(t)) return 'ORG'
  if (/\b(city|country|state|province|region)\b/i.test(t)) return 'GPE'
  if (/\b(street|avenue|road|airport|station|bridge|tower)\b/i.test(t)) return 'FAC'
  if (/\b(product|model|device|tool|framework|library|api)\b/i.test(t)) return 'PRODUCT'
  return 'ENTITY'
}

export const normalizeEntityKey = (raw: string): string => {
  const t = normalizeWhitespace(raw)
  if (!t) return ''
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const splitCommaAndAndList = (value: string): string[] => {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned) return []
  const parts = cleaned
    .split(/\s*,\s*|\s+(?:and|or)\s+/i)
    .map(x => normalizeNounPhrase(x))
    .filter(Boolean)
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const k = p.toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

