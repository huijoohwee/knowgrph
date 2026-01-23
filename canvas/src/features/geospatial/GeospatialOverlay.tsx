import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { useGraphStore } from '@/hooks/useGraphStore'
import { graphNodesToPointFeatureCollection } from '@/lib/geospatial/geojson'
import { normalizeGeospatialStyleUrl } from '@/lib/geospatial/styleUrl'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { LRUCache } from '@/lib/cache/LRUCache'
import { clamp01 } from '@/lib/math/clamp01'
import {
  applyPreferredStyle,
  colorForDataset,
  computeBoundsFromCollections,
  ensureDatasetLayer,
  ensureGraphPointLayer,
  loadDatasetFeatureCollection,
  setGeoJsonSourceData,
  OPENFREEMAP_STYLE_URL,
} from '@/features/geospatial/geospatialOverlayUtils'

const GEO_SOURCE_PREFIX = 'kg-geo-ds'
const GRAPH_SOURCE_ID = 'kg-geo-graph-nodes'
const GRAPH_LAYER_ID = 'kg-geo-graph-nodes-layer'

const datasetCache = new LRUCache<string, FeatureCollection>(40, 10 * 60 * 1000)

function toSourceId(datasetId: string): string {
  return `${GEO_SOURCE_PREFIX}:${datasetId}`
}

export function GeospatialOverlay() {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const lastZoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(null)
  const lastStyleUrlRef = React.useRef<string | null>(null)
  const lastAutoFitKeyRef = React.useRef<string | null>(null)
  const targetStyleUrlRef = React.useRef<string>(OPENFREEMAP_STYLE_URL)
  const mapListenersRef = React.useRef<{ onMapError: (e: unknown) => void; onStyleReady: () => void } | null>(null)

  const [styleRevision, setStyleRevision] = React.useState(0)
  const [mapError, setMapError] = React.useState<string | null>(null)

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
    const next = isDefault ? OPENFREEMAP_STYLE_URL : normalizeGeospatialStyleUrl(normalizedStyleUrlRaw)
    return next || OPENFREEMAP_STYLE_URL
  }, [styleUrl])

  React.useEffect(() => {
    targetStyleUrlRef.current = targetStyleUrl
  }, [targetStyleUrl])

  React.useEffect(() => {
    if (!enabled) return
    if (!containerRef.current) return
    if (mapRef.current) return

    setMapError(null)

    const initialStyleUrl = targetStyleUrlRef.current

    let cancelled = false
    let timeoutId: number | null = null

    timeoutId = window.setTimeout(() => {
      if (cancelled) return
      if (!containerRef.current) return
      if (mapRef.current) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyleUrl,
        center: [0, 0],
        zoom: 1,
        interactive: false,
        attributionControl: false,
        transformRequest: (url) => {
          const normalized = normalizeGitHubBlobLikeUrl(url) ?? url
          return { url: normalized }
        },
      })
      mapRef.current = map
      lastStyleUrlRef.current = initialStyleUrl

      const onMapError = (e: unknown) => {
      const extractMessage = (raw: unknown): string => {
        if (raw instanceof Error) return raw.message
        if (typeof raw === 'string') return raw
        if (raw && typeof raw === 'object' && 'message' in raw) return String((raw as { message?: unknown }).message || '')
        return ''
      }

      const payload = typeof e === 'object' && e && 'error' in e ? (e as { error?: unknown }).error : null
      const message = extractMessage(payload) || extractMessage(e) || 'Map load error'
      setMapError(prev => prev ?? message)
      console.error('[geospatial] MapLibre error', e)
      }
      const onStyleReady = () => setStyleRevision(v => v + 1)

      mapListenersRef.current = { onMapError, onStyleReady }

      map.on('error', onMapError)
      map.on('load', onStyleReady)
      map.on('style.load', onStyleReady)

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

    return () => {
      cancelled = true
      if (timeoutId != null) {
        try {
          window.clearTimeout(timeoutId)
        } catch {
          void 0
        }
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

  return (
    <div
      className="absolute inset-0 z-[15] pointer-events-none"
      style={{ opacity: clamp01(overlayOpacity) }}
      aria-hidden="true"
    >
      {mapError ? (
        <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
          {mapError}
        </div>
      ) : null}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}

export default GeospatialOverlay
