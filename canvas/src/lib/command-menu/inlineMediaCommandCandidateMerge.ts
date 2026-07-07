import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'

function normalizeInlineMediaUrl(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[.,;:]+$/g, '')
}

function buildInlineMediaUrlDedupeKey(raw: string): string {
  const normalized = normalizeInlineMediaUrl(raw)
  if (!normalized) return ''
  try {
    const parsed = new URL(normalized, 'http://knowgrph.local')
    parsed.searchParams.delete('kg_media_token')
    parsed.searchParams.sort()
    const query = parsed.searchParams.toString()
    const path = `${parsed.pathname}${query ? `?${query}` : ''}`
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
      ? `${parsed.protocol}//${parsed.host}${path}`
      : path
  } catch {
    return normalized.replace(/([?&])kg_media_token=[^&]+&?/g, '$1').replace(/[?&]$/g, '')
  }
}

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
    const urlDedupeKey = buildInlineMediaUrlDedupeKey(url)
    const dedupeKeys = [`url:${urlDedupeKey || url}`, sourceKey ? `source:${sourceKey}` : ''].filter(Boolean)
    if (dedupeKeys.some(key => seen.has(key))) continue
    dedupeKeys.forEach(key => seen.add(key))
    merged.push(url === candidate.url ? candidate : { ...candidate, url })
    if (merged.length >= max) break
  }
  return merged
}
