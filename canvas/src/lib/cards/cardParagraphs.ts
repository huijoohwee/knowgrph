export type CardParagraphCandidate = {
  id: string
  label: string
  value: unknown
}

export type CardParagraphEntry = {
  id: string
  label: string
  value: string
}

const URL_LIKE_RE = /^(https?:\/\/|mailto:)/i

const normalizeParagraphValue = (value: unknown): string => {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const buildCardParagraphEntries = (
  candidates: readonly CardParagraphCandidate[],
  options?: { excludeUrlLike?: boolean },
): CardParagraphEntry[] => {
  const excludeUrlLike = options?.excludeUrlLike === true
  const out: CardParagraphEntry[] = []
  for (const candidate of candidates) {
    const id = String(candidate.id || '').trim()
    const label = String(candidate.label || '').trim()
    const value = normalizeParagraphValue(candidate.value)
    if (!id || !label || !value) continue
    if (excludeUrlLike && URL_LIKE_RE.test(value)) continue
    out.push({ id, label, value })
  }
  return out
}
