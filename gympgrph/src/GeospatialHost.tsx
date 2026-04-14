import React from 'react'
import { useGympgrphStore } from './store'
import { useMapLibreBasemap } from './features/geospatial/useMapLibreBasemap'
import { LS_KEYS } from './lib/config'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { computeBoundsFromCollections } from './geo'
import { clearGeoJsonSourceData, ensureDatasetLayer, setGeoJsonSourceData } from './maplibreLayers'
import { colorForDataset } from './colors'
import { isPointOnlyFeatureCollection } from './selection'
import type { FeatureCollection } from 'geojson'

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
  const map2dContainerRef = React.useRef<HTMLDivElement | null>(null)
  const map3dContainerRef = React.useRef<HTMLDivElement | null>(null)
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
  const fitPadding = show3d ? 0 : 24
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

  const basemap2d = useMapLibreBasemap({
    enabled: show2d,
    rootRef,
    containerRef: map2dContainerRef,
    targetStyleUrl,
    canvasRenderMode: '2d',
    projectionMode: 'mercator',
    viewportSizingMode: 'fit',
    vectorFallbackMs: 2_000,
  })
  const basemap3d = useMapLibreBasemap({
    enabled: show3d,
    rootRef,
    containerRef: map3dContainerRef,
    targetStyleUrl,
    canvasRenderMode: '3d',
    projectionMode: 'globe',
    viewportSizingMode: 'fit',
    vectorFallbackMs: 2_000,
  })
  const activeBasemap = show3d ? basemap3d : basemap2d

  const graphSourceIdBase = 'kg-host-graph:nodes'
  const graphSourceIdClustered = `${graphSourceIdBase}:clustered`
  const graphSourceIdUnclustered = `${graphSourceIdBase}:plain`
  const graphDataAppliedRef = React.useRef<{ map2d: string; map3d: string }>({ map2d: '', map3d: '' })

  const applyFeatureCollectionToBasemap = React.useCallback(
    (args: { basemapMap: any | null; styleRevision: number; viewMode: 'map2d' | 'map3d' }) => {
      const { basemapMap, styleRevision, viewMode } = args
      if (!basemapMap) return
      if (styleRevision <= 0) return
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
      const applyKey = `${styleRevision}:${activeSourceId}:${graphDataKey}`
      if (graphDataAppliedRef.current[viewMode] === applyKey) return
      clearGeoJsonSourceData(basemapMap, inactiveSourceId)
      ensureDatasetLayer(basemapMap, activeSourceId, colorForDataset(activeSourceId), cluster ? { cluster: true } : undefined)
      setGeoJsonSourceData(basemapMap, activeSourceId, graphFeatureCollection)
      graphDataAppliedRef.current[viewMode] = applyKey
    },
    [graphDataKey, graphFeatureCollection, graphSourceIdClustered, graphSourceIdUnclustered],
  )

  React.useEffect(() => {
    if (!show2d) return
    applyFeatureCollectionToBasemap({ basemapMap: basemap2d.map, styleRevision: basemap2d.styleRevision, viewMode: 'map2d' })
  }, [applyFeatureCollectionToBasemap, basemap2d.map, basemap2d.styleRevision, show2d])

  React.useEffect(() => {
    if (!show3d) return
    applyFeatureCollectionToBasemap({ basemapMap: basemap3d.map, styleRevision: basemap3d.styleRevision, viewMode: 'map3d' })
  }, [applyFeatureCollectionToBasemap, basemap3d.map, basemap3d.styleRevision, show3d])

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

  return (
    <div ref={rootRef} className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div
        ref={map2dContainerRef}
        className={show2d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <div
        ref={map3dContainerRef}
        className={show3d ? 'absolute inset-0 pointer-events-auto opacity-100' : 'absolute inset-0 pointer-events-none opacity-0'}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {debug ? (
        <div className="absolute top-2 right-2 z-20 pointer-events-none rounded-md border border-gray-200/60 bg-white/80 px-2 py-1 text-[11px] text-gray-700 dark:border-gray-800/60 dark:bg-black/60 dark:text-gray-200">
          <div>map: {activeBasemap.map ? 'yes' : 'no'}</div>
          <div>
            canvas: {activeBasemap.probe.canvasW}×{activeBasemap.probe.canvasH} tilesLoaded: {activeBasemap.probe.tilesLoaded ? 'yes' : 'no'}
          </div>
          <div>
            zoom: {activeBasemap.probe.zoom.toFixed(2)} center: {activeBasemap.probe.lng.toFixed(4)},{activeBasemap.probe.lat.toFixed(4)}
          </div>
          <div>features: {Array.isArray(graphFeatureCollection.features) ? graphFeatureCollection.features.length : 0}</div>
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
