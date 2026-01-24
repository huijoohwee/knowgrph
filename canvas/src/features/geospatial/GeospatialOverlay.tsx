import React from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import type { FeatureCollection } from 'geojson'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { LRUCache } from '@/lib/cache/LRUCache'
import { clamp01 } from '@/lib/math/clamp01'
import { normalizeGitHubBlobLikeUrl } from '@/lib/url'
import { graphNodesToPointFeatureCollection } from '@/lib/geospatial/geojson'
import { DEFAULT_GEOSPATIAL_STYLE_URL } from '@/lib/geospatial/config'
import { normalizeGeospatialStyleUrl } from '@/lib/geospatial/styleUrl'
import {
  colorForDataset,
  computeBoundsFromCollections,
  ensureDatasetLayer,
  ensureGraphPointLayer,
  loadDatasetFeatureCollection,
  setGeoJsonSourceData,
} from '@/features/geospatial/geospatialOverlayUtils'
import { useHeldKey } from '@/features/geospatial/useHeldKey'
import { setMapInteractionEnabled } from '@/features/geospatial/mapLibreInteractions'
import { useMapLibreBasemap } from '@/features/geospatial/useMapLibreBasemap'

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
  const lastZoomStateRef = React.useRef<{ k: number; x: number; y: number } | null>(null)
  const lastAutoFitKeyRef = React.useRef<string | null>(null)
  const lastToastKeyRef = React.useRef<string>('')
  const lastToastEventKeyRef = React.useRef<string>('')
  const pendingDismissToastTimeoutRef = React.useRef<number | null>(null)

  const {
    enabled,
    styleUrl,
    overlayOpacity,
    interactionMode,
    projectionMode,
    animateCamera,
    autoFitEnabled,
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
      interactionMode: s.geospatialInteractionMode,
      projectionMode: s.geospatialProjectionMode,
      animateCamera: s.geospatialAnimateCamera,
      autoFitEnabled: s.geospatialAutoFitEnabled,
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

  const { map, mapError, styleRevision, statusRevision, probe, lastMapRequestRef } = useMapLibreBasemap({
    enabled,
    rootRef,
    containerRef,
    targetStyleUrl,
    canvasRenderMode,
    projectionMode,
  })

  const holdingSpace = useHeldKey({ enabled: enabled && interactionMode === 'hold-space', code: 'Space' })
  const interactionActive = interactionMode === 'always' ? true : interactionMode === 'off' ? false : holdingSpace

  React.useEffect(() => {
    if (!enabled || !map) return
    setMapInteractionEnabled(map, interactionActive)
  }, [enabled, interactionActive, map])

  React.useEffect(() => {
    if (!enabled || !map) return
    if (!map.isStyleLoaded()) return
    try {
      ensureGraphPointLayer(map, GRAPH_SOURCE_ID, GRAPH_LAYER_ID)
      setGeoJsonSourceData(map, GRAPH_SOURCE_ID, graphPoints)
    } catch {
      void 0
    }
  }, [enabled, map, graphPoints, styleRevision])

  React.useEffect(() => {
    if (!enabled || !map) return
    if (!map.isStyleLoaded()) return

    datasets.forEach(d => {
      if (!d.enabled) return
      try {
        ensureDatasetLayer(map, toSourceId(d.id), colorForDataset(d.id))
      } catch {
        void 0
      }
    })
  }, [enabled, map, datasets, styleRevision])

  React.useEffect(() => {
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
          setDatasetStatus(d.id, {
            state: 'ready',
            featureCount: Array.isArray(fc.features) ? fc.features.length : 0,
          })
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
  }, [enabled, map, datasets, setDatasetStatus, datasetTimeoutMs, datasetMaxBytes, styleRevision])

  React.useEffect(() => {
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
  }, [enabled, map, zoomState, canvasRenderMode])

  React.useEffect(() => {
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
        map.fitBounds(bounds, { padding: 40, duration: animateCamera ? 500 : 0 })
      } catch {
        void 0
      }
    }
    clearFitRequest()
  }, [enabled, map, fitRequest, clearFitRequest, graphPoints, datasets, animateCamera])

  React.useEffect(() => {
    if (!enabled || !map) return
    if (canvasRenderMode !== '3d') return
    if (!autoFitEnabled) return
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
      map.fitBounds(bounds, { padding: 40, duration: animateCamera ? 700 : 0 })
    } catch {
      void 0
    }
    lastAutoFitKeyRef.current = key
  }, [enabled, map, canvasRenderMode, graphPoints, datasets, animateCamera, autoFitEnabled])

  const clampedOpacity = clamp01(overlayOpacity)
  const showOpacityWarning = !(clampedOpacity > 0)

  const toastLoadingId = 'geospatial:basemap:loading'
  const derivedReady = Boolean(
    probe.tileSourceId &&
      probe.styleLoaded &&
      probe.sourceLoaded &&
      probe.tilesLoaded &&
      probe.canvasW > 0 &&
      probe.canvasH > 0,
  )

  React.useEffect(() => {
    if (!enabled) {
      if (pendingDismissToastTimeoutRef.current != null) {
        try {
          window.clearTimeout(pendingDismissToastTimeoutRef.current)
        } catch {
          void 0
        }
        pendingDismissToastTimeoutRef.current = null
      }
      dismissUiToast(toastLoadingId)
      return
    }

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
        pushUiToast({
          id: `geospatial:basemap:error:${Date.now()}`,
          kind: 'error',
          message,
          ttlMs: 10_000,
          dismissible: true,
        })
      }
      pendingDismissToastTimeoutRef.current = window.setTimeout(() => {
        dismissUiToast(toastLoadingId)
      }, 1200)
      return
    }

    if (showOpacityWarning) {
      const message = UI_COPY.geospatialBasemapOpacityZeroWarning
      const eventKey = `warning|${message}`
      if (lastToastEventKeyRef.current !== eventKey) {
        lastToastEventKeyRef.current = eventKey
        pushUiToast({
          id: `geospatial:basemap:warning:${Date.now()}`,
          kind: 'warning',
          message,
          ttlMs: 10_000,
          dismissible: true,
        })
      }
      if (derivedReady) {
        pendingDismissToastTimeoutRef.current = window.setTimeout(() => {
          dismissUiToast(toastLoadingId)
        }, 1200)
      }
      return
    }

    if (derivedReady) {
      const message = UI_COPY.geospatialBasemapLoadedLabel
      const eventKey = `success|${message}`
      if (lastToastEventKeyRef.current !== eventKey) {
        lastToastEventKeyRef.current = eventKey
        pushUiToast({
          id: `geospatial:basemap:success:${Date.now()}`,
          kind: 'success',
          message,
          ttlMs: 6000,
          dismissible: true,
        })
      }
      pendingDismissToastTimeoutRef.current = window.setTimeout(() => {
        dismissUiToast(toastLoadingId)
      }, 1200)
      return
    }

    const last = lastMapRequestRef.current
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
    const parts: string[] = [UI_COPY.geospatialBasemapLoadingLabel]
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
  }, [
    derivedReady,
    dismissUiToast,
    enabled,
    lastMapRequestRef,
    mapError,
    probe.canvasH,
    probe.canvasW,
    probe.sourceLoaded,
    probe.styleLoaded,
    probe.tileSourceId,
    probe.tilesLoaded,
    pushUiToast,
    showOpacityWarning,
    statusRevision,
    targetStyleUrl,
    upsertUiToast,
  ])

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

  if (!enabled) return null

  const overlay = (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-[15] ${interactionActive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ width: '100vw', height: '100vh', touchAction: interactionActive ? 'none' : 'auto' }}
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
