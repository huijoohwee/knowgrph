import React from 'react'
import { useGympgrphStore } from './store'
import { useMapLibreBasemap } from './features/geospatial/useMapLibreBasemap'
import { LS_KEYS } from './lib/config'
import { onGeospatialModeChanged, type GeospatialViewMode } from 'grph-shared/geospatial/events'
import { GEOSPATIAL_POINT_STYLE_CHANGED_EVENT, GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { computeBoundsFromCollections } from './geo'
import { clearGeoJsonSourceData, ensureDatasetLayer, isMapLibreStyleReady, setGeoJsonSourceData } from './maplibreLayers'
import { colorForDataset } from './colors'
import { isPointOnlyFeatureCollection } from './selection'
import {
  isGrabMapsPresetActive,
  normalizePersistedGeospatialStyleUrl,
  resolveEffectiveGeospatialStyleUrl,
  SAFE_SVG_FALLBACK_STYLE_SENTINEL,
} from './features/geospatial/basemapStyle'
import {
  MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG,
  pointStyleConfigSignature,
  readGeospatialPointStyleConfig,
} from './features/geospatial/pointStyleConfig'
import type { FeatureCollection } from 'geojson'
import { geoEquirectangular, geoGraticule, geoPath } from 'd3'

type GeospatialOverlayHostProps = {
  active?: boolean
  snapshot?: unknown
  handlers?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function readNestedValue(root: unknown, path: ReadonlyArray<string>): unknown {
  let current: unknown = root
  for (const segment of path) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

function getSnapshotGraphData(snapshot: unknown): unknown {
  if (!isRecord(snapshot)) return null
  return snapshot.graphData
}

function getOverlayHandlers(snapshot: unknown, handlers: unknown): Record<string, unknown> | null {
  if (isRecord(handlers)) return handlers
  if (!isRecord(snapshot)) return null
  const snapshotHandlers = snapshot.handlers
  return isRecord(snapshotHandlers) ? snapshotHandlers : null
}

function getSnapshotSelectedNodeIds(snapshot: unknown): Set<string> {
  if (!isRecord(snapshot)) return new Set<string>()
  const out = new Set<string>()
  const selectedNodeId = snapshot.selectedNodeId
  if (typeof selectedNodeId === 'string' && selectedNodeId.trim()) out.add(selectedNodeId)
  const selectedNodeIds = snapshot.selectedNodeIds
  if (Array.isArray(selectedNodeIds)) {
    for (const raw of selectedNodeIds) {
      if (typeof raw !== 'string') continue
      const id = raw.trim()
      if (!id) continue
      out.add(id)
    }
  }
  return out
}

type FeatureProjection = {
  featureCollection: FeatureCollection
  signature: string
}

function GeospatialPointLegend(props: {
  colors: {
    airport: string
    hotel: string
    poi: string
    route: string
  }
  visible: boolean
}): React.ReactElement | null {
  if (!props.visible) return null
  const items: Array<{ key: 'airport' | 'hotel' | 'poi' | 'route'; label: string }> = [
    { key: 'airport', label: 'Airport' },
    { key: 'hotel', label: 'Hotel' },
    { key: 'poi', label: 'POI' },
    { key: 'route', label: 'Route' },
  ]
  return (
    <div className="absolute left-2 bottom-2 z-20 pointer-events-none rounded-md border border-gray-200/70 bg-white/82 px-2 py-1.5 text-[11px] text-gray-700 shadow-sm dark:border-gray-800/70 dark:bg-black/62 dark:text-gray-200">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Legend</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.16)]"
              style={{ backgroundColor: props.colors[item.key] }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const HIGH_FIDELITY_WORLD_SVG_URL = new URL('./features/geospatial/assets/simple-world-map-edit.svg', import.meta.url).href
const HIGH_FIDELITY_WORLD_SVG_WIDTH = 494.7
const HIGH_FIDELITY_WORLD_SVG_HEIGHT = 265.7
const SVG_FALLBACK_VIEWBOX_WIDTH = 1000
const SVG_FALLBACK_VIEWBOX_HEIGHT = 560
const SVG_FALLBACK_STYLE = {
  graticuleMinorStep: [5, 5] as const,
  graticuleMajorStep: [15, 15] as const,
  oceanGradientStops: ['rgb(224 236 245)', 'rgb(196 217 232)', 'rgb(166 191 210)'] as const,
  oceanSheenStops: ['rgba(255,255,255,0.48)', 'rgba(255,255,255,0.20)', 'rgba(30,41,59,0.10)'] as const,
  landWashStops: ['rgba(255,255,255,0.20)', 'rgba(34,197,94,0.09)'] as const,
  frameStrokeStops: ['rgba(255,255,255,0.95)', 'rgba(30,41,59,0.88)'] as const,
  mapFilterMatrix: `
                0.64 0.00 0.00 0 0.24
                0.00 0.68 0.00 0 0.25
                0.00 0.00 0.73 0 0.28
                0.00 0.00 0.00 1 0
              `,
  mapGamma: ['0.79', '0.81', '0.86'] as const,
  sphereShadow: 'rgba(15,23,42,0.20)',
  pointShadow: 'rgba(15,23,42,0.35)',
  minorGridLight: 'rgba(255,255,255,0.09)',
  minorGridDark: 'rgba(100,116,139,0.07)',
  majorGridLight: 'rgba(255,255,255,0.17)',
  majorGridDark: 'rgba(51,65,85,0.15)',
  pointFill: 'rgba(37,99,235,0.92)',
  pointOutline: 'rgba(255,255,255,0.98)',
  pointStroke: 'rgba(29,78,216,0.74)',
  selectedFill: 'rgba(249,115,22,0.98)',
  selectedOutline: 'rgba(255,255,255,1)',
  selectedStroke: 'rgba(154,52,18,0.88)',
} as const

function SvgGeospatialFallback(args: {
  featureCollection: FeatureCollection
  selectedFeatureCollection: FeatureCollection
  className: string
}): React.ReactElement {
  const width = SVG_FALLBACK_VIEWBOX_WIDTH
  const height = SVG_FALLBACK_VIEWBOX_HEIGHT
  const projection = React.useMemo(() => {
    const equirect = geoEquirectangular()
    const features = Array.isArray(args.featureCollection.features) ? args.featureCollection.features : []
    if (features.length > 0) {
      try {
        equirect.fitExtent(
          [
            [32, 32],
            [width - 32, height - 32],
          ],
          args.featureCollection,
        )
      } catch {
        equirect.fitExtent(
          [
            [12, 12],
            [width - 12, height - 12],
          ],
          { type: 'Sphere' } as never,
        )
      }
    } else {
      equirect.fitExtent(
        [
          [12, 12],
          [width - 12, height - 12],
        ],
        { type: 'Sphere' } as never,
      )
    }
    return equirect
  }, [args.featureCollection])

  const areaPathBuilder = React.useMemo(() => geoPath(projection), [projection])
  const pointPathBuilder = React.useMemo(() => geoPath(projection).pointRadius(4), [projection])
  const selectedPointPathBuilder = React.useMemo(() => geoPath(projection).pointRadius(6), [projection])
  const minorGraticule = React.useMemo(
    () => geoGraticule().step([SVG_FALLBACK_STYLE.graticuleMinorStep[0], SVG_FALLBACK_STYLE.graticuleMinorStep[1]]),
    [],
  )
  const majorGraticule = React.useMemo(
    () => geoGraticule().step([SVG_FALLBACK_STYLE.graticuleMajorStep[0], SVG_FALLBACK_STYLE.graticuleMajorStep[1]]),
    [],
  )
  const worldTopLeft = React.useMemo(() => projection([-180, 90]) || [0, 0], [projection])
  const worldBottomRight = React.useMemo(() => projection([180, -90]) || [width, height], [projection, width, height])
  const svgImageX = Math.min(worldTopLeft[0], worldBottomRight[0])
  const svgImageY = Math.min(worldTopLeft[1], worldBottomRight[1])
  const svgImageWidth = Math.abs(worldBottomRight[0] - worldTopLeft[0])
  const svgImageHeight = (svgImageWidth * HIGH_FIDELITY_WORLD_SVG_HEIGHT) / HIGH_FIDELITY_WORLD_SVG_WIDTH
  const svgImageYAdjusted = svgImageY + (Math.abs(worldBottomRight[1] - worldTopLeft[1]) - svgImageHeight) / 2
  const spherePath = React.useMemo(() => areaPathBuilder({ type: 'Sphere' } as never) || '', [areaPathBuilder])
  const minorGraticulePath = React.useMemo(() => areaPathBuilder(minorGraticule() as never) || '', [areaPathBuilder, minorGraticule])
  const majorGraticulePath = React.useMemo(() => areaPathBuilder(majorGraticule() as never) || '', [areaPathBuilder, majorGraticule])
  const pointsPath = React.useMemo(() => pointPathBuilder(args.featureCollection as never) || '', [pointPathBuilder, args.featureCollection])
  const selectedPath = React.useMemo(
    () => selectedPointPathBuilder(args.selectedFeatureCollection as never) || '',
    [selectedPointPathBuilder, args.selectedFeatureCollection],
  )

  return (
    <div className={args.className}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" aria-label="Fallback geospatial basemap">
        <defs>
          <linearGradient id="kg-geo-fallback-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SVG_FALLBACK_STYLE.oceanGradientStops[0]} />
            <stop offset="44%" stopColor={SVG_FALLBACK_STYLE.oceanGradientStops[1]} />
            <stop offset="100%" stopColor={SVG_FALLBACK_STYLE.oceanGradientStops[2]} />
          </linearGradient>
          <radialGradient id="kg-geo-fallback-ocean-sheen" cx="50%" cy="42%" r="78%">
            <stop offset="0%" stopColor={SVG_FALLBACK_STYLE.oceanSheenStops[0]} />
            <stop offset="48%" stopColor={SVG_FALLBACK_STYLE.oceanSheenStops[1]} />
            <stop offset="100%" stopColor={SVG_FALLBACK_STYLE.oceanSheenStops[2]} />
          </radialGradient>
          <linearGradient id="kg-geo-fallback-land-wash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={SVG_FALLBACK_STYLE.landWashStops[0]} />
            <stop offset="100%" stopColor={SVG_FALLBACK_STYLE.landWashStops[1]} />
          </linearGradient>
          <linearGradient id="kg-geo-fallback-frame-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={SVG_FALLBACK_STYLE.frameStrokeStops[0]} />
            <stop offset="100%" stopColor={SVG_FALLBACK_STYLE.frameStrokeStops[1]} />
          </linearGradient>
          <clipPath id="kg-geo-fallback-sphere-clip">
            <path d={spherePath} />
          </clipPath>
          <filter id="kg-geo-fallback-map-filter" x="-10%" y="-10%" width="120%" height="120%">
            <feColorMatrix
              type="matrix"
              values={SVG_FALLBACK_STYLE.mapFilterMatrix}
            />
            <feComponentTransfer>
              <feFuncR type="gamma" amplitude="1" exponent={SVG_FALLBACK_STYLE.mapGamma[0]} offset="0" />
              <feFuncG type="gamma" amplitude="1" exponent={SVG_FALLBACK_STYLE.mapGamma[1]} offset="0" />
              <feFuncB type="gamma" amplitude="1" exponent={SVG_FALLBACK_STYLE.mapGamma[2]} offset="0" />
            </feComponentTransfer>
          </filter>
          <filter id="kg-geo-fallback-sphere-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="5" floodColor={SVG_FALLBACK_STYLE.sphereShadow} />
          </filter>
          <filter id="kg-geo-fallback-point-shadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" floodColor={SVG_FALLBACK_STYLE.pointShadow} />
          </filter>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="url(#kg-geo-fallback-bg)" />
        <g clipPath="url(#kg-geo-fallback-sphere-clip)" opacity="0.96">
          <image
            href={HIGH_FIDELITY_WORLD_SVG_URL}
            x={svgImageX}
            y={svgImageYAdjusted}
            width={svgImageWidth}
            height={svgImageHeight}
            preserveAspectRatio="none"
            filter="url(#kg-geo-fallback-map-filter)"
            opacity="0.92"
          />
          <rect x={svgImageX} y={svgImageYAdjusted} width={svgImageWidth} height={svgImageHeight} fill="url(#kg-geo-fallback-land-wash)" />
        </g>
        <path d={spherePath} fill="url(#kg-geo-fallback-ocean-sheen)" stroke="rgba(255,255,255,0.32)" strokeWidth="3.4" filter="url(#kg-geo-fallback-sphere-shadow)" />
        <path d={spherePath} fill="none" stroke="url(#kg-geo-fallback-frame-stroke)" strokeWidth="1.2" />
        <path d={spherePath} fill="none" stroke="rgba(15,23,42,0.28)" strokeWidth="1.75" />
        <path d={minorGraticulePath} fill="none" stroke={SVG_FALLBACK_STYLE.minorGridLight} strokeWidth="0.55" />
        <path d={minorGraticulePath} fill="none" stroke={SVG_FALLBACK_STYLE.minorGridDark} strokeWidth="0.95" />
        <path d={majorGraticulePath} fill="none" stroke={SVG_FALLBACK_STYLE.majorGridLight} strokeWidth="0.95" />
        <path d={majorGraticulePath} fill="none" stroke={SVG_FALLBACK_STYLE.majorGridDark} strokeWidth="1.55" />
        <path d={pointsPath} fill={SVG_FALLBACK_STYLE.pointFill} stroke={SVG_FALLBACK_STYLE.pointOutline} strokeWidth="2.2" filter="url(#kg-geo-fallback-point-shadow)" />
        <path d={pointsPath} fill="none" stroke={SVG_FALLBACK_STYLE.pointStroke} strokeWidth="0.95" />
        <path d={selectedPath} fill={SVG_FALLBACK_STYLE.selectedFill} stroke={SVG_FALLBACK_STYLE.selectedOutline} strokeWidth="3" filter="url(#kg-geo-fallback-point-shadow)" />
        <path d={selectedPath} fill="none" stroke={SVG_FALLBACK_STYLE.selectedStroke} strokeWidth="1.25" />
      </svg>
    </div>
  )
}

function buildFeatureCollectionFromGraphData(graphData: unknown, selectedNodeIds: Set<string>): FeatureProjection {
  const features: FeatureCollection['features'] = []
  const signatureParts: string[] = []
  if (!isRecord(graphData)) return { featureCollection: { type: 'FeatureCollection', features }, signature: 'n:0' }
  const meta = isRecord(graphData.metadata) ? graphData.metadata : null
  const lineFeaturesRaw = meta ? readNestedValue(meta, ['kgGeospatialLineFeatures']) : null
  if (isRecord(lineFeaturesRaw) && String(lineFeaturesRaw.type || '') === 'FeatureCollection') {
    const inner = (lineFeaturesRaw as Record<string, unknown>).features
    if (Array.isArray(inner)) {
      for (let i = 0; i < inner.length; i += 1) {
        const f = inner[i]
        if (!isRecord(f)) continue
        const g = (f as Record<string, unknown>).geometry
        if (!isRecord(g) || String(g.type || '') !== 'LineString') continue
        const coords = (g as Record<string, unknown>).coordinates
        if (!Array.isArray(coords) || coords.length < 2) continue
        const props = isRecord((f as Record<string, unknown>).properties) ? (f as Record<string, unknown>).properties as Record<string, unknown> : {}
        const idRaw = (f as Record<string, unknown>).id
        const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : ''
        const labelRaw = props.label
        const label = typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : 'Route'
        features.push({
          type: 'Feature',
          id: id || `kg-line:${i + 1}`,
          geometry: { type: 'LineString', coordinates: coords as any },
          properties: {
            ...props,
            label,
            kgCategory: typeof props.kgCategory === 'string' && props.kgCategory.trim() ? props.kgCategory : 'route',
          } as any,
        })
      }
    }
  }
  const nodesRaw = graphData.nodes
  if (!Array.isArray(nodesRaw)) return { featureCollection: { type: 'FeatureCollection', features }, signature: 'n:0' }
  for (let i = 0; i < nodesRaw.length; i += 1) {
    const node = nodesRaw[i]
    if (!isRecord(node)) continue
    const nodeId = String(node.id || '').trim()
    if (!nodeId) continue
    const propsRaw = isRecord(node.properties) ? node.properties : {}
    const geoRaw = readNestedValue(propsRaw, ['geo'])
    const lat = readFiniteNumber(readNestedValue(geoRaw, ['lat']))
    const lng = readFiniteNumber(readNestedValue(geoRaw, ['lng']))
    if (lat == null || lng == null) continue
    const labelRaw = node.label
    const label = typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : nodeId
    const nodeTypeRaw = node.type
    const nodeType = typeof nodeTypeRaw === 'string' ? nodeTypeRaw : ''
    const category = (() => {
      const rawCandidates: unknown[] = [
        readNestedValue(propsRaw, ['cat']),
        readNestedValue(propsRaw, ['category']),
        readNestedValue(propsRaw, ['kind']),
        readNestedValue(propsRaw, ['type']),
        nodeType,
      ]
      for (const raw of rawCandidates) {
        const v = String(raw || '').trim().toLowerCase()
        if (!v) continue
        if (v.includes('airport')) return 'airport'
        if (v.includes('hotel') || v.includes('hostel') || v.includes('accommodation')) return 'hotel'
        if (v.includes('poi') || v.includes('attraction') || v.includes('landmark')) return 'poi'
        if (v.includes('route') || v.includes('line') || v.includes('flight')) return 'route'
      }
      return 'other'
    })()
    const selected = selectedNodeIds.has(nodeId)
    if (signatureParts.length < 500) signatureParts.push(`${nodeId}:${category}:${lng.toFixed(6)}:${lat.toFixed(6)}:${selected ? 1 : 0}`)
    features.push({
      type: 'Feature',
      id: nodeId,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: nodeId,
        label,
        type: nodeType,
        kgCategory: category,
        selected,
      },
    })
  }
  return {
    featureCollection: { type: 'FeatureCollection', features },
    signature: `n:${String(features.length)}|${signatureParts.join('|')}`,
  }
}

const readStyleUrl = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEYS.geospatialStyleUrl) || ''
    const s = normalizePersistedGeospatialStyleUrl(raw)
    if (s !== raw.trim()) {
      if (s) {
        window.localStorage.setItem(LS_KEYS.geospatialStyleUrl, s)
      } else {
        window.localStorage.removeItem(LS_KEYS.geospatialStyleUrl)
      }
    }
    return s || null
  } catch {
    return null
  }
}

