import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createPortal } from 'react-dom'
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { useGraphStore } from '@/hooks/useGraphStore'
import { graphNodesToPointFeatureCollection } from '@/lib/geospatial/geojson'
import { DEFAULT_GEOSPATIAL_STYLE_URL } from '@/lib/geospatial/config'
import { normalizeGeospatialStyleUrl } from '@/lib/geospatial/styleUrl'
import { applyMediaProxySrc, normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { LRUCache } from '@/lib/cache/LRUCache'
import { clamp01 } from '@/lib/math/clamp01'
import {
  applyPreferredStyle,
  buildBlankStyle,
  colorForDataset,
  computeBoundsFromCollections,
  ensureDatasetLayer,
  ensureGraphPointLayer,
  loadDatasetFeatureCollection,
  setGeoJsonSourceData,
} from '@/features/geospatial/geospatialOverlayUtils'

const GEO_SOURCE_PREFIX = 'kg-geo-ds'
const GRAPH_SOURCE_ID = 'kg-geo-graph-nodes'
const GRAPH_LAYER_ID = 'kg-geo-graph-nodes-layer'

const datasetCache = new LRUCache<string, FeatureCollection>(40, 10 * 60 * 1000)

function toSourceId(datasetId: string): string {
  return `${GEO_SOURCE_PREFIX}:${datasetId}`
}

export function GeospatialOverlay() {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const lastZoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(null)
  const lastStyleUrlRef = React.useRef<string | null>(null)
  const lastAutoFitKeyRef = React.useRef<string | null>(null)
  const targetStyleUrlRef = React.useRef<string>(DEFAULT_GEOSPATIAL_STYLE_URL)
  const mapListenersRef = React.useRef<{ onMapError: (e: unknown) => void; onStyleReady: () => void } | null>(null)
  const lastMapRequestRef = React.useRef<{ input: string; output: string } | null>(null)
  const basemapProbeRef = React.useRef<{
    tileSourceId: string
    styleLoaded: boolean
    tilesLoaded: boolean
    sourceLoaded: boolean
    canvasW: number
    canvasH: number
  }>({ tileSourceId: '', styleLoaded: false, tilesLoaded: false, sourceLoaded: false, canvasW: 0, canvasH: 0 })
  const lastToastKeyRef = React.useRef<string>('')
  const lastToastEventKeyRef = React.useRef<string>('')
  const pendingDismissToastTimeoutRef = React.useRef<number | null>(null)

  const [styleRevision, setStyleRevision] = React.useState(0)
  const [mapError, setMapError] = React.useState<string | null>(null)
  const [statusRevision, setStatusRevision] = React.useState(0)

  const {
    enabled,
    styleUrl,
    overlayOpacity,
    graphData,
    zoomState,
    canvasRenderMode,
    datasets,
    setDatasetStatus,
    fitRequest,
    clearFitRequest,
    datasetTimeoutMs,
    datasetMaxBytes,
    pushUiToast,
    upsertUiToast,
    dismissUiToast,
  } = useGraphStore(
    useShallow(s => ({
      enabled: s.geospatialOverlayEnabled,
      styleUrl: s.geospatialStyleUrl,
      overlayOpacity: s.geospatialOverlayOpacity,
      graphData: s.graphData,
      zoomState: s.zoomState,
      canvasRenderMode: s.canvasRenderMode,
      datasets: s.geospatialDatasets,
      setDatasetStatus: s.setGeospatialDatasetStatus,
      fitRequest: s.geospatialFitRequest,
      clearFitRequest: s.clearGeospatialFitRequest,
      datasetTimeoutMs: s.geospatialDatasetTimeoutMs,
      datasetMaxBytes: s.geospatialDatasetMaxBytes,
      pushUiToast: s.pushUiToast,
      upsertUiToast: s.upsertUiToast,
      dismissUiToast: s.dismissUiToast,
    })),
  )

  const graphPoints = React.useMemo(() => {
    if (!graphData || graphData.type !== 'Graph') {
      return { type: 'FeatureCollection', features: [] } as FeatureCollection
    }
    return graphNodesToPointFeatureCollection(graphData)
  }, [graphData])

  const targetStyleUrl = React.useMemo(() => {
    const normalizedStyleUrlRaw = String(styleUrl || '').trim()
    const isDefault =
      !normalizedStyleUrlRaw || normalizedStyleUrlRaw.toLowerCase() === 'blank' || normalizedStyleUrlRaw.toLowerCase() === 'none'
    const next = isDefault ? DEFAULT_GEOSPATIAL_STYLE_URL : normalizeGeospatialStyleUrl(normalizedStyleUrlRaw)
    return next || DEFAULT_GEOSPATIAL_STYLE_URL
  }, [styleUrl])

  React.useEffect(() => {
    targetStyleUrlRef.current = targetStyleUrl
  }, [targetStyleUrl])

  React.useEffect(() => {
    if (!enabled) return
    if (!containerRef.current) return
    if (mapRef.current) return

    setMapError(null)
    basemapProbeRef.current = { tileSourceId: '', styleLoaded: false, tilesLoaded: false, sourceLoaded: false, canvasW: 0, canvasH: 0 }

    const initialStyleUrl = targetStyleUrlRef.current

    let cancelled = false
    let timeoutId: number | null = null
    let bootTimeoutId: number | null = null
    let readyIntervalId: number | null = null
    let pulseIntervalId: number | null = null
    let resizeObserver: ResizeObserver | null = null

    const forceViewportSize = () => {
      if (typeof window === 'undefined') return
      const el = rootRef.current
      if (!el) return
      const w = Math.max(0, Math.floor(window.innerWidth || 0))
      const h = Math.max(0, Math.floor(window.innerHeight || 0))
      if (w > 0) el.style.width = `${w}px`
      if (h > 0) el.style.height = `${h}px`
    }

    const readContainerSize = (): { w: number; h: number } => {
      const vw = (() => {
        try {
          if (typeof window === 'undefined') return 0
          return Math.max(0, Math.floor(window.innerWidth || 0))
        } catch {
          return 0
        }
      })()
      const vh = (() => {
        try {
          if (typeof window === 'undefined') return 0
          return Math.max(0, Math.floor(window.innerHeight || 0))
        } catch {
          return 0
        }
      })()

      try {
        const el = rootRef.current
        if (!el) return { w: vw, h: vh }
        const rect = el.getBoundingClientRect()
        const w = Number.isFinite(rect.width) ? Math.max(0, Math.floor(rect.width)) : 0
        const h = Number.isFinite(rect.height) ? Math.max(0, Math.floor(rect.height)) : 0
        if (w > 0 && h > 0) return { w, h }
        if (vw > 0 && vh > 0) return { w: vw, h: vh }
        return { w, h }
      } catch {
        return { w: vw, h: vh }
      }
    }

    timeoutId = window.setTimeout(() => {
      if (cancelled) return
      if (!containerRef.current) return
      if (mapRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: buildBlankStyle() as never,
        center: [0, 0],
        zoom: 1,
        interactive: false,
        attributionControl: false,
        transformRequest: (url) => {
          const normalized = normalizeGitHubBlobLikeUrl(url) ?? url
          const proxied = applyMediaProxySrc(normalized)
          if (typeof window === 'undefined') return { url: proxied }
          try {
            const out = new URL(proxied).toString()
            lastMapRequestRef.current = { input: normalized, output: out }
            return { url: out }
          } catch {
            try {
              const out = new URL(proxied, window.location.origin).toString()
              lastMapRequestRef.current = { input: normalized, output: out }
              return { url: out }
            } catch {
              lastMapRequestRef.current = { input: normalized, output: proxied }
              return { url: proxied }
            }
          }
        },
      })
      mapRef.current = map
      lastStyleUrlRef.current = initialStyleUrl

      const deriveTileSourceId = (): string => {
        if (basemapProbeRef.current.tileSourceId) return basemapProbeRef.current.tileSourceId
        try {
          const style = map.getStyle() as unknown as { sources?: Record<string, unknown> }
          const sources = style && typeof style === 'object' && style.sources && typeof style.sources === 'object' ? style.sources : null
          if (!sources) return ''
          for (const [id, srcRaw] of Object.entries(sources)) {
            if (!srcRaw || typeof srcRaw !== 'object' || Array.isArray(srcRaw)) continue
            const src = srcRaw as Record<string, unknown>
            const type = typeof src.type === 'string' ? src.type : ''
            if (type === 'geojson') continue
            const hasTiles = Array.isArray(src.tiles) && src.tiles.length > 0
            const hasUrl = typeof src.url === 'string' && src.url.trim().length > 0
            if (hasTiles || hasUrl) return id
          }
          return ''
        } catch {
          return ''
        }
      }

      const onMapError = (e: unknown) => {
        const extractUrl = (raw: unknown): string => {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ''
          const url = (raw as { url?: unknown }).url
          return typeof url === 'string' ? url : ''
        }
        const extractMessage = (raw: unknown): string => {
          if (raw instanceof Error) return raw.message
          if (typeof raw === 'string') return raw
          if (raw && typeof raw === 'object' && 'message' in raw) return String((raw as { message?: unknown }).message || '')
          return ''
        }

        const payload = typeof e === 'object' && e && 'error' in e ? (e as { error?: unknown }).error : null
        const payloadUrl = extractUrl(payload)
        const evUrl = extractUrl(e)
        const url = payloadUrl || evUrl
        const base = extractMessage(payload) || extractMessage(e) || 'Map load error'
        const message = (() => {
          if (url) return `${base} (${url})`
          const last = lastMapRequestRef.current
          if (last?.output) return `${base} (lastRequest=${last.output})`
          return base
        })()
        setMapError(message)
        console.error('[geospatial] MapLibre error', e)
      }
      const onStyleReady = () => {
        setStyleRevision(v => v + 1)
        try {
          forceViewportSize()
          map.resize()
        } catch {
          void 0
        }
      }

      mapListenersRef.current = { onMapError, onStyleReady }

      map.on('error', onMapError)
      map.on('load', onStyleReady)
      map.on('style.load', onStyleReady)

      try {
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            if (cancelled) return
            try {
              forceViewportSize()
              map.resize()
              const prev = basemapProbeRef.current
              const size = readContainerSize()
              basemapProbeRef.current = { ...prev, canvasW: size.w, canvasH: size.h }
              setStatusRevision(v => (v + 1) % 1_000_000)
            } catch {
              void 0
            }
          })
          if (rootRef.current) resizeObserver.observe(rootRef.current)
        }
      } catch {
        resizeObserver = null
      }

      readyIntervalId = window.setInterval(() => {
        if (cancelled) return
        try {
          const anyMap = map as unknown as {
            isStyleLoaded?: () => boolean
            areTilesLoaded?: () => boolean
            isSourceLoaded?: (id: string) => boolean
          }
          const styleOkRaw: unknown =
            typeof anyMap.isStyleLoaded === 'function'
              ? (anyMap.isStyleLoaded as unknown as () => unknown)()
              : (map.isStyleLoaded as unknown as () => unknown)()
          const styleOk = styleOkRaw === true
          const canvasSize = readContainerSize()

          const tilesOkRaw: unknown =
            typeof anyMap.areTilesLoaded === 'function'
              ? (anyMap.areTilesLoaded as unknown as () => unknown)()
              : false
          const tilesOk = tilesOkRaw === true

          const tileSourceId = deriveTileSourceId()

          const sourceOkRaw: unknown =
            tileSourceId && typeof anyMap.isSourceLoaded === 'function'
              ? (anyMap.isSourceLoaded as unknown as (id: string) => unknown)(tileSourceId)
              : false
          const sourceOk = sourceOkRaw === true

          const prev = basemapProbeRef.current
          basemapProbeRef.current = {
            ...prev,
            tileSourceId,
            styleLoaded: styleOk,
            tilesLoaded: tilesOk,
            sourceLoaded: sourceOk,
            canvasW: canvasSize.w,
            canvasH: canvasSize.h,
          }

          if (canvasSize.w === 0 || canvasSize.h === 0) {
            try {
              forceViewportSize()
              map.resize()
            } catch {
              void 0
            }
          }

        } catch {
          void 0
        }
      }, 400)

      pulseIntervalId = window.setInterval(() => {
        if (cancelled) return
        setStatusRevision(v => (v + 1) % 1_000_000)
      }, 1_000)

      void (async () => {
        const ok = await applyPreferredStyle(map, initialStyleUrl, () => cancelled)
        if (cancelled) return
        if (!ok) {
          try {
            map.setStyle(initialStyleUrl as never)
          } catch {
            void 0
          }
          setMapError(prev => prev ?? 'Failed to load map style.')
          return
        }
      })()

      try {
        if (canvasRenderMode === '3d') {
          map.setProjection({ type: 'globe' } as never)
        } else {
          map.setProjection({ type: 'mercator' } as never)
        }
      } catch {
        void 0
      }
    }, 0)

      bootTimeoutId = window.setTimeout(() => {
      if (cancelled) return
        const probe = basemapProbeRef.current
        const derivedReady = Boolean(
          probe.tileSourceId &&
            probe.styleLoaded &&
            probe.tilesLoaded &&
            probe.sourceLoaded &&
            probe.canvasW > 0 &&
            probe.canvasH > 0,
        )
        if (derivedReady) return
      const last = lastMapRequestRef.current
      const suffix = last?.output ? ` (lastRequest=${last.output})` : ''
      setMapError(prev => prev ?? `Basemap did not load. Check style URL, CORS, or network.${suffix}`)
    }, 12_000)

    return () => {
      cancelled = true
      if (timeoutId != null) {
        try {
          window.clearTimeout(timeoutId)
        } catch {
          void 0
        }
      }
      if (bootTimeoutId != null) {
        try {
          window.clearTimeout(bootTimeoutId)
        } catch {
          void 0
        }
      }
      if (readyIntervalId != null) {
        try {
          window.clearInterval(readyIntervalId)
        } catch {
          void 0
        }
      }
      if (pulseIntervalId != null) {
        try {
          window.clearInterval(pulseIntervalId)
        } catch {
          void 0
        }
      }
      if (resizeObserver) {
        try {
          resizeObserver.disconnect()
        } catch {
          void 0
        }
        resizeObserver = null
      }
      try {
        const map = mapRef.current
        const listeners = mapListenersRef.current
        if (map && listeners) {
          map.off('error', listeners.onMapError)
          map.off('load', listeners.onStyleReady)
          map.off('style.load', listeners.onStyleReady)
        }
      } catch {
        void 0
      }
      try {
        mapRef.current?.remove()
      } catch {
        void 0
      }
      mapRef.current = null
      mapListenersRef.current = null
      lastZoomStateRef.current = null
      lastStyleUrlRef.current = null
      lastAutoFitKeyRef.current = null
    }
  }, [enabled])

  // Effect to handle style changes dynamically
  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (lastStyleUrlRef.current === targetStyleUrl) return

    let cancelled = false
    const isCancelled = () => cancelled
    void (async () => {
        // If it's a URL, use applyPreferredStyle, otherwise if it was an object we'd set it directly
        // Here we assume it's a URL
        const ok = await applyPreferredStyle(map, targetStyleUrl, isCancelled)
        if (isCancelled()) return
        if (!ok) {
          setMapError(prev => prev ?? 'Failed to load map style.')
          return
        }
        setMapError(null)
        lastStyleUrlRef.current = targetStyleUrl
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, targetStyleUrl])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (!map.isStyleLoaded()) return
    try {
      ensureGraphPointLayer(map, GRAPH_SOURCE_ID, GRAPH_LAYER_ID)
      setGeoJsonSourceData(map, GRAPH_SOURCE_ID, graphPoints)
    } catch {
      void 0
    }
  }, [enabled, graphPoints, styleRevision])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    try {
      if (canvasRenderMode === '3d') {
        map.setProjection({ type: 'globe' } as never)
      } else {
        map.setProjection({ type: 'mercator' } as never)
      }
    } catch {
      void 0
    }
  }, [enabled, canvasRenderMode])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (!map.isStyleLoaded()) return

    datasets.forEach((d) => {
      if (!d.enabled) return
      try {
        ensureDatasetLayer(map, toSourceId(d.id), colorForDataset(d.id))
      } catch {
        void 0
      }
    })
  }, [enabled, datasets, styleRevision])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (!map.isStyleLoaded()) return

    let cancelled = false
    const run = async () => {
      for (const d of datasets) {
        const sourceId = toSourceId(d.id)
        if (!d.enabled) continue
        setDatasetStatus(d.id, { state: 'loading' })
        try {
          const fc = await loadDatasetFeatureCollection(
            d.source.url,
            d.format,
            { timeoutMs: datasetTimeoutMs, maxBytes: datasetMaxBytes },
            datasetCache,
          )
          if (cancelled) return
          ensureDatasetLayer(map, sourceId, colorForDataset(d.id))
          setGeoJsonSourceData(map, sourceId, fc)
          setDatasetStatus(d.id, { state: 'ready', featureCount: Array.isArray(fc.features) ? fc.features.length : 0 })
        } catch (err) {
          if (cancelled) return
          const message = err instanceof Error ? err.message : 'Dataset load failed.'
          setDatasetStatus(d.id, { state: 'error', message })
        }
      }
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [enabled, datasets, setDatasetStatus, datasetTimeoutMs, datasetMaxBytes, styleRevision])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (canvasRenderMode !== '2d') return
    const z = zoomState
    if (!z) return
    const prev = lastZoomStateRef.current
    if (!prev) {
      lastZoomStateRef.current = { k: z.k, x: z.x, y: z.y }
      return
    }
    const dx = z.x - prev.x
    const dy = z.y - prev.y
    const dk = z.k / (prev.k || 1)
    lastZoomStateRef.current = { k: z.k, x: z.x, y: z.y }

    if (Number.isFinite(dx) && Number.isFinite(dy) && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01)) {
      try {
        map.panBy([dx, dy], { duration: 0 })
      } catch {
        void 0
      }
    }
    if (Number.isFinite(dk) && dk > 0 && Math.abs(dk - 1) > 0.0001) {
      const zoomDelta = Math.log2(dk)
      if (Number.isFinite(zoomDelta) && Math.abs(zoomDelta) > 0.0001) {
        try {
          map.zoomTo(map.getZoom() + zoomDelta, { duration: 0 })
        } catch {
          void 0
        }
      }
    }
  }, [enabled, zoomState, canvasRenderMode])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (!fitRequest) return

    const sources: FeatureCollection[] = []
    if (graphPoints.features.length > 0) sources.push(graphPoints)

    for (const d of datasets) {
      if (!d.enabled) continue
      const normalized = normalizeGitHubBlobLikeUrl(d.source.url) ?? d.source.url
      const fc = datasetCache.get(normalized)
      if (fc) sources.push(fc)
    }

    const bounds = computeBoundsFromCollections(sources)
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: 40, duration: 0 })
      } catch {
        void 0
      }
    }
    clearFitRequest()
  }, [enabled, fitRequest, clearFitRequest, graphPoints, datasets])

  React.useEffect(() => {
    const map = mapRef.current
    if (!enabled || !map) return
    if (canvasRenderMode !== '3d') return
    if (!map.isStyleLoaded()) return

    const enabledDatasets = datasets.filter(d => d.enabled)
    const parts: string[] = [`m:3d`, `g:${graphPoints.features.length}`]
    for (const d of enabledDatasets) {
      const normalized = normalizeGitHubBlobLikeUrl(d.source.url) ?? d.source.url
      const fc = datasetCache.get(normalized)
      parts.push(`d:${d.id}:${fc ? fc.features.length : 0}`)
    }
    const key = parts.join('|')
    if (lastAutoFitKeyRef.current === key) return

    const sources: FeatureCollection[] = []
    if (graphPoints.features.length > 0) sources.push(graphPoints)
    for (const d of enabledDatasets) {
      const normalized = normalizeGitHubBlobLikeUrl(d.source.url) ?? d.source.url
      const fc = datasetCache.get(normalized)
      if (fc) sources.push(fc)
    }
    const bounds = computeBoundsFromCollections(sources)
    if (!bounds) {
      lastAutoFitKeyRef.current = key
      return
    }
    try {
      map.fitBounds(bounds, { padding: 40, duration: 0 })
    } catch {
      void 0
    }
    lastAutoFitKeyRef.current = key
  }, [enabled, canvasRenderMode, graphPoints, datasets])

  if (!enabled) return null

  const clampedOpacity = clamp01(overlayOpacity)
  const showOpacityWarning = !(clampedOpacity > 0)

  const toastLoadingId = 'geospatial:basemap:loading'
  const probe = basemapProbeRef.current
  const derivedReady = Boolean(
    probe.tileSourceId &&
      probe.styleLoaded &&
      probe.sourceLoaded &&
      probe.tilesLoaded &&
      probe.canvasW > 0 &&
      probe.canvasH > 0,
  )

  React.useEffect(() => {
    if (!derivedReady) return
    setMapError(null)
  }, [derivedReady])

  const formatToastUrl = (raw: string): string => {
    const msg = String(raw || '').trim()
    if (!msg) return ''
    if (typeof window === 'undefined') return msg
    try {
      const u = new URL(msg, window.location.origin)
      if (u.pathname === '/__fetch_remote') {
        const inner = u.searchParams.get('url')
        if (inner) {
          try {
            return new URL(inner).toString()
          } catch {
            return inner
          }
        }
      }
      if (u.origin === window.location.origin) return `${u.pathname}${u.search}${u.hash}`
      return u.toString()
    } catch {
      return msg
    }
  }

  React.useEffect(() => {
    if (pendingDismissToastTimeoutRef.current != null) {
      try {
        window.clearTimeout(pendingDismissToastTimeoutRef.current)
      } catch {
        void 0
      }
      pendingDismissToastTimeoutRef.current = null
    }
    if (mapError != null) {
      const message = String(mapError || '').trim()
      if (!message) return
      const eventKey = `error|${message}`
      if (lastToastEventKeyRef.current !== eventKey) {
        lastToastEventKeyRef.current = eventKey
        pushUiToast({ id: `geospatial:basemap:error:${Date.now()}`, kind: 'error', message, ttlMs: 10_000, dismissible: true })
      }
      pendingDismissToastTimeoutRef.current = window.setTimeout(() => {
        dismissUiToast(toastLoadingId)
      }, 1200)
      return
    }

    if (showOpacityWarning) {
      const message = 'Geospatial Mode is ON, but overlay opacity is 0%. Increase opacity to see the basemap.'
      const eventKey = `warning|${message}`
      if (lastToastEventKeyRef.current !== eventKey) {
        lastToastEventKeyRef.current = eventKey
        pushUiToast({ id: `geospatial:basemap:warning:${Date.now()}`, kind: 'warning', message, ttlMs: 10_000, dismissible: true })
      }
      if (derivedReady) {
        pendingDismissToastTimeoutRef.current = window.setTimeout(() => {
          dismissUiToast(toastLoadingId)
        }, 1200)
      }
      return
    }

    if (derivedReady) {
      const message = 'Basemap loaded.'
      const eventKey = `success|${message}`
      if (lastToastEventKeyRef.current !== eventKey) {
        lastToastEventKeyRef.current = eventKey
        pushUiToast({ id: `geospatial:basemap:success:${Date.now()}`, kind: 'success', message, ttlMs: 6000, dismissible: true })
      }
      pendingDismissToastTimeoutRef.current = window.setTimeout(() => {
        dismissUiToast(toastLoadingId)
      }, 1200)
      return
    }

    const last = lastMapRequestRef.current
    const parts: string[] = ['Loading basemap…']
    parts.push(`style=${targetStyleUrl}`)
    parts.push(`styleLoaded=${probe.styleLoaded ? 'yes' : 'no'}`)
    parts.push(`tilesLoaded=${probe.tilesLoaded ? 'yes' : 'no'}`)
    parts.push(`sourceLoaded=${probe.sourceLoaded ? 'yes' : 'no'}`)
    parts.push(`canvas=${probe.canvasW}x${probe.canvasH}`)
    try {
      if (typeof window !== 'undefined') {
        parts.push(`viewport=${Math.floor(window.innerWidth || 0)}x${Math.floor(window.innerHeight || 0)}`)
      }
    } catch {
      void 0
    }
    if (probe.tileSourceId) parts.push(`source=${probe.tileSourceId}`)
    if (last?.output) parts.push(`lastRequest=${formatToastUrl(last.output)}`)
    void statusRevision
    const message = parts.join(' · ')
    const key = `loading|${message}`
    if (lastToastKeyRef.current === key) return
    lastToastKeyRef.current = key
    upsertUiToast({ id: toastLoadingId, kind: 'neutral', message, ttlMs: null, dismissible: true })
  }, [derivedReady, dismissUiToast, formatToastUrl, mapError, probe.sourceLoaded, probe.styleLoaded, probe.tileSourceId, probe.tilesLoaded, pushUiToast, showOpacityWarning, statusRevision, upsertUiToast])

  React.useEffect(() => {
    return () => {
      if (pendingDismissToastTimeoutRef.current != null) {
        try {
          window.clearTimeout(pendingDismissToastTimeoutRef.current)
        } catch {
          void 0
        }
        pendingDismissToastTimeoutRef.current = null
      }
      dismissUiToast(toastLoadingId)
    }
  }, [dismissUiToast])

  const overlay = (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[15] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
      aria-hidden="true"
    >
      <div className="absolute inset-0" style={{ opacity: clampedOpacity }}>
        <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )

  if (typeof document === 'undefined') return overlay
  return createPortal(overlay, document.body)
}

export default GeospatialOverlay
