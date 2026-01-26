import React from 'react'
import {
  buildBlankStyle,
  coerceFeatureCollectionIds,
  colorForDataset,
  computeBoundsFromCollections,
  ensureDatasetLayer,
  isPointOnlyFeatureCollection,
  setGeoJsonSourceData,
} from 'gympgrph'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const isGeometryLike = (value: unknown): value is Geometry => {
  if (!isObjectRecord(value)) return false
  const t = value.type
  return typeof t === 'string' && t.trim().length > 0
}

const coerceGeoJsonToFeatureCollection = (value: unknown): FeatureCollection | null => {
  if (!isObjectRecord(value)) return null
  const type = typeof value.type === 'string' ? value.type : ''
  if (!type) return null
  if (type === 'FeatureCollection' && Array.isArray(value.features)) return value as unknown as FeatureCollection
  if (type === 'Feature' && isGeometryLike(value.geometry)) {
    return { type: 'FeatureCollection', features: [value as unknown as Feature] } as FeatureCollection
  }
  if (isGeometryLike(value)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: value as Geometry, properties: {} }],
    } as FeatureCollection
  }
  return null
}

const sanitizeId = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return 'dataset'
  return s.replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 80) || 'dataset'
}

export function InlineMarkdownGeoJsonLayerMap(args: {
  geojsonText: string
  datasetId: string
  className?: string
  heightPx?: number
}) {
  const { geojsonText, datasetId, className, heightPx = 320 } = args
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const [isReady, setIsReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const parsed = React.useMemo(() => {
    const trimmed = String(geojsonText || '').trim()
    if (!trimmed) return { fc: null as FeatureCollection | null, bounds: null as ReturnType<typeof computeBoundsFromCollections> }
    try {
      const raw = JSON.parse(trimmed) as unknown
      const fc = coerceGeoJsonToFeatureCollection(raw)
      const bounds = fc ? computeBoundsFromCollections([fc]) : null
      return { fc, bounds }
    } catch {
      return { fc: null, bounds: null }
    }
  }, [geojsonText])

  React.useEffect(() => {
    let cancelled = false
    const el = containerRef.current
    if (!el) return

    void (async () => {
      try {
        const mod = await import('maplibre-gl')
        if (cancelled) return
        if (mapRef.current) return
        const map = new mod.Map({
          container: el,
          style: buildBlankStyle() as unknown as StyleSpecification,
          attributionControl: false,
          interactive: true,
        })
        mapRef.current = map
        map.on('load', () => {
          if (cancelled) return
          setIsReady(true)
          setError(null)
          try {
            map.resize()
          } catch {
            void 0
          }
        })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg || 'Map preview unavailable')
      }
    })()

    return () => {
      cancelled = true
      try {
        mapRef.current?.remove?.()
      } catch {
        void 0
      }
      mapRef.current = null
      setIsReady(false)
    }
  }, [])

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

  if (error) {
    return (
      <div className={className} style={{ height: heightPx }}>
        <div className="w-full h-full flex items-center justify-center text-xs text-[color:var(--kg-text-tertiary)]">
          {error}
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className={className} style={{ height: heightPx }} />
}
