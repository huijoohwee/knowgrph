export const DEFAULT_OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function getGeospatialMapStyleUrl(): string {
  if (typeof import.meta === 'undefined') return DEFAULT_OPENFREEMAP_STYLE_URL
  const meta = import.meta as unknown as { env?: Record<string, unknown> }
  const env = meta.env
  const raw = env && env.VITE_GEOSPATIAL_MAP_STYLE_URL
  if (typeof raw !== 'string') return DEFAULT_OPENFREEMAP_STYLE_URL
  const trimmed = raw.trim()
  return trimmed || DEFAULT_OPENFREEMAP_STYLE_URL
}

