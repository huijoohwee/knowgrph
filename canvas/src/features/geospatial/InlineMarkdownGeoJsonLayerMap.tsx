import React from 'react'
import {
  coerceFeatureCollectionIds,
  colorForDataset,
  computeBoundsFromCollections,
  DEFAULT_GEOSPATIAL_STYLE_URL,
  ensureDatasetLayer,
  isPointOnlyFeatureCollection,
  parseGeoJsonFromText,
  setGeoJsonSourceData,
  useMapLibreBasemap,
} from 'gympgrph'
import type { FeatureCollection } from 'geojson'
import { geoMercator, geoPath } from 'd3'
import { useGympgrphExternalStore } from '@/lib/gympgrph/externalStore'
import { shouldSuppressBasemapErrorMessage } from './basemapErrorSuppression'

const sanitizeId = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return 'dataset'
  return s.replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 80) || 'dataset'
}

function GeoJsonSvgPreview(args: {
  fc: FeatureCollection
  color: string
  height: number | string
  className?: string
}) {
  const { fc, color, height, className } = args
  const width = 1000
  const viewHeight = 600
  const projection = React.useMemo(() => {
    try {
      return geoMercator().fitSize([width, viewHeight], fc as never)
    } catch {
      return geoMercator()
    }
  }, [fc])
  const pathGen = React.useMemo(() => {
    try {
      return geoPath(projection).pointRadius(3)
    } catch {
      return null
    }
  }, [projection])
  const paths = React.useMemo(() => {
    if (!pathGen) return [] as Array<{ key: string; d: string }>
    const out: Array<{ key: string; d: string }> = []
    const features = Array.isArray(fc.features) ? fc.features : []
    for (let i = 0; i < features.length; i += 1) {
      const f = features[i]
      if (!f) continue
      let d = ''
      try {
        d = String(pathGen(f as never) || '')
      } catch {
        d = ''
      }
      if (!d) continue
      const id = (f as unknown as { id?: unknown }).id
      const key = typeof id === 'string' || typeof id === 'number' ? String(id) : `f${i}`
      out.push({ key, d })
    }
    return out
  }, [fc.features, pathGen])

  return (
    <svg
      className={className || ''}
      style={{ height }}
      viewBox={`0 0 ${width} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="GeoJSON preview"
      role="img"
    >
      <rect x="0" y="0" width={width} height={viewHeight} fill="transparent" />
      <g>
        {paths.map(p => (
          <path key={p.key} d={p.d} fill="none" stroke={color} strokeWidth={2} opacity={0.85} />
        ))}
      </g>
    </svg>
  )
}

export function InlineMarkdownGeoJsonLayerMap(args: {
  geojsonText: string
  datasetId: string
  className?: string
  heightPx?: number
  useContainerHeight?: boolean
}) {
  const { geojsonText, datasetId, className, heightPx = 320, useContainerHeight = false } = args
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [shouldLoadMap, setShouldLoadMap] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [basemapWarning, setBasemapWarning] = React.useState<string | null>(null)

  const styleUrl = useGympgrphExternalStore(s => {
    const anyState = s as unknown as { geospatialStyleUrl?: unknown }
    const raw = typeof anyState.geospatialStyleUrl === 'string' ? anyState.geospatialStyleUrl : ''
    const trimmed = raw.trim()
    return trimmed || DEFAULT_GEOSPATIAL_STYLE_URL
  })

  const parsed = React.useMemo(() => {
    const trimmed = String(geojsonText || '').trim()
    if (!trimmed) return { fc: null as FeatureCollection | null, bounds: null as ReturnType<typeof computeBoundsFromCollections> }
    try {
      const fc = parseGeoJsonFromText(trimmed)
      const bounds = fc ? computeBoundsFromCollections([fc]) : null
      return { fc, bounds }
    } catch {
      return { fc: null, bounds: null }
    }
  }, [geojsonText])

  const isJsdom = React.useMemo(() => {
    const ua = typeof window !== 'undefined' ? String(window.navigator?.userAgent || '') : ''
    return /jsdom/i.test(ua)
  }, [])

  React.useEffect(() => {
    if (shouldLoadMap) return
    if (isJsdom) return
    if (!parsed.fc) return
    const isPositiveSize = (el: HTMLElement | null): boolean => {
      if (!el) return false
      try {
        const rect = el.getBoundingClientRect()
        const w = Number.isFinite(rect.width) ? Math.max(0, Math.floor(rect.width)) : 0
        const h = Number.isFinite(rect.height) ? Math.max(0, Math.floor(rect.height)) : 0
        return w > 0 && h > 0
      } catch {
        return false
      }
    }

    if (isPositiveSize(containerRef.current) || isPositiveSize(rootRef.current)) {
      setShouldLoadMap(true)
      return
    }

    if (typeof ResizeObserver === 'undefined') {
      setShouldLoadMap(true)
      return
    }

    let cancelled = false
    const ro = new ResizeObserver(() => {
      if (cancelled) return
      if (isPositiveSize(containerRef.current) || isPositiveSize(rootRef.current)) {
        setShouldLoadMap(true)
        try {
          ro.disconnect()
        } catch {
          void 0
        }
      }
    })

    try {
      if (rootRef.current) ro.observe(rootRef.current)
      if (containerRef.current && containerRef.current !== rootRef.current) ro.observe(containerRef.current)
    } catch {
      try {
        ro.disconnect()
      } catch {
        void 0
      }
      setShouldLoadMap(true)
      return
    }

    return () => {
      cancelled = true
      try {
        ro.disconnect()
      } catch {
        void 0
      }
    }
  }, [isJsdom, parsed.fc, shouldLoadMap])

  const basemap = useMapLibreBasemap({
    enabled: shouldLoadMap,
    rootRef,
    containerRef,
    targetStyleUrl: styleUrl,
    canvasRenderMode: '2d',
    projectionMode: 'mercator',
    viewportSizingMode: 'none',
    vectorFallbackMs: 2_000,
  })

  React.useEffect(() => {
    const msg = String(basemap.mapError || '').trim()
    if (!msg) return
    if (shouldSuppressBasemapErrorMessage(msg)) {
      setBasemapWarning(prev => prev || 'Basemap unavailable')
      return
    }
    setError(prev => prev || msg)
  }, [basemap.mapError])

  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    if (basemap.styleRevision <= 0) return
    if (!parsed.fc) {
      setError('GeoJSON render: invalid or unsupported shape')
      return
    }
    const safeDatasetId = sanitizeId(datasetId)
    const srcId = `kg-md-geojson:${safeDatasetId}`
    try {
      const fc = coerceFeatureCollectionIds(parsed.fc, safeDatasetId)
      const pointOnly = isPointOnlyFeatureCollection(fc, 200)
      const cluster = pointOnly && Array.isArray(fc.features) && fc.features.length >= 200
      ensureDatasetLayer(map, srcId, colorForDataset(safeDatasetId), cluster ? { cluster: true } : undefined)
      setGeoJsonSourceData(map, srcId, fc)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || 'GeoJSON render failed')
      return
    }

    if (parsed.bounds) {
      try {
        map.fitBounds(parsed.bounds, { padding: 24, duration: 0 })
      } catch {
        void 0
      }
    }
  }, [basemap.map, basemap.styleRevision, datasetId, parsed.bounds, parsed.fc])

  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    try {
      map.resize()
    } catch {
      void 0
    }
  }, [basemap.map, heightPx, className])

  const overlayMessage = React.useMemo(() => {
    if (error && String(error).trim()) return String(error).trim()
    if (basemapWarning && String(basemapWarning).trim()) return String(basemapWarning).trim()
    if (!parsed.fc) return null
    if (basemap.map) return null
    if (!shouldLoadMap) return 'Preparing map preview…'
    return 'Loading map preview…'
  }, [error, basemapWarning, basemap.map, parsed.fc, shouldLoadMap])

  const svgColor = React.useMemo(() => {
    const safeDatasetId = sanitizeId(datasetId)
    return colorForDataset(safeDatasetId)
  }, [datasetId])

  const rootHeight = useContainerHeight ? '100%' : heightPx
  const rootMinHeight = useContainerHeight ? heightPx : undefined

  return (
    <div ref={el => {
      rootRef.current = el
    }} className={`relative ${className || ''}`} style={{ height: rootHeight, minHeight: rootMinHeight }}>
      {parsed.fc && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <GeoJsonSvgPreview fc={parsed.fc} color={svgColor} height={rootHeight} className="w-full" />
        </div>
      )}
      <div ref={el => {
        containerRef.current = el
      }} data-testid="geojson-map-container" className="absolute inset-0 z-[1]" />
      {overlayMessage && (
        <div
          data-testid="geojson-map-overlay"
          className="absolute bottom-2 right-2 z-10 pointer-events-none px-2 py-1 rounded-md text-[11px] text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-black/60 border border-gray-200/60 dark:border-gray-800/60"
        >
          {overlayMessage}
        </div>
      )}
    </div>
  )
}
