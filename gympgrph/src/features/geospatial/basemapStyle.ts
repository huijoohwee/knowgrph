export const SAFE_SVG_FALLBACK_STYLE_SENTINEL = 'kg:style:svg-fallback'
export const MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL = 'https://demotiles.maplibre.org/style.json'
export const MAPLIBRE_MODERN_DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
export const MAPLIBRE_GLOBE_DEFAULT_STYLE_URL = 'https://demotiles.maplibre.org/globe.json'
export const MAPLIBRE_DEFAULT_STYLE_URL = MAPLIBRE_CLASSIC_DEFAULT_STYLE_URL

export const normalizePersistedGeospatialStyleUrl = (raw: string | null | undefined): string => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return MAPLIBRE_DEFAULT_STYLE_URL
  if (trimmed === SAFE_SVG_FALLBACK_STYLE_SENTINEL) return SAFE_SVG_FALLBACK_STYLE_SENTINEL

  const lower = trimmed.toLowerCase()
  if (lower.startsWith('kg:style:')) return MAPLIBRE_DEFAULT_STYLE_URL

  // Allow explicit remote style URLs for MapLibre runtime paths.
  if (lower.startsWith('http://') || lower.startsWith('https://')) return trimmed
  return trimmed
}
