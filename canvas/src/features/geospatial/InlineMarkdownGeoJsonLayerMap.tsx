import React from 'react'
import {
  coerceFeatureCollectionIds,
  colorForDataset,
  computeBoundsFromCollections,
  ensureDatasetLayer,
  isPointOnlyFeatureCollection,
  setGeoJsonSourceData,
  useMapLibreBasemap,
} from 'gympgrph/map-preview'
import type { FeatureCollection } from 'geojson'
import { geoGraticule10, geoMercator, geoPath } from 'd3'
import { shouldSuppressBasemapErrorMessage } from './basemapErrorSuppression'
import { hashText } from '@/features/parsers/hash'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'

const sanitizeId = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return 'dataset'
  return s.replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 80) || 'dataset'
}

const FALLBACK_BASEMAP_BG_LAYER_ID = 'kg-md-basemap-fallback:bg'
const FALLBACK_BASEMAP_GRATICULE_SOURCE_ID = 'kg-md-basemap-fallback:graticule'
const FALLBACK_BASEMAP_GRATICULE_LAYER_ID = 'kg-md-basemap-fallback:graticule-lines'

const FALLBACK_GRATICULE_FC = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: geoGraticule10(),
    },
  ],
} as const

const ensureFallbackBasemapLayers = (map: any, enabled: boolean) => {
  if (!map) return
  if (!enabled) return

  let beforeId = ''
  try {
    const style = map.getStyle?.()
    const layers = Array.isArray(style?.layers) ? style.layers : []
    const firstNonBg = layers.find((l: any) => l && typeof l === 'object' && String(l.type || '') !== 'background')
    beforeId = typeof firstNonBg?.id === 'string' ? firstNonBg.id : ''
  } catch {
    beforeId = ''
  }

  try {
    if (!map.getLayer?.(FALLBACK_BASEMAP_BG_LAYER_ID)) {
      map.addLayer?.(
        {
          id: FALLBACK_BASEMAP_BG_LAYER_ID,
          type: 'background',
          paint: { 'background-color': 'rgba(15,23,42,1)' },
        },
        beforeId || undefined,
      )
    }
  } catch {
    void 0
  }

  try {
    if (!map.getSource?.(FALLBACK_BASEMAP_GRATICULE_SOURCE_ID)) {
      map.addSource?.(FALLBACK_BASEMAP_GRATICULE_SOURCE_ID, {
        type: 'geojson',
        data: FALLBACK_GRATICULE_FC as never,
      })
    }
  } catch {
    void 0
  }

  try {
    if (!map.getLayer?.(FALLBACK_BASEMAP_GRATICULE_LAYER_ID)) {
      map.addLayer?.(
        {
          id: FALLBACK_BASEMAP_GRATICULE_LAYER_ID,
          type: 'line',
          source: FALLBACK_BASEMAP_GRATICULE_SOURCE_ID,
          paint: {
            'line-color': 'rgba(148,163,184,0.28)',
            'line-width': 1,
          },
        },
        beforeId || undefined,
      )
    }
  } catch {
    void 0
  }
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

function GeoGraticuleSvg(args: { height: number | string; className?: string }) {
  const { height, className } = args
  const width = 1000
  const viewHeight = 600
  const projection = React.useMemo(() => {
    try {
      return geoMercator().fitSize([width, viewHeight], { type: 'Sphere' } as never)
    } catch {
      return geoMercator()
    }
  }, [])
  const pathGen = React.useMemo(() => {
    try {
      return geoPath(projection)
    } catch {
      return null
    }
  }, [projection])
  const graticulePath = React.useMemo(() => {
    if (!pathGen) return ''
    try {
      return String(pathGen(geoGraticule10() as never) || '')
    } catch {
      return ''
    }
  }, [pathGen])
  const spherePath = React.useMemo(() => {
    if (!pathGen) return ''
    try {
      return String(pathGen({ type: 'Sphere' } as never) || '')
    } catch {
      return ''
    }
  }, [pathGen])

  return (
    <svg
      className={className || ''}
      style={{ height }}
      viewBox={`0 0 ${width} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Basemap graticule"
      role="img"
    >
      <rect x="0" y="0" width={width} height={viewHeight} fill="rgba(148,163,184,0.08)" />
      {spherePath ? (
        <path d={spherePath} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={2} />
      ) : null}
      {graticulePath ? (
        <path d={graticulePath} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth={1} />
      ) : null}
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
  const [isInView, setIsInView] = React.useState(true)
  const [mapEverEnabled, setMapEverEnabled] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [basemapWarning, setBasemapWarning] = React.useState<string | null>(null)

  const targetStyleUrl = 'kg:style:raster-osm'
  const normalizedGeoJsonText = React.useMemo(() => String(geojsonText || '').trim(), [geojsonText])
  const parsedGeoJsonHash = React.useMemo(() => (normalizedGeoJsonText ? hashText(normalizedGeoJsonText) : ''), [normalizedGeoJsonText])

  const parsed = React.useMemo(() => {
    if (!normalizedGeoJsonText) {
      return { fc: null as FeatureCollection | null, bounds: null as ReturnType<typeof computeBoundsFromCollections> }
    }
    const fc = parseGeoJsonFeatureCollectionFromText(normalizedGeoJsonText)
    const bounds = fc ? computeBoundsFromCollections([fc]) : null
    return { fc, bounds }
  }, [normalizedGeoJsonText])

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

  React.useEffect(() => {
    if (isJsdom) return
    const el = rootRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    let cancelled = false
    const io = new IntersectionObserver(
      entries => {
        if (cancelled) return
        const entry = entries && entries.length > 0 ? entries[0] : null
        if (!entry) return
        setIsInView(entry.isIntersecting || entry.intersectionRatio > 0)
      },
      { root: null, rootMargin: '200px 0px 200px 0px', threshold: [0, 0.01] },
    )
    try {
      io.observe(el)
    } catch {
      try {
        io.disconnect()
      } catch {
        void 0
      }
      return
    }
    return () => {
      cancelled = true
      try {
        io.disconnect()
      } catch {
        void 0
      }
    }
  }, [isJsdom])

  React.useEffect(() => {
    if (mapEverEnabled) return
    if (!shouldLoadMap || !isInView) return
    if (!parsed.fc) return
    setMapEverEnabled(true)
  }, [isInView, mapEverEnabled, parsed.fc, shouldLoadMap])

  React.useEffect(() => {
    if (!parsed.fc && mapEverEnabled) setMapEverEnabled(false)
  }, [mapEverEnabled, parsed.fc])

  const mapEnabled = mapEverEnabled

  const basemap = useMapLibreBasemap({
    enabled: mapEnabled,
    rootRef,
    containerRef,
    targetStyleUrl,
    canvasRenderMode: '2d',
    projectionMode: 'mercator',
    viewportSizingMode: 'none',
    vectorFallbackMs: 2_000,
  })

  React.useEffect(() => {
    const msg = String(basemap.mapError || '').trim()
    if (!msg) return
    const lower = msg.toLowerCase()
    const isWebglError = lower.includes('webgl')
    if (isWebglError) setError(prev => prev || msg)

    if (shouldSuppressBasemapErrorMessage(msg)) {
      setBasemapWarning(prev => prev || 'Basemap unavailable')
      return
    }
    setError(prev => prev || msg)
  }, [basemap.mapError])

  const basemapHasBaseSource = React.useMemo(() => {
    const probe = basemap.probe
    return Boolean(probe.tileSourceId && probe.tilesLoaded && probe.canvasW > 0 && probe.canvasH > 0)
  }, [basemap.probe])

  const containerGridStyle = React.useMemo(() => {
    return {
      backgroundColor: 'rgba(15,23,42,1)',
      backgroundImage:
        'linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
      backgroundPosition: '0 0, 0 0',
    } as const
  }, [])

  const fallbackInjectedForStyleRevRef = React.useRef<number>(-1)
  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    const rev = basemap.styleRevision
    if (rev <= 0) return
    if (basemapHasBaseSource) return
    if (fallbackInjectedForStyleRevRef.current === rev) return
    fallbackInjectedForStyleRevRef.current = rev
    ensureFallbackBasemapLayers(map, true)
  }, [basemap.map, basemap.styleRevision, basemapHasBaseSource])

  const lastAppliedDataKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    if (basemap.styleRevision <= 0) return
    if (!parsed.fc) {
      setError('GeoJSON render: invalid or unsupported shape')
      return
    }
    const safeDatasetId = sanitizeId(datasetId)
    const dataKey = `${basemap.styleRevision}:${safeDatasetId}:${parsedGeoJsonHash}`
    if (lastAppliedDataKeyRef.current === dataKey) return
    const srcId = `kg-md-geojson:${safeDatasetId}`
    try {
      const fc = coerceFeatureCollectionIds(parsed.fc, safeDatasetId)
      const pointOnly = isPointOnlyFeatureCollection(fc, 200)
      const cluster = pointOnly && Array.isArray(fc.features) && fc.features.length >= 200
      ensureDatasetLayer(map, srcId, colorForDataset(safeDatasetId), cluster ? { cluster: true } : undefined)
      setGeoJsonSourceData(map, srcId, fc)
      lastAppliedDataKeyRef.current = dataKey
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
  }, [basemap.map, basemap.styleRevision, basemapHasBaseSource, datasetId, parsed.bounds, parsed.fc, parsedGeoJsonHash])

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
    if (!isInView) return null
    return 'Loading map preview…'
  }, [error, basemapWarning, basemap.map, isInView, parsed.fc, shouldLoadMap])

  const svgColor = React.useMemo(() => {
    const safeDatasetId = sanitizeId(datasetId)
    return colorForDataset(safeDatasetId)
  }, [datasetId])

  const rootHeight = useContainerHeight ? '100%' : heightPx
  const rootMinHeight = useContainerHeight ? heightPx : undefined
  const hasInputText = React.useMemo(() => Boolean(normalizedGeoJsonText), [normalizedGeoJsonText])

  return (
    <div ref={el => {
      rootRef.current = el
    }} className={`relative ${className || ''}`} style={{ height: rootHeight, minHeight: rootMinHeight }}>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <GeoGraticuleSvg height={rootHeight} className="w-full" />
        {parsed.fc ? <GeoJsonSvgPreview fc={parsed.fc} color={svgColor} height={rootHeight} className="w-full" /> : null}
      </div>
      <div ref={el => {
        containerRef.current = el
      }} data-testid="geojson-map-container" className="absolute inset-0 z-10" style={containerGridStyle} />
      {overlayMessage && (
        <div
          data-testid="geojson-map-overlay"
          className="absolute bottom-2 right-2 z-20 pointer-events-none px-2 py-1 rounded-md text-[11px] text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-black/60 border border-gray-200/60 dark:border-gray-800/60"
        >
          {overlayMessage}
        </div>
      )}
      {!overlayMessage && hasInputText && !parsed.fc ? (
        <div className="absolute bottom-2 right-2 z-20 pointer-events-none px-2 py-1 rounded-md text-[11px] text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-black/60 border border-gray-200/60 dark:border-gray-800/60">
          Invalid GeoJSON
        </div>
      ) : null}
    </div>
  )
}