const readPersistedViewMode = (): GeospatialViewMode => {
    if (typeof window === 'undefined') return '2d-modern'
  try {
    const raw = String(window.localStorage.getItem(LS_KEYS.geospatialViewMode) || '').trim()
    if (raw === '2d-modern') return '2d-modern'
    if (raw === '3d-modern') return '3d-modern'
    if (raw === '3d') return '3d'
    if (raw === '2d-svg') return '2d-svg'
      return '2d-modern'
  } catch {
      return '2d-modern'
  }
}

export function GeospatialOverlayHost(props: GeospatialOverlayHostProps): React.ReactElement | null {
  const active = props.active !== false
  const storeGeospatialViewMode = useGympgrphStore(s => s.geospatialViewMode)
  const geospatialAutoFitEnabled = useGympgrphStore(s => s.geospatialAutoFitEnabled)
  const geospatialFitRequest = useGympgrphStore(s => s.geospatialFitRequest)
  const clearGeospatialFitRequest = useGympgrphStore(s => s.clearGeospatialFitRequest)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const map2dContainerRef = React.useRef<HTMLDivElement | null>(null)
  const map3dContainerRef = React.useRef<HTMLDivElement | null>(null)
  const [targetStyleUrl, setTargetStyleUrl] = React.useState<string | null>(() => readStyleUrl())
  const [pointStyleConfig, setPointStyleConfig] = React.useState(() => readGeospatialPointStyleConfig())
  const [geospatialViewMode, setGeospatialViewMode] = React.useState<GeospatialViewMode>(() => storeGeospatialViewMode || readPersistedViewMode())

  React.useEffect(() => {
    setGeospatialViewMode(storeGeospatialViewMode || readPersistedViewMode())
  }, [storeGeospatialViewMode])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => {
      setTargetStyleUrl(readStyleUrl())
    }
    const onPointStyleChanged = () => {
      setPointStyleConfig(readGeospatialPointStyleConfig())
    }
    window.addEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    window.addEventListener(GEOSPATIAL_POINT_STYLE_CHANGED_EVENT, onPointStyleChanged)
    return () => {
      window.removeEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
      window.removeEventListener(GEOSPATIAL_POINT_STYLE_CHANGED_EVENT, onPointStyleChanged)
    }
  }, [])

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const next = detail.viewMode || readPersistedViewMode()
      setGeospatialViewMode(prev => (prev === next ? prev : next))
    })
  }, [])

  const show2dMapLibreClassic = active && geospatialViewMode === '2d'
  const show2dMapLibreModern = active && geospatialViewMode === '2d-modern'
  const show2dMapLibre = show2dMapLibreClassic || show2dMapLibreModern
  const show2dSvgFallback = active && geospatialViewMode === '2d-svg'
  const show3dClassic = active && geospatialViewMode === '3d'
  const show3dModern = active && geospatialViewMode === '3d-modern'
  const show3d = show3dClassic || show3dModern
  const effectiveTargetStyleUrl = React.useMemo(() => {
    return resolveEffectiveGeospatialStyleUrl(geospatialViewMode, targetStyleUrl)
  }, [geospatialViewMode, targetStyleUrl])
  const fitPadding = show3d ? 0 : 24
  const providerLabel = React.useMemo(() => {
    if (isGrabMapsPresetActive(effectiveTargetStyleUrl, geospatialViewMode)) return 'grabmaps'
    if (show2dSvgFallback) return 'svg'
    return 'maplibre'
  }, [effectiveTargetStyleUrl, geospatialViewMode, show2dSvgFallback])
  const selectedNodeIds = React.useMemo(() => getSnapshotSelectedNodeIds(props.snapshot), [props.snapshot])
  const graphProjection = React.useMemo(() => {
    const graphData = getSnapshotGraphData(props.snapshot)
    return buildFeatureCollectionFromGraphData(graphData, selectedNodeIds)
  }, [props.snapshot, selectedNodeIds])
  const overlayDebugInfo = React.useMemo(() => {
    const graphData = getSnapshotGraphData(props.snapshot)
    if (!isRecord(graphData)) return null
    const meta = isRecord(graphData.metadata) ? graphData.metadata : null
    const raw = meta && isRecord(meta.kgGeospatialOverlayDebug) ? meta.kgGeospatialOverlayDebug : null
    return raw
  }, [props.snapshot])
  const graphFeatureCollection = graphProjection.featureCollection
  const graphBounds = React.useMemo(() => computeBoundsFromCollections([graphFeatureCollection]), [graphFeatureCollection])
  const selectedFeatureCollection = React.useMemo(() => {
    const features = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features : []
    const selected = features.filter(feature => {
      const idRaw = (feature as { id?: unknown }).id
      const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : ''
      if (!id) return false
      return selectedNodeIds.has(id)
    })
    return { type: 'FeatureCollection', features: selected } as FeatureCollection
  }, [graphFeatureCollection, selectedNodeIds])
  const selectedBounds = React.useMemo(() => computeBoundsFromCollections([selectedFeatureCollection]), [selectedFeatureCollection])
  const graphDataKey = React.useMemo(() => graphProjection.signature, [graphProjection.signature])
  const mapLibreRuntimeEnabled = show2dMapLibre || show3d

  const notifyGrabMapsFallback = React.useCallback(() => {
    const overlayHandlers = getOverlayHandlers(props.snapshot, props.handlers)
    const upsert = overlayHandlers && typeof overlayHandlers.upsertUiToast === 'function'
      ? overlayHandlers.upsertUiToast as ((toast: { id: string; kind?: 'neutral' | 'success' | 'warning' | 'error'; message: string; ttlMs?: number | null; dismissible?: boolean; log?: boolean }) => void)
      : null
    if (!upsert) return
    upsert({
      id: 'kg:geo:grabmaps-fallback',
      kind: 'warning',
      ttlMs: 3600,
      dismissible: true,
      log: true,
      message: 'GrabMaps basemap unavailable; switched to MapLibre Modern style.',
    })
  }, [props.handlers, props.snapshot])

  const basemap2d = useMapLibreBasemap({
    enabled: show2dMapLibre && mapLibreRuntimeEnabled,
    rootRef,
    containerRef: map2dContainerRef,
    targetStyleUrl: effectiveTargetStyleUrl,
    canvasRenderMode: '2d',
    projectionMode: 'mercator',
    viewportSizingMode: 'fit',
    vectorFallbackMs: 2_000,
    onGrabMapsFallback: notifyGrabMapsFallback,
  })
  const basemap3d = useMapLibreBasemap({
    enabled: show3d && mapLibreRuntimeEnabled,
    rootRef,
    containerRef: map3dContainerRef,
    targetStyleUrl: effectiveTargetStyleUrl,
    canvasRenderMode: '3d',
    projectionMode: 'globe',
    viewportSizingMode: 'fit',
    vectorFallbackMs: 2_000,
    onGrabMapsFallback: notifyGrabMapsFallback,
  })
  const activeBasemap = show3d ? basemap3d : basemap2d

  const graphSourceIdBase = 'kg-host-graph:nodes'
  const graphSourceIdClustered = `${graphSourceIdBase}:clustered`
  const graphSourceIdUnclustered = `${graphSourceIdBase}:plain`
  const graphDataAppliedRef = React.useRef<{ map2d: string; map3d: string }>({ map2d: '', map3d: '' })
  const debugToastMessageRef = React.useRef<string>('')

  const applyFeatureCollectionToBasemap = React.useCallback(
    (args: { basemapMap: any | null; styleRevision: number; viewMode: 'map2d' | 'map3d' }) => {
      const { basemapMap, styleRevision, viewMode } = args
      if (!basemapMap) return
      const styleReady = styleRevision > 0 || isMapLibreStyleReady(basemapMap)
      if (!styleReady) return
      const styleRevisionKey = styleRevision > 0 ? styleRevision : 1
      const featureCount = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0
      if (featureCount <= 0) {
        clearGeoJsonSourceData(basemapMap, graphSourceIdClustered)
        clearGeoJsonSourceData(basemapMap, graphSourceIdUnclustered)
        graphDataAppliedRef.current[viewMode] = ''
        return
      }
      // Avoid MapLibre clustered GeoJSON buckets on globe/3D until that path is stable.
      const cluster = viewMode === 'map2d' && isPointOnlyFeatureCollection(graphFeatureCollection, 500) && featureCount >= 200
      const activeSourceId = cluster ? graphSourceIdClustered : graphSourceIdUnclustered
      const inactiveSourceId = cluster ? graphSourceIdUnclustered : graphSourceIdClustered
      const applyKey = `${styleRevisionKey}:${activeSourceId}:${graphDataKey}`
      const styleKey = pointStyleConfigSignature(pointStyleConfig || MAIN_PANEL_DEFAULT_GEOSPATIAL_POINT_STYLE_CONFIG)
      if (graphDataAppliedRef.current[viewMode] === `${applyKey}:${styleKey}`) return
      clearGeoJsonSourceData(basemapMap, inactiveSourceId)
      ensureDatasetLayer(
        basemapMap,
        activeSourceId,
        colorForDataset(activeSourceId),
        cluster ? { cluster: true, pointStyleConfig } : { pointStyleConfig },
      )
      setGeoJsonSourceData(basemapMap, activeSourceId, graphFeatureCollection)
      graphDataAppliedRef.current[viewMode] = `${applyKey}:${styleKey}`
    },
    [graphDataKey, graphFeatureCollection, graphSourceIdClustered, graphSourceIdUnclustered, pointStyleConfig],
  )

  React.useEffect(() => {
    if (!show2dMapLibre) return
    applyFeatureCollectionToBasemap({ basemapMap: basemap2d.map, styleRevision: basemap2d.styleRevision, viewMode: 'map2d' })
  }, [applyFeatureCollectionToBasemap, basemap2d.map, basemap2d.styleRevision, show2dMapLibre])

  React.useEffect(() => {
    if (!show3d) return
    applyFeatureCollectionToBasemap({ basemapMap: basemap3d.map, styleRevision: basemap3d.styleRevision, viewMode: 'map3d' })
  }, [applyFeatureCollectionToBasemap, basemap3d.map, basemap3d.styleRevision, show3d])

  const basemapGraphDebug = React.useMemo(() => {
    const basemapMap = activeBasemap.map
    if (!basemapMap) return null
    const styleReady = activeBasemap.styleRevision > 0 || isMapLibreStyleReady(basemapMap)
    const featureCount = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0
    const cluster = active && !show3d && isPointOnlyFeatureCollection(graphFeatureCollection, 500) && featureCount >= 200
    const activeSourceId = cluster ? graphSourceIdClustered : graphSourceIdUnclustered
    const inactiveSourceId = cluster ? graphSourceIdUnclustered : graphSourceIdClustered
    const readSourceFeatureCount = (sourceId: string): number | null => {
      if (!styleReady) return null
      try {
        const src = basemapMap.getSource?.(sourceId) as { _data?: { features?: unknown[] } } | null
        const features = src && src._data && Array.isArray(src._data.features) ? src._data.features : null
        return features ? features.length : null
      } catch {
        return null
      }
    }
    const hasLayer = (layerId: string): boolean => {
      if (!styleReady) return false
      try {
        return !!basemapMap.getLayer?.(layerId)
      } catch {
        return false
      }
    }
    return {
      styleReady,
      activeSourceId,
      activeSourceFeatures: readSourceFeatureCount(activeSourceId),
      inactiveSourceFeatures: readSourceFeatureCount(inactiveSourceId),
      pointsLayer: hasLayer(`${activeSourceId}:points`),
      routesLayer: hasLayer(`${activeSourceId}:routes`),
      clusterLayer: hasLayer(`${activeSourceId}:cluster-bubbles`),
    }
  }, [active, activeBasemap.map, graphFeatureCollection, graphSourceIdClustered, graphSourceIdUnclustered, show3d])

  const autoFitAppliedForDataKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    const map = activeBasemap.map
    if (!map) return
    if (!active) return
    if (show3d) return
    if (!geospatialAutoFitEnabled) return
    if (!graphBounds) return
    const modeKey = show3d ? '3d' : '2d'
    const autoFitKey = `${modeKey}:${graphDataKey}`
    if (autoFitAppliedForDataKeyRef.current === autoFitKey) return
    autoFitAppliedForDataKeyRef.current = autoFitKey
    try {
      map.fitBounds(graphBounds, { padding: fitPadding, duration: 0 })
    } catch {
      void 0
    }
  }, [active, activeBasemap.map, fitPadding, geospatialAutoFitEnabled, graphBounds, graphDataKey, show3d])

  const initialDataFitDoneRef = React.useRef<boolean>(false)
  React.useEffect(() => {
    const map = activeBasemap.map
    if (!map) return
    if (!active) return
    if (show3d) return
    const featureCount = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0
    if (featureCount <= 0) {
      initialDataFitDoneRef.current = false
      return
    }
    if (!graphBounds) return
    if (initialDataFitDoneRef.current) return
    initialDataFitDoneRef.current = true
    try {
      map.fitBounds(graphBounds, { padding: fitPadding, duration: 0 })
    } catch {
      void 0
    }
  }, [active, activeBasemap.map, fitPadding, graphBounds, graphFeatureCollection.features, show3d])

  React.useEffect(() => {
    const map = activeBasemap.map
    if (!map) return
    if (!active) return
    if (!geospatialFitRequest) return
    if (geospatialFitRequest.mode === 'currentLocation') {
      const zoom = Number.isFinite(geospatialFitRequest.zoom) ? geospatialFitRequest.zoom : Math.max(12, Number(map.getZoom?.() || 0))
      try {
        map.flyTo?.({
          center: [geospatialFitRequest.lng, geospatialFitRequest.lat],
          zoom,
          duration: 0,
        })
      } catch {
        try {
          map.jumpTo?.({
            center: [geospatialFitRequest.lng, geospatialFitRequest.lat],
            zoom,
          })
        } catch {
          void 0
        }
      }
      clearGeospatialFitRequest()
      return
    }
    if (geospatialFitRequest.mode === 'selection') {
      if (selectedBounds) {
        try {
          map.fitBounds(selectedBounds, { padding: fitPadding, duration: 0 })
        } catch {
          void 0
        }
      } else if (graphBounds) {
        try {
          map.fitBounds(graphBounds, { padding: fitPadding, duration: 0 })
        } catch {
          void 0
        }
      }
      clearGeospatialFitRequest()
      return
    }
    if (graphBounds) {
      try {
        map.fitBounds(graphBounds, { padding: fitPadding, duration: 0 })
      } catch {
        void 0
      }
    }
    clearGeospatialFitRequest()
  }, [active, activeBasemap.map, clearGeospatialFitRequest, fitPadding, geospatialFitRequest, graphBounds, selectedBounds])

  const debug = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(String(window.location.search || '')).get('kgGeoDebug') === '1'
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (!debug) return
    const overlayHandlers = getOverlayHandlers(props.snapshot, props.handlers)
    const upsert = overlayHandlers && typeof overlayHandlers.upsertUiToast === 'function' ? overlayHandlers.upsertUiToast as ((toast: { id: string; kind?: 'neutral' | 'success' | 'warning' | 'error'; message: string; ttlMs?: number | null; dismissible?: boolean; log?: boolean }) => void) : null
    if (!upsert) return
    const featureCount = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0
    const resolvedFrom = String(overlayDebugInfo?.resolvedFrom || 'none')
    const sourcePath = String(overlayDebugInfo?.sourceDocumentPath || '')
    const embeddedBlocks = Number(overlayDebugInfo?.embeddedGeoBlockCount || 0)
    const supplementedNodes = Number(overlayDebugInfo?.supplementedNodeCount || 0)
    const sourceFilesCount = Number(overlayDebugInfo?.sourceFilesCount || 0)
    const message = `Geo overlay: features=${featureCount}, source=${resolvedFrom}, blocks=${embeddedBlocks}, added=${supplementedNodes}, files=${sourceFilesCount}${sourcePath ? `, path=${sourcePath}` : ''}`
    if (debugToastMessageRef.current === message) return
    debugToastMessageRef.current = message
    upsert({
      id: 'kg:geo:overlay-debug',
      kind: featureCount > 0 ? 'success' : 'warning',
      ttlMs: 4000,
      dismissible: true,
      log: false,
      message,
    })
  }, [debug, graphFeatureCollection.features, overlayDebugInfo, props.handlers, props.snapshot])

  return (
    <div ref={rootRef} className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <SvgGeospatialFallback
        featureCollection={graphFeatureCollection}
        selectedFeatureCollection={selectedFeatureCollection}
        className={show2dSvgFallback ? 'absolute inset-0 pointer-events-none opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
      />
      <div
        ref={map2dContainerRef}
        className={show2dMapLibre ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <div
        ref={map3dContainerRef}
        className={show3d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <GeospatialPointLegend
        visible={(show2dMapLibre || show3d) && Array.isArray(graphFeatureCollection.features) && graphFeatureCollection.features.length > 0}
        colors={{
          airport: pointStyleConfig.colors.airport,
          hotel: pointStyleConfig.colors.hotel,
          poi: pointStyleConfig.colors.poi,
          route: pointStyleConfig.colors.route,
        }}
      />
      {debug ? (
        <div className="absolute top-2 right-2 z-20 pointer-events-none rounded-md border border-gray-200/60 bg-white/80 px-2 py-1 text-[11px] text-gray-700 dark:border-gray-800/60 dark:bg-black/60 dark:text-gray-200">
          <div>map: {activeBasemap.map ? 'yes' : 'no'}</div>
          <div>view: {geospatialViewMode} provider: {providerLabel}</div>
          <div>
            canvas: {activeBasemap.probe.canvasW}×{activeBasemap.probe.canvasH} tilesLoaded: {activeBasemap.probe.tilesLoaded ? 'yes' : 'no'}
          </div>
          <div>
            zoom: {activeBasemap.probe.zoom.toFixed(2)} center: {activeBasemap.probe.lng.toFixed(4)},{activeBasemap.probe.lat.toFixed(4)}
          </div>
          <div>features: {Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0}</div>
          {basemapGraphDebug ? (
            <>
              <div>styleReady: {basemapGraphDebug.styleReady ? 'yes' : 'no'} source: {basemapGraphDebug.activeSourceId}</div>
              <div>sourceFeatures: {String(basemapGraphDebug.activeSourceFeatures ?? 'n/a')} inactive: {String(basemapGraphDebug.inactiveSourceFeatures ?? 'n/a')}</div>
              <div>layers: points={basemapGraphDebug.pointsLayer ? 'yes' : 'no'} routes={basemapGraphDebug.routesLayer ? 'yes' : 'no'} clusters={basemapGraphDebug.clusterLayer ? 'yes' : 'no'}</div>
            </>
          ) : null}
          {activeBasemap.mapError ? <div className="text-red-700 dark:text-red-300">err: {activeBasemap.mapError}</div> : null}
        </div>
      ) : null}
      {!debug && activeBasemap.mapError ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-black/40">
          {activeBasemap.mapError}
        </div>
      ) : null}
    </div>
  )
}
