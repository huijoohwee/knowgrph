import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsInt, lsJson, lsNum, lsSetInt, lsSetJson, lsSetNum } from '@/lib/persistence'
import type { GraphState } from '@/hooks/store/types'
import type {
  GeospatialDataset,
  GeospatialDatasetFormat,
} from '@/lib/geospatial/types'
import {
  DEFAULT_GEOSPATIAL_OVERLAY_OPACITY,
  DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES,
  DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS,
  DEFAULT_GEOSPATIAL_STYLE_URL,
  parseGeospatialDatasetsFromEnv,
} from '@/lib/geospatial/config'
import { normalizeGeospatialStyleUrl } from '@/lib/geospatial/styleUrl'
import { clamp01 } from '@/lib/math/clamp01'

const parseDatasetFormat = (raw: unknown): GeospatialDatasetFormat => {
  if (raw === 'geojson') return 'geojson'
  if (raw === 'records') return 'records'
  return 'auto'
}

const clampInt = (value: number, min: number, max: number): number => {
  const v = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, v))
}

const GEO_DATASET_TIMEOUT_MIN_MS = 1_000
const GEO_DATASET_TIMEOUT_MAX_MS = 60_000
const GEO_DATASET_MAX_BYTES_MIN = 64 * 1024
const GEO_DATASET_MAX_BYTES_MAX = 20 * 1024 * 1024

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
      format: parseDatasetFormat(rec.format),
    })
  }
  return out
}

const createDatasetId = (): string => {
  const rnd = Math.random().toString(16).slice(2)
  return `geo:${Date.now().toString(16)}:${rnd}`
}

export const createGeospatialDatasetsSlice = (
  set: (fn: (state: GraphState) => Partial<GraphState>) => void,
  get: () => GraphState,
): Pick<
  GraphState,
  | 'geospatialStyleUrl'
  | 'setGeospatialStyleUrl'
  | 'geospatialOverlayOpacity'
  | 'setGeospatialOverlayOpacity'
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
  | 'geospatialFitRequest'
  | 'requestGeospatialFitToData'
  | 'clearGeospatialFitRequest'
