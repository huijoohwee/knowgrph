import React from 'react'
import {
  coerceFeatureCollectionIds,
  colorForDataset,
  computeBoundsFromCollections,
  createMapLibreMapWithBasemap,
  DEFAULT_GEOSPATIAL_STYLE_URL,
  ensureDatasetLayer,
  isPointOnlyFeatureCollection,
  parseGeoJsonFromText,
  setGeoJsonSourceData,
} from 'gympgrph'
import type { FeatureCollection } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'
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
  heightPx: number
  className?: string
}) {
  const { fc, color, heightPx, className } = args
  const width = 1000
  const height = 600
  const projection = React.useMemo(() => {
    try {
      return geoMercator().fitSize([width, height], fc as never)
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
      style={{ height: heightPx }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="GeoJSON preview"
      role="img"
    >
      <rect x="0" y="0" width={width} height={height} fill="transparent" />
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
}) {
  const { geojsonText, datasetId, className, heightPx = 320 } = args
  const [containerEl, setContainerEl] = React.useState<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const initInFlightRef = React.useRef(false)
  const [shouldLoadMap, setShouldLoadMap] = React.useState(false)
  const [isReady, setIsReady] = React.useState(false)
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

  React.useEffect(() => {
    const el = containerEl
    if (!el) return
    if (shouldLoadMap) return
    const ua = typeof window !== 'undefined' ? String(window.navigator?.userAgent || '') : ''
    const isJsdom = /jsdom/i.test(ua)
    if (isJsdom) return
    let cancelled = false
    const forceLoadTimer = setTimeout(() => {
      if (cancelled) return
      setShouldLoadMap(true)
    }, 350)

    const check = (): boolean => {
      if (cancelled) return false
      try {
        const rect = el.getBoundingClientRect()
        const w = rect.width || (el as unknown as { offsetWidth?: number }).offsetWidth || 0
        const h = rect.height || (el as unknown as { offsetHeight?: number }).offsetHeight || 0
        if (w > 0 && h > 0) {
          setShouldLoadMap(true)
          return true
        }
      } catch {
        void 0
      }
      return false
    }

    try {
      if (check()) return
    } catch {
      void 0
    }
    if (typeof IntersectionObserver === 'undefined') {
      if (typeof ResizeObserver === 'undefined') {
        setShouldLoadMap(true)
        return
      }
    }
    const start = Date.now()
    const poll = () => {
      if (cancelled) return
      if (Date.now() - start > 6000) return
      if (check()) return
      try {
        requestAnimationFrame(poll)
      } catch {
        setTimeout(poll, 16)
      }
    }
    poll()

    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            entries => {
              for (const entry of entries) {
                if (entry.isIntersecting) {
                  setShouldLoadMap(true)
                  io.disconnect()
                  return
                }
              }
            },
            { root: null, rootMargin: '200px 0px', threshold: 0.01 },
          )
        : null
    try {
      io?.observe(el)
    } catch {
      void 0
    }

    const ro =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (check()) ro.disconnect()
          })
        : null
    try {
      ro?.observe(el)
    } catch {
      void 0
    }
    return () => {
      cancelled = true
      clearTimeout(forceLoadTimer)
      try {
        io?.disconnect()
      } catch {
        void 0
      }
      try {
        ro?.disconnect()
      } catch {
        void 0
      }
    }
  }, [containerEl, shouldLoadMap])

  React.useEffect(() => {
    if (!shouldLoadMap) return
    const el = containerEl
    if (!el) return
    if (mapRef.current) return
    if (initInFlightRef.current) return

    let cancelled = false
    initInFlightRef.current = true

    void (async () => {
      try {
        if (cancelled) return
        setError(null)
        setBasemapWarning(null)
        const map = await createMapLibreMapWithBasemap({
          container: el,
          styleUrl,
          cancelled: () => cancelled,
          interactive: true,
          attributionControl: false,
          onError: ({ message }) => {
            if (cancelled) return
            const trimmed = String(message || '').trim()
            if (shouldSuppressBasemapErrorMessage(trimmed)) {
              setBasemapWarning(prev => prev || 'Basemap unavailable')
              return
            }
            setError(trimmed)
          },
        })
        if (cancelled) {
          try {
            map?.remove?.()
          } catch {
            void 0
          }
          return
        }
        if (!map) {
          setError('Map preview unavailable')
          return
        }
        mapRef.current = map
        setIsReady(true)

        try {
          const anyMap = map as unknown as { once?: (event: string, cb: () => void) => void }
          anyMap.once?.('idle', () => {
            if (cancelled) return
            setBasemapWarning(null)
          })
        } catch {
          void 0
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        const trimmed = String(msg || '').trim()
        if (shouldSuppressBasemapErrorMessage(trimmed)) return
        if (trimmed) setError(trimmed)
      } finally {
        initInFlightRef.current = false
      }
    })()

    const anyWindow = globalThis as unknown as {
      requestAnimationFrame?: (cb: () => void) => number
    }
    const startedAt = Date.now()
    const resizeTick = () => {
      if (cancelled) return
      try {
        mapRef.current?.resize?.()
      } catch {
        void 0
      }
      if (Date.now() - startedAt > 1000) {
        return
      }
      try {
        if (typeof anyWindow.requestAnimationFrame === 'function') {
          anyWindow.requestAnimationFrame(resizeTick)
        } else {
          setTimeout(resizeTick, 16)
        }
      } catch {
        setTimeout(resizeTick, 16)
      }
    }
    resizeTick()

    return () => {
      cancelled = true
      initInFlightRef.current = false
      try {
        mapRef.current?.remove?.()
      } catch {
        void 0
      }
      mapRef.current = null
      setIsReady(false)
    }
  }, [containerEl, shouldLoadMap, styleUrl])

  React.useEffect(() => {
    const el = containerEl
    const map = mapRef.current
    if (!el || !map || !isReady) return
    if (typeof ResizeObserver !== 'function') return
    let raf: number | null = null
    const anyWindow = globalThis as unknown as {
      requestAnimationFrame?: (cb: () => void) => number
      cancelAnimationFrame?: (id: number) => void
    }
    const schedule = (fn: () => void) => {
      try {
        if (typeof anyWindow.requestAnimationFrame === 'function') {
          raf = anyWindow.requestAnimationFrame(fn)
          return
        }
      } catch {
        void 0
      }
      raf = null
      setTimeout(fn, 0)
    }
    const ro = new ResizeObserver(() => {
      if (raf != null) {
        try {
          anyWindow.cancelAnimationFrame?.(raf)
        } catch {
          void 0
        }
      }
      schedule(() => {
        try {
          map.resize()
        } catch {
          void 0
        }
      })
    })
    try {
      ro.observe(el)
    } catch {
      void 0
    }
    return () => {
      try {
        ro.disconnect()
      } catch {
        void 0
      }
      if (raf != null) {
        try {
          anyWindow.cancelAnimationFrame?.(raf)
        } catch {
          void 0
        }
      }
    }
  }, [containerEl, isReady])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !isReady) return
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
  }, [datasetId, isReady, parsed.bounds, parsed.fc])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.resize()
    } catch {
      void 0
    }
  }, [heightPx, className])

  React.useEffect(() => {
    if (!parsed.fc) return
    if (isReady) return
    if (!shouldLoadMap) return
    const t = setTimeout(() => {
      setError(prev => (prev && String(prev).trim()) ? prev : 'Map preview unavailable')
    }, 6000)
    return () => clearTimeout(t)
  }, [isReady, parsed.fc, shouldLoadMap])

  const overlayMessage = React.useMemo(() => {
    if (error && String(error).trim()) return String(error).trim()
    if (basemapWarning && String(basemapWarning).trim()) return String(basemapWarning).trim()
    if (!parsed.fc) return null
    if (isReady) return null
    if (!shouldLoadMap) return 'Preparing map preview…'
    return 'Loading map preview…'
  }, [error, basemapWarning, isReady, parsed.fc, shouldLoadMap])

  const svgColor = React.useMemo(() => {
    const safeDatasetId = sanitizeId(datasetId)
    return colorForDataset(safeDatasetId)
  }, [datasetId])

  return (
    <div className={`relative ${className || ''}`} style={{ height: heightPx }}>
      {parsed.fc && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <GeoJsonSvgPreview fc={parsed.fc} color={svgColor} heightPx={heightPx} className="w-full" />
        </div>
      )}
      <div ref={setContainerEl} data-testid="geojson-map-container" className="absolute inset-0 z-[1]" />
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
