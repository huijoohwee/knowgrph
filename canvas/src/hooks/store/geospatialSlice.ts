import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsNum, lsSetBool, lsSetInt, lsSetJson, lsSetNum } from '@/lib/persistence'
import type { GraphState } from '@/hooks/store/types'
import type { GeospatialDataset } from '@/lib/geospatial/types'
import {
  coerceGeospatialOverlayOpacity,
  DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES,
  DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS,
  DEFAULT_GEOSPATIAL_OVERLAY_OPACITY,
  DEFAULT_GEOSPATIAL_STYLE_URL,
  parseGeospatialDatasetFormat,
  parseGeospatialDatasetsFromEnv,
} from '@/lib/geospatial/config'
import { normalizeGeospatialStyleUrl } from '@/lib/geospatial/styleUrl'
import { clamp01 } from '@/lib/math/clamp01'

const clampInt = (value: number, min: number, max: number): number => {
  const v = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, v))
}

const GEO_DATASET_TIMEOUT_MIN_MS = 1_000
const GEO_DATASET_TIMEOUT_MAX_MS = 60_000
const GEO_DATASET_MAX_BYTES_MIN = 64 * 1024
const GEO_DATASET_MAX_BYTES_MAX = 50 * 1024 * 1024
const GEO_GRAPH_POI_COLOR_DEFAULT = '#2563EB'
const GEO_GRAPH_POI_SELECTED_COLOR_DEFAULT = '#2563EB'

const parseInteractionMode = (raw: unknown): 'off' | 'hold-space' | 'always' => {
  if (raw === 'off') return 'off'
  if (raw === 'always') return 'always'
  return 'hold-space'
}

const parseProjectionMode = (raw: unknown): 'auto' | 'mercator' | 'globe' => {
  if (raw === 'mercator') return 'mercator'
  if (raw === 'globe') return 'globe'
  return 'auto'
}

const normalizeHexColor = (raw: unknown, fallback: string): string => {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (/^#[0-9a-f]{6}$/i.test(s)) return s
  return fallback
}

const parseGeospatialDatasets = (raw: unknown): GeospatialDataset[] | null => {
  if (!Array.isArray(raw)) return null
  const out: GeospatialDataset[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    const enabled = rec.enabled !== false
    const sourceRaw = rec.source as unknown
    if (!sourceRaw || typeof sourceRaw !== 'object' || Array.isArray(sourceRaw)) continue
    const sourceRec = sourceRaw as Record<string, unknown>
    if (sourceRec.kind !== 'url') continue
    const url = typeof sourceRec.url === 'string' ? sourceRec.url.trim() : ''
    if (!id || !label || !url) continue
    out.push({
      id,
      label,
      enabled,
      source: { kind: 'url', url },
      format: parseGeospatialDatasetFormat(rec.format),
    })
  }
  return out
}

const createDatasetId = (): string => {
  const rnd = Math.random().toString(16).slice(2)
  return `geo:${Date.now().toString(16)}:${rnd}`
}

export const createGeospatialSlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
  get: () => GraphState,
): Pick<
  GraphState,
  | 'geospatialOverlayEnabled'
  | 'setGeospatialOverlayEnabled'
  | 'geospatialStyleUrl'
  | 'setGeospatialStyleUrl'
  | 'geospatialOverlayOpacity'
  | 'setGeospatialOverlayOpacity'
  | 'geospatialInteractionMode'
  | 'setGeospatialInteractionMode'
  | 'geospatialProjectionMode'
  | 'setGeospatialProjectionMode'
  | 'geospatialAnimateCamera'
  | 'setGeospatialAnimateCamera'
  | 'geospatialAutoFitEnabled'
  | 'setGeospatialAutoFitEnabled'
  | 'geospatialDatasets'
  | 'addGeospatialDatasetUrl'
  | 'removeGeospatialDataset'
  | 'toggleGeospatialDatasetEnabled'
  | 'setGeospatialDatasetLabel'
  | 'geospatialDatasetStatusById'
  | 'setGeospatialDatasetStatus'
  | 'geospatialDatasetTimeoutMs'
  | 'setGeospatialDatasetTimeoutMs'
  | 'geospatialDatasetMaxBytes'
  | 'setGeospatialDatasetMaxBytes'
  | 'geospatialGraphPoiColor'
  | 'setGeospatialGraphPoiColor'
  | 'geospatialGraphPoiSelectedColor'
  | 'setGeospatialGraphPoiSelectedColor'
  | 'geospatialFitRequest'
  | 'requestGeospatialFitToData'
  | 'clearGeospatialFitRequest'