> => {
  const geospatialStyleUrl = (() => {
    const v = lsJson(LS_KEYS.geospatialStyleUrl, DEFAULT_GEOSPATIAL_STYLE_URL, (raw) => {
      if (typeof raw !== 'string') return null
      const s = normalizeGeospatialStyleUrl(raw)
      return s ? s : DEFAULT_GEOSPATIAL_STYLE_URL
    })
    return normalizeGeospatialStyleUrl(v) || DEFAULT_GEOSPATIAL_STYLE_URL
  })()

  const geospatialOverlayOpacity = (() => {
    const v = lsNum(LS_KEYS.geospatialOverlayOpacity, DEFAULT_GEOSPATIAL_OVERLAY_OPACITY)
    return clamp01(v)
  })()

  const geospatialDatasetTimeoutMs = (() => {
    const raw = lsInt(LS_KEYS.geospatialDatasetTimeoutMs, DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS)
    return clampInt(raw, GEO_DATASET_TIMEOUT_MIN_MS, GEO_DATASET_TIMEOUT_MAX_MS)
  })()

  const geospatialDatasetMaxBytes = (() => {
    const raw = lsInt(LS_KEYS.geospatialDatasetMaxBytes, DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES)
    return clampInt(raw, GEO_DATASET_MAX_BYTES_MIN, GEO_DATASET_MAX_BYTES_MAX)
  })()

  const geospatialDatasets = (() => {
    const envDefaults = parseGeospatialDatasetsFromEnv()
    const fallback = envDefaults ?? []
    return lsJson(LS_KEYS.geospatialDatasets, fallback, parseGeospatialDatasets)
  })()

  return {
    geospatialStyleUrl,
    setGeospatialStyleUrl: (raw) => {
      const s = normalizeGeospatialStyleUrl(raw)
      const next = s ? s : DEFAULT_GEOSPATIAL_STYLE_URL
      lsSetJson(LS_KEYS.geospatialStyleUrl, next)
      set(() => ({ geospatialStyleUrl: next }))
    },
    geospatialOverlayOpacity,
    setGeospatialOverlayOpacity: (v) => {
      const next = clamp01(typeof v === 'number' ? v : DEFAULT_GEOSPATIAL_OVERLAY_OPACITY)
      lsSetNum(LS_KEYS.geospatialOverlayOpacity, next)
      set(() => ({ geospatialOverlayOpacity: next }))
    },
    geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs: (v) => {
      const raw = typeof v === 'number' ? v : DEFAULT_GEOSPATIAL_DATASET_TIMEOUT_MS
      const next = lsSetInt(LS_KEYS.geospatialDatasetTimeoutMs, raw, {
        min: GEO_DATASET_TIMEOUT_MIN_MS,
        max: GEO_DATASET_TIMEOUT_MAX_MS,
      })
      set(() => ({ geospatialDatasetTimeoutMs: next }))
    },
    geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes: (v) => {
      const raw = typeof v === 'number' ? v : DEFAULT_GEOSPATIAL_DATASET_MAX_BYTES
      const next = lsSetInt(LS_KEYS.geospatialDatasetMaxBytes, raw, {
        min: GEO_DATASET_MAX_BYTES_MIN,
        max: GEO_DATASET_MAX_BYTES_MAX,
      })
      set(() => ({ geospatialDatasetMaxBytes: next }))
    },
    geospatialDatasets,
    addGeospatialDatasetUrl: (args) => {
      const url = String(args?.url || '').trim()
      if (!url) return
      const label = String(args?.label || '').trim() || UI_COPY.geospatialDatasetDefaultLabel
      const format = parseDatasetFormat(args?.format)
      const nextItem: GeospatialDataset = {
        id: createDatasetId(),
        label,
        enabled: true,
        source: { kind: 'url', url },
        format,
      }
      set((state) => {
        const next = [...(state.geospatialDatasets || []), nextItem]
        lsSetJson(LS_KEYS.geospatialDatasets, next)
        return { geospatialDatasets: next }
      })
    },
    removeGeospatialDataset: (id) => {
      const target = String(id || '').trim()
      if (!target) return
      set((state) => {
        const cur = state.geospatialDatasets || []
        const next = cur.filter(d => d.id !== target)
        if (next.length === cur.length) return {}
        lsSetJson(LS_KEYS.geospatialDatasets, next)
        const status = { ...(state.geospatialDatasetStatusById || {}) }
        delete status[target]
        return { geospatialDatasets: next, geospatialDatasetStatusById: status }
      })
    },
    toggleGeospatialDatasetEnabled: (id) => {
      const target = String(id || '').trim()
      if (!target) return
      set((state) => {
        const cur = state.geospatialDatasets || []
        const idx = cur.findIndex(d => d.id === target)
        if (idx < 0) return {}
        const nextItem = { ...cur[idx], enabled: !cur[idx].enabled }
        const next = [...cur.slice(0, idx), nextItem, ...cur.slice(idx + 1)]
        lsSetJson(LS_KEYS.geospatialDatasets, next)
        return { geospatialDatasets: next }
      })
    },
    setGeospatialDatasetLabel: (id, label) => {
      const target = String(id || '').trim()
      const nextLabel = String(label || '').trim()
      if (!target || !nextLabel) return
      set((state) => {
        const cur = state.geospatialDatasets || []
        const idx = cur.findIndex(d => d.id === target)
        if (idx < 0) return {}
        if (cur[idx].label === nextLabel) return {}
        const nextItem = { ...cur[idx], label: nextLabel }
        const next = [...cur.slice(0, idx), nextItem, ...cur.slice(idx + 1)]
        lsSetJson(LS_KEYS.geospatialDatasets, next)
        return { geospatialDatasets: next }
      })
    },
    geospatialDatasetStatusById: {},
    setGeospatialDatasetStatus: (id, status) => {
      const target = String(id || '').trim()
      if (!target) return
      set((state) => ({
        geospatialDatasetStatusById: {
          ...(state.geospatialDatasetStatusById || {}),
          [target]: status,
        },
      }))
    },
    geospatialFitRequest: null,
    requestGeospatialFitToData: () => {
      if (!get().geospatialOverlayEnabled) return
      set(() => ({ geospatialFitRequest: { at: Date.now() } }))
    },
    clearGeospatialFitRequest: () => set(() => ({ geospatialFitRequest: null })),
  }
}
