import { LS_KEYS } from '../../lib/config.js'
const GEOSPATIAL_POINT_STYLE_CHANGED_EVENT = 'kg:geospatialPointStyleChanged'

export type GeospatialPointStyleConfig = {
  radiusMultiplier: number
  colors: {
    airport: string
    hotel: string
    poi: string
    route: string
    other: string
  }
}

export const MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG: GeospatialPointStyleConfig = {
  radiusMultiplier: 1,
  colors: {
    airport: '#2563eb',
    hotel: '#7c3aed',
    poi: '#ea580c',
    route: '#0f766e',
    other: '#64748b',
  },
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

const normalizeColor = (value: unknown, fallback: string): string => {
  const v = String(value || '').trim()
  return HEX_COLOR_RE.test(v) ? v.toLowerCase() : fallback
}

export const normalizeGeospatialPointStyleConfig = (raw: unknown): GeospatialPointStyleConfig => {
  const defaults = MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG
  const rec = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const colorsRaw = rec.colors && typeof rec.colors === 'object' && !Array.isArray(rec.colors) ? (rec.colors as Record<string, unknown>) : {}
  const r0 = Number(rec.radiusMultiplier)
  const radiusMultiplier = Number.isFinite(r0) ? Math.max(0.6, Math.min(2.4, r0)) : defaults.radiusMultiplier
  return {
    radiusMultiplier,
    colors: {
      airport: normalizeColor(colorsRaw.airport, defaults.colors.airport),
      hotel: normalizeColor(colorsRaw.hotel, defaults.colors.hotel),
      poi: normalizeColor(colorsRaw.poi, defaults.colors.poi),
      route: normalizeColor(colorsRaw.route, defaults.colors.route),
      other: normalizeColor(colorsRaw.other, defaults.colors.other),
    },
  }
}

export const readGeospatialPointStyleConfig = (): GeospatialPointStyleConfig => {
  if (typeof window === 'undefined') return MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG
  try {
    const raw = window.localStorage.getItem(LS_KEYS.geospatialPointStyleConfig)
    if (!raw) return MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG
    const parsed = JSON.parse(raw) as unknown
    return normalizeGeospatialPointStyleConfig(parsed)
  } catch {
    return MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG
  }
}

export const writeGeospatialPointStyleConfig = (config: GeospatialPointStyleConfig): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEYS.geospatialPointStyleConfig, JSON.stringify(normalizeGeospatialPointStyleConfig(config)))
    window.dispatchEvent(new Event(GEOSPATIAL_POINT_STYLE_CHANGED_EVENT))
  } catch {
    void 0
  }
}

export const pointStyleConfigSignature = (config: GeospatialPointStyleConfig): string => {
  const n = normalizeGeospatialPointStyleConfig(config)
  return [
    n.radiusMultiplier.toFixed(2),
    n.colors.airport,
    n.colors.hotel,
    n.colors.poi,
    n.colors.route,
    n.colors.other,
  ].join('|')
}
