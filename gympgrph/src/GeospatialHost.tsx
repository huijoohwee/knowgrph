import React from 'react'
import { useGympgrphStore } from './store'
import { useMapLibreBasemap } from './features/geospatial/useMapLibreBasemap'
import { LS_KEYS } from './lib/config'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { computeBoundsFromCollections } from './geo'
import { ensureDatasetLayer, setGeoJsonSourceData } from './maplibreLayers'
import { colorForDataset } from './colors'
import { isPointOnlyFeatureCollection } from './selection'
import type { FeatureCollection } from 'geojson'

const CesiumOverlayLazy = React.lazy(async () => {
  const m = await import('./features/geospatial/CesiumOverlay')
  return { default: m.CesiumOverlay }
})

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

function buildFeatureCollectionFromGraphData(graphData: unknown, selectedNodeIds: Set<string>): FeatureProjection {
  const features: FeatureCollection['features'] = []
  const signatureParts: string[] = []
  if (!isRecord(graphData)) return { featureCollection: { type: 'FeatureCollection', features }, signature: 'n:0' }
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
    const selected = selectedNodeIds.has(nodeId)
    if (signatureParts.length < 500) signatureParts.push(`${nodeId}:${lng.toFixed(6)}:${lat.toFixed(6)}:${selected ? 1 : 0}`)
    features.push({
      type: 'Feature',
      id: nodeId,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: nodeId,
        label,
        type: nodeType,
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
    const s = raw.trim()
    return s || null
  } catch {
    return null
  }
}

export function GeospatialOverlayHost(props: GeospatialOverlayHostProps): React.ReactElement | null {
  const active = props.active !== false
  const geospatialViewMode = useGympgrphStore(s => s.geospatialViewMode)
  const geospatialAutoFitEnabled = useGympgrphStore(s => s.geospatialAutoFitEnabled)
  const geospatialFitRequest = useGympgrphStore(s => s.geospatialFitRequest)
  const clearGeospatialFitRequest = useGympgrphStore(s => s.clearGeospatialFitRequest)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const cesiumRootRef = React.useRef<HTMLDivElement | null>(null)
  const [targetStyleUrl, setTargetStyleUrl] = React.useState<string | null>(() => readStyleUrl())

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => {
      setTargetStyleUrl(readStyleUrl())
    }
    window.addEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    }
  }, [])

  const show2d = active && geospatialViewMode !== '3d'
  const show3d = active && geospatialViewMode === '3d'
  const selectedNodeIds = React.useMemo(() => getSnapshotSelectedNodeIds(props.snapshot), [props.snapshot])
  const graphProjection = React.useMemo(() => {
    const graphData = getSnapshotGraphData(props.snapshot)
    return buildFeatureCollectionFromGraphData(graphData, selectedNodeIds)
  }, [props.snapshot, selectedNodeIds])
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

  const basemap = useMapLibreBasemap({
    enabled: show2d,
    rootRef,
    containerRef,
    targetStyleUrl,
    canvasRenderMode: '2d',
    projectionMode: 'mercator',
    viewportSizingMode: 'fit',
    vectorFallbackMs: 2_000,
  })

  const graphSourceId = 'kg-host-graph:nodes'
  const graphDataAppliedRef = React.useRef<string>('')
  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    if (!show2d) return
    if (basemap.styleRevision <= 0) return
    const featureCount = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0
    if (featureCount <= 0) return
    const applyKey = `${basemap.styleRevision}:${graphDataKey}`
    if (graphDataAppliedRef.current === applyKey) return
    const cluster = isPointOnlyFeatureCollection(graphFeatureCollection, 500) && featureCount >= 200
    ensureDatasetLayer(map, graphSourceId, colorForDataset(graphSourceId), cluster ? { cluster: true } : undefined)
    setGeoJsonSourceData(map, graphSourceId, graphFeatureCollection)
    graphDataAppliedRef.current = applyKey
  }, [basemap.map, basemap.styleRevision, graphDataKey, graphFeatureCollection, show2d])

  const autoFitAppliedForDataKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    if (!show2d) return
    if (!geospatialAutoFitEnabled) return
    if (!graphBounds) return
    if (autoFitAppliedForDataKeyRef.current === graphDataKey) return
    autoFitAppliedForDataKeyRef.current = graphDataKey
    try {
      map.fitBounds(graphBounds, { padding: 24, duration: 0 })
    } catch {
      void 0
    }
  }, [basemap.map, geospatialAutoFitEnabled, graphBounds, graphDataKey, show2d])

  const initialDataFitDoneRef = React.useRef<boolean>(false)
  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    if (!show2d) return
    const featureCount = Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0
    if (featureCount <= 0) {
      initialDataFitDoneRef.current = false
      return
    }
    if (!graphBounds) return
    if (initialDataFitDoneRef.current) return
    initialDataFitDoneRef.current = true
    try {
      map.fitBounds(graphBounds, { padding: 24, duration: 0 })
    } catch {
      void 0
    }
  }, [basemap.map, graphBounds, graphFeatureCollection.features, show2d])

  React.useEffect(() => {
    const map = basemap.map
    if (!map) return
    if (!show2d) return
    if (!geospatialFitRequest) return
    if (geospatialFitRequest.mode === 'selection') {
      if (selectedBounds) {
        try {
          map.fitBounds(selectedBounds, { padding: 24, duration: 0 })
        } catch {
          void 0
        }
      } else if (graphBounds) {
        try {
          map.fitBounds(graphBounds, { padding: 24, duration: 0 })
        } catch {
          void 0
        }
      }
      clearGeospatialFitRequest()
      return
    }
    if (graphBounds) {
      try {
        map.fitBounds(graphBounds, { padding: 24, duration: 0 })
      } catch {
        void 0
      }
    }
    clearGeospatialFitRequest()
  }, [basemap.map, clearGeospatialFitRequest, geospatialFitRequest, graphBounds, selectedBounds, show2d])

  const debug = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      return new URLSearchParams(String(window.location.search || '')).get('kgGeoDebug') === '1'
    } catch {
      return false
    }
  }, [])

  return (
    <div ref={rootRef} className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        className={show2d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <div
        ref={cesiumRootRef}
        className={show3d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {show3d ? (
          <React.Suspense fallback={null}>
            <CesiumOverlayLazy collections={graphFeatureCollection.features.length > 0 ? [graphFeatureCollection] : []} autoFitEnabled={geospatialAutoFitEnabled} />
          </React.Suspense>
        ) : null}
      </div>
      {debug ? (
        <div className="absolute top-2 right-2 z-20 pointer-events-none rounded-md border border-gray-200/60 bg-white/80 px-2 py-1 text-[11px] text-gray-700 dark:border-gray-800/60 dark:bg-black/60 dark:text-gray-200">
          <div>map: {basemap.map ? 'yes' : 'no'}</div>
          <div>
            canvas: {basemap.probe.canvasW}×{basemap.probe.canvasH} tilesLoaded: {basemap.probe.tilesLoaded ? 'yes' : 'no'}
          </div>
          <div>
            zoom: {basemap.probe.zoom.toFixed(2)} center: {basemap.probe.lng.toFixed(4)},{basemap.probe.lat.toFixed(4)}
          </div>
          <div>features: {Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0}</div>
          {basemap.mapError ? <div className="text-red-700 dark:text-red-300">err: {basemap.mapError}</div> : null}
        </div>
      ) : null}
      {!debug && basemap.mapError ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-black/40">
          {basemap.mapError}
        </div>
      ) : null}
    </div>
  )
}
