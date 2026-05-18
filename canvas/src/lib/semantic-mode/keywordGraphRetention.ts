export type KeywordEntityRetentionInput = {
  key: string
  count: number
  candidateScore?: number
  candidateRank?: number
  phraseLength?: number
  roleWeight?: number
}

export const readKeywordGraphMaxNodes = (raw: unknown, fallback = 220): number => {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : fallback
  return Math.max(80, Math.min(800, n))
}

export const selectRetainedKeywordEntityKeys = (
  inputs: KeywordEntityRetentionInput[],
  maxNodes: number,
): Set<string> => {
  const cleaned = inputs
    .map(input => ({
      key: String(input.key || '').trim(),
      count: typeof input.count === 'number' && Number.isFinite(input.count) ? Math.max(0, input.count) : 0,
      candidateScore: typeof input.candidateScore === 'number' && Number.isFinite(input.candidateScore) ? Math.max(0, input.candidateScore) : 0,
      candidateRank: typeof input.candidateRank === 'number' && Number.isFinite(input.candidateRank) ? Math.max(1, input.candidateRank) : 0,
      phraseLength: typeof input.phraseLength === 'number' && Number.isFinite(input.phraseLength) ? Math.max(1, input.phraseLength) : 1,
      roleWeight: typeof input.roleWeight === 'number' && Number.isFinite(input.roleWeight) ? Math.max(0, input.roleWeight) : 0,
    }))
    .filter(input => input.key)
  if (cleaned.length <= maxNodes) return new Set(cleaned.map(input => input.key))

  const scored = cleaned.map(input => {
    const rankBoost = input.candidateRank > 0 ? 72 / (input.candidateRank + 4) : 0
    const phraseBoost = input.phraseLength > 1 ? Math.min(28, input.phraseLength * 7) : 0
    const score = input.count + Math.sqrt(input.count) * 2 + input.candidateScore * 12 + rankBoost + phraseBoost + input.roleWeight * 0.5
    return { key: input.key, score, count: input.count, phraseLength: input.phraseLength }
  })
  scored.sort((a, b) => b.score - a.score || b.count - a.count || b.phraseLength - a.phraseLength || a.key.localeCompare(b.key))
  return new Set(scored.slice(0, maxNodes).map(input => input.key))
}