> => {
  const geospatialOverlayEnabled = lsBool(LS_KEYS.geospatialOverlayEnabled, false)

  const geospatialStyleUrl = (() => {
    const v = lsJson(LS_KEYS.geospatialStyleUrl, DEFAULT_GEOSPATIAL_STYLE_URL, raw => {
      if (typeof raw !== 'string') return null
      const s = normalizeGeospatialStyleUrl(raw)
      return s ? s : DEFAULT_GEOSPATIAL_STYLE_URL
    })
    return normalizeGeospatialStyleUrl(v) || DEFAULT_GEOSPATIAL_STYLE_URL
  })()

  const geospatialOverlayOpacity = (() => {
    const v = lsNum(LS_KEYS.geospatialOverlayOpacity, DEFAULT_GEOSPATIAL_OVERLAY_OPACITY)
    return coerceGeospatialOverlayOpacity(geospatialOverlayEnabled, v)
  })()

  const geospatialInteractionMode = lsJson(LS_KEYS.geospatialInteractionMode, 'hold-space', raw => {
    if (typeof raw !== 'string') return null
    return parseInteractionMode(raw)
  })

  const geospatialProjectionMode = lsJson(LS_KEYS.geospatialProjectionMode, 'auto', raw => {
    if (typeof raw !== 'string') return null
    return parseProjectionMode(raw)
  })

  const geospatialAnimateCamera = lsBool(LS_KEYS.geospatialAnimateCamera, true)
  const geospatialAutoFitEnabled = lsBool(LS_KEYS.geospatialAutoFitEnabled, true)

  const geospatialDatasetTimeoutMs = (() => {
    const raw = lsInt(LS_KEYS.geospatialDatasetTimeoutMs, DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS)
    return clampInt(raw, GEO_DATASET_TIMEOUT_MIN_MS, GEO_DATASET_TIMEOUT_MAX_MS)
  })()

  const geospatialDatasetMaxBytes = (() => {
    const raw = lsInt(LS_KEYS.geospatialDatasetMaxBytes, DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES)
    return clampInt(raw, GEO_DATASET_MAX_BYTES_MIN, GEO_DATASET_MAX_BYTES_MAX)
  })()

  const geospatialGraphPoiColor = lsJson(LS_KEYS.geospatialGraphPoiColor, GEO_GRAPH_POI_COLOR_DEFAULT, raw =>
    typeof raw === 'string' ? normalizeHexColor(raw, GEO_GRAPH_POI_COLOR_DEFAULT) : null,
  )

  const geospatialGraphPoiSelectedColor = lsJson(
    LS_KEYS.geospatialGraphPoiSelectedColor,
    GEO_GRAPH_POI_SELECTED_COLOR_DEFAULT,
    raw => (typeof raw === 'string' ? normalizeHexColor(raw, GEO_GRAPH_POI_SELECTED_COLOR_DEFAULT) : null),
  )

  const geospatialDatasets = (() => {
    const envDefaults = parseGeospatialDatasetsFromEnv()
    const fallback = envDefaults ?? []
    return lsJson(LS_KEYS.geospatialDatasets, fallback, parseGeospatialDatasets)
  })()

  return {
    geospatialOverlayEnabled,
    setGeospatialOverlayEnabled: v => {
      const next = lsSetBool(LS_KEYS.geospatialOverlayEnabled, v)

      if (next) {
        const current = get().geospatialOverlayOpacity
        const ensured = coerceGeospatialOverlayOpacity(true, current)
        if (ensured !== current) {
          lsSetNum(LS_KEYS.geospatialOverlayOpacity, ensured)
          set(() => ({ geospatialOverlayOpacity: ensured }))
        }
      }

      set(() => ({ geospatialOverlayEnabled: next }))
    },

    geospatialStyleUrl,
    setGeospatialStyleUrl: raw => {
      const s = normalizeGeospatialStyleUrl(raw)
      const next = s ? s : DEFAULT_GEOSPATIAL_STYLE_URL
      lsSetJson(LS_KEYS.geospatialStyleUrl, next)
      set(() => ({ geospatialStyleUrl: next }))
    },

    geospatialOverlayOpacity,
    setGeospatialOverlayOpacity: v => {
      const next = clamp01(typeof v === 'number' ? v : DEFAULT_GEOSPATIAL_OVERLAY_OPACITY)
      lsSetNum(LS_KEYS.geospatialOverlayOpacity, next)
      set(() => ({ geospatialOverlayOpacity: next }))
    },

    geospatialInteractionMode,
    setGeospatialInteractionMode: mode => {
      const next = parseInteractionMode(mode)
      lsSetJson(LS_KEYS.geospatialInteractionMode, next)
      set(() => ({ geospatialInteractionMode: next }))
    },

    geospatialProjectionMode,
    setGeospatialProjectionMode: mode => {
      const next = parseProjectionMode(mode)
      lsSetJson(LS_KEYS.geospatialProjectionMode, next)
      set(() => ({ geospatialProjectionMode: next }))
    },

    geospatialAnimateCamera,
    setGeospatialAnimateCamera: v => {
      const next = lsSetBool(LS_KEYS.geospatialAnimateCamera, Boolean(v))
      set(() => ({ geospatialAnimateCamera: next }))
    },

    geospatialAutoFitEnabled,
    setGeospatialAutoFitEnabled: v => {
      const next = lsSetBool(LS_KEYS.geospatialAutoFitEnabled, Boolean(v))
      set(() => ({ geospatialAutoFitEnabled: next }))
    },

    geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs: v => {
      const raw = typeof v === 'number' ? v : DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS
      const next = lsSetInt(LS_KEYS.geospatialDatasetTimeoutMs, raw, {
        min: GEO_DATASET_TIMEOUT_MIN_MS,
        max: GEO_DATASET_TIMEOUT_MAX_MS,
      })
      set(() => ({ geospatialDatasetTimeoutMs: next }))
    },

    geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes: v => {
      const raw = typeof v === 'number' ? v : DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES
      const next = lsSetInt(LS_KEYS.geospatialDatasetMaxBytes, raw, {
        min: GEO_DATASET_MAX_BYTES_MIN,
        max: GEO_DATASET_MAX_BYTES_MAX,
      })
      set(() => ({ geospatialDatasetMaxBytes: next }))
    },

    geospatialGraphPoiColor,
    setGeospatialGraphPoiColor: v => {
      const next = normalizeHexColor(v, GEO_GRAPH_POI_COLOR_DEFAULT)
      lsSetJson(LS_KEYS.geospatialGraphPoiColor, next)
      set(() => ({ geospatialGraphPoiColor: next }))
    },

    geospatialGraphPoiSelectedColor,
    setGeospatialGraphPoiSelectedColor: v => {
      const next = normalizeHexColor(v, GEO_GRAPH_POI_SELECTED_COLOR_DEFAULT)
      lsSetJson(LS_KEYS.geospatialGraphPoiSelectedColor, next)
      set(() => ({ geospatialGraphPoiSelectedColor: next }))
    },

    geospatialDatasets,
    addGeospatialDatasetUrl: args => {
      const url = String(args?.url || '').trim()
      if (!url) return
      const label = String(args?.label || '').trim() || UI_COPY.geospatialDatasetDefaultLabel
      const format = parseGeospatialDatasetFormat(args?.format)
      const nextItem: GeospatialDataset = {
        id: createDatasetId(),
        label,
        enabled: true,
        source: { kind: 'url', url },
        format,
      }
      const current = get().geospatialDatasets || []
      const next = [...current, nextItem]
      lsSetJson(LS_KEYS.geospatialDatasets, next)
      set(() => ({ geospatialDatasets: next }))
    },

    removeGeospatialDataset: id => {
      const current = get().geospatialDatasets || []
      const next = current.filter(d => d.id !== id)
      if (next.length === current.length) return
      lsSetJson(LS_KEYS.geospatialDatasets, next)
      set(() => ({ geospatialDatasets: next }))
      set(s => {
        const status = s.geospatialDatasetStatusById || {}
        if (!(id in status)) return {}
        const copy = { ...status }
        delete copy[id]
        return { geospatialDatasetStatusById: copy }
      })
    },

    toggleGeospatialDatasetEnabled: id => {
      const current = get().geospatialDatasets || []
      const idx = current.findIndex(d => d.id === id)
      if (idx < 0) return
      const next = current.map(d => (d.id === id ? { ...d, enabled: !d.enabled } : d))
      lsSetJson(LS_KEYS.geospatialDatasets, next)
      set(() => ({ geospatialDatasets: next }))
    },

    setGeospatialDatasetLabel: (id, labelRaw) => {
      const label = String(labelRaw || '').trim()
      if (!label) return
      const current = get().geospatialDatasets || []
      const idx = current.findIndex(d => d.id === id)
      if (idx < 0) return
      const next = current.map(d => (d.id === id ? { ...d, label } : d))
      lsSetJson(LS_KEYS.geospatialDatasets, next)
      set(() => ({ geospatialDatasets: next }))
    },

    geospatialDatasetStatusById: {},
    setGeospatialDatasetStatus: (id, status) => {
      set(s => ({ geospatialDatasetStatusById: { ...(s.geospatialDatasetStatusById || {}), [id]: status } }))
    },

    geospatialFitRequest: null,
    requestGeospatialFitToData: () => {
      set(() => ({ geospatialFitRequest: { at: Date.now() } }))
    },
    clearGeospatialFitRequest: () => {
      set(() => ({ geospatialFitRequest: null }))
    },
  }
}
