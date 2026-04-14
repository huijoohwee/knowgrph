export const SAFE_SVG_FALLBACK_STYLE_SENTINEL = 'kg:style:svg-fallback'

export const normalizePersistedGeospatialStyleUrl = (raw: string | null | undefined): string => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  if (trimmed === SAFE_SVG_FALLBACK_STYLE_SENTINEL) return SAFE_SVG_FALLBACK_STYLE_SENTINEL

  const lower = trimmed.toLowerCase()
  if (lower.startsWith('kg:style:')) return ''
  if (lower.includes('demotiles.maplibre.org')) return ''
  if (lower.includes('tiles.openfreemap.org/styles/')) return ''

  // Prefer the built-in SVG fallback over persisted remote style URLs.
  if (lower.startsWith('http://') || lower.startsWith('https://')) return ''
  return trimmed
}
