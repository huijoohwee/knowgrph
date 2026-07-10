import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { buildInlineMediaUrlIdentityKey, normalizeInlineMediaUrl } from '@/lib/command-menu/inlineMediaUrlIdentity'

export function mergeInlineMediaCommandCandidates(
  candidates: readonly InlineMediaCommandCandidate[],
  limit?: number,
): InlineMediaCommandCandidate[] {
  const max = Number.isFinite(limit) && Number(limit) > 0 ? Number(limit) : Number.POSITIVE_INFINITY
  const seen = new Set<string>()
  const merged: InlineMediaCommandCandidate[] = []
  for (const candidate of candidates) {
    const url = normalizeInlineMediaUrl(candidate.url)
    if (!url) continue
    const sourceKey = String(candidate.sourceKey || '').trim()
    const urlDedupeKey = buildInlineMediaUrlIdentityKey(url)
    const dedupeKeys = [`url:${urlDedupeKey || url}`, sourceKey ? `source:${sourceKey}` : ''].filter(Boolean)
    if (dedupeKeys.some(key => seen.has(key))) continue
    dedupeKeys.forEach(key => seen.add(key))
    merged.push(url === candidate.url ? candidate : { ...candidate, url })
    if (merged.length >= max) break
  }
  return merged
}
