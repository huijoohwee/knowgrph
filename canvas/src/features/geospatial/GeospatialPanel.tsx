import React from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { resolveThemeColors, UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { transformGraphNodesToGeoJson } from '@/features/geospatial/mapLibreAdapter'
import { getGeospatialMapStyleUrl } from '@/features/geospatial/openFreeMap'
import { proximitySearchFromFeatures } from '@/features/geospatial/spatialQueryEngine'
import type { LngLat } from '@/features/geospatial/types'
import { getBoundaryGeoJsonUrlFromEnv, loadBoundaryGeoJson } from '@/features/geospatial/boundaryProvider'
import { getNodeBaseFill } from '@/lib/graph/visualStyles'
import { getRendererPalette } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import { UI_COPY, UI_LABELS } from '@/lib/config'

const SOURCE_ID = 'kg:geospatial:entities'
const LAYER_ID = 'kg:geospatial:entities:points'
const LAYER_SELECTED_ID = 'kg:geospatial:entities:selected'
const BOUNDARY_SOURCE_ID = 'kg:geospatial:boundaries'
const BOUNDARY_LAYER_ID = 'kg:geospatial:boundaries:fill'
const BOUNDARY_LINE_LAYER_ID = 'kg:geospatial:boundaries:line'

const EMPTY_NODES: GraphNode[] = []

export default function GeospatialPanel() {
  const { nodes, selectedNodeId, selectNode, schema } = useGraphStore(
    useShallow(s => ({
      nodes: s.graphData?.nodes ?? EMPTY_NODES,
      selectedNodeId: s.selectedNodeId,
      selectNode: s.selectNode,
      schema: s.schema,
    })),
  )
  const palette = React.useMemo(() => getRendererPalette(schema), [schema])

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = React.useState(false)
  const geoJsonRef = React.useRef<ReturnType<typeof transformGraphNodesToGeoJson> | null>(null)
  const selectNodeRef = React.useRef(selectNode)
  const [center, setCenter] = React.useState<LngLat | null>(null)
  const [radiusKm, setRadiusKm] = React.useState<number>(50)
  const [matches, setMatches] = React.useState<Array<{ id: string; distanceKm: number }>>([])
  const [boundaryUrl, setBoundaryUrl] = React.useState<string>(() => getBoundaryGeoJsonUrlFromEnv())
  const [boundaryStatus, setBoundaryStatus] = React.useState<string | null>(null)

  const geoJson = React.useMemo(
    () => transformGraphNodesToGeoJson(nodes, { getFill: node => getNodeBaseFill(node, schema) }),
    [nodes, schema],
  )
  React.useEffect(() => {
    geoJsonRef.current = geoJson
  }, [geoJson])
  React.useEffect(() => {
    selectNodeRef.current = selectNode
  }, [selectNode])
  const coordById = React.useMemo(() => {
    const next = new Map<string, LngLat>()
    for (const f of geoJson.features) {
      const coords = f.geometry.coordinates
      next.set(f.properties.entityId, [coords[0], coords[1]])
    }
    return next
  }, [geoJson])

  React.useEffect(() => {
    let cancelled = false
    const container = mapContainerRef.current
    if (!container) return
    if (mapRef.current) return

    const init = async () => {
      setMapReady(false)
      const maplibregl = await import('maplibre-gl')
      if (cancelled) return
      const map = new maplibregl.Map({
        container,
        style: getGeospatialMapStyleUrl(),
        center: [0, 0],
        zoom: 1.5,
        attributionControl: false,
      })
      mapRef.current = map

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

      map.on('load', () => {
        if (cancelled) return
        const theme = resolveThemeColors()
        try {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: geoJsonRef.current || geoJson,
          })
          map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-radius': 5,
              'circle-color': ['coalesce', ['get', 'fill'], palette.nodes.execution],
              'circle-opacity': 0.85,
              'circle-stroke-width': 1,
              'circle-stroke-color': theme.nodeStroke,
            },
          })
          map.addLayer({
            id: LAYER_SELECTED_ID,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['get', 'entityId'], ''],
            paint: {
              'circle-radius': 7,
              'circle-color': palette.nodes.hypothesis,
              'circle-opacity': 0.95,
              'circle-stroke-width': 2,
              'circle-stroke-color': palette.edges.neutral,
            },
          })
        } catch {
          void 0
        }
        setMapReady(true)
      })

      const handleMapClick = (e: MapMouseEvent) => {
        const clicked = e.point
        try {
          const feats = map.queryRenderedFeatures(clicked, { layers: [LAYER_ID] })
          const first = feats && feats[0]
          const props = first && (first.properties as unknown as Record<string, unknown>)
          const entityId = props && typeof props.entityId === 'string' ? props.entityId : ''
          if (entityId) {
            selectNodeRef.current(entityId)
            return
          }
        } catch {
          void 0
        }
        try {
          const lngLat = e.lngLat
          const nextCenter: LngLat = [lngLat.lng, lngLat.lat]
          setCenter(nextCenter)
        } catch {
          void 0
        }
      }
      map.on('click', handleMapClick)
    }

    void init()
    return () => {
      cancelled = true
      const map = mapRef.current
      mapRef.current = null
      if (map) {
        try {
          map.remove()
        } catch {
          void 0
        }
      }
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const map = mapRef.current
    if (!map || !mapReady) return
    const url = String(boundaryUrl || '').trim()
    if (!url) {
      setBoundaryStatus(null)
      try {
        if (map.getLayer(BOUNDARY_LAYER_ID)) map.removeLayer(BOUNDARY_LAYER_ID)
        if (map.getLayer(BOUNDARY_LINE_LAYER_ID)) map.removeLayer(BOUNDARY_LINE_LAYER_ID)
        if (map.getSource(BOUNDARY_SOURCE_ID)) map.removeSource(BOUNDARY_SOURCE_ID)
      } catch {
        void 0
      }
      return
    }
    const run = async () => {
      try {
        setBoundaryStatus(UI_COPY.geospatialBoundaryStatusLoading)
        const collection = await loadBoundaryGeoJson(url)
        if (cancelled) return
        if (!collection) {
          setBoundaryStatus(UI_COPY.geospatialBoundaryStatusLoadFailed)
          return
        }
        try {
          if (map.getSource(BOUNDARY_SOURCE_ID)) {
            const src = map.getSource(BOUNDARY_SOURCE_ID) as unknown as { setData?: (data: unknown) => void } | null
            if (src && typeof src.setData === 'function') src.setData(collection)
          } else {
            map.addSource(BOUNDARY_SOURCE_ID, { type: 'geojson', data: collection })
          }
          if (!map.getLayer(BOUNDARY_LAYER_ID)) {
            map.addLayer({
              id: BOUNDARY_LAYER_ID,
              type: 'fill',
              source: BOUNDARY_SOURCE_ID,
              paint: {
                'fill-color': palette.edges.neutral,
                'fill-opacity': 0.1,
              },
            })
          }
          if (!map.getLayer(BOUNDARY_LINE_LAYER_ID)) {
            map.addLayer({
              id: BOUNDARY_LINE_LAYER_ID,
              type: 'line',
              source: BOUNDARY_SOURCE_ID,
              paint: {
                'line-color': palette.edges.neutral,
                'line-width': 1,
              },
            })
          }
          setBoundaryStatus(UI_COPY.geospatialBoundaryStatusOverlayLoaded)
        } catch {
          setBoundaryStatus(UI_COPY.geospatialBoundaryStatusOverlayFailed)
        }
      } catch {
        if (!cancelled) setBoundaryStatus(UI_COPY.geospatialBoundaryStatusLoadFailed)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [boundaryUrl, mapReady, palette])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const theme = resolveThemeColors()
    try {
      if (map.getLayer(LAYER_ID)) {
        map.setPaintProperty(LAYER_ID, 'circle-color', ['coalesce', ['get', 'fill'], palette.nodes.execution])
        map.setPaintProperty(LAYER_ID, 'circle-stroke-color', theme.nodeStroke)
      }
      if (map.getLayer(LAYER_SELECTED_ID)) {
        map.setPaintProperty(LAYER_SELECTED_ID, 'circle-color', palette.nodes.hypothesis)
        map.setPaintProperty(LAYER_SELECTED_ID, 'circle-stroke-color', palette.edges.neutral)
      }
      if (map.getLayer(BOUNDARY_LAYER_ID)) {
        map.setPaintProperty(BOUNDARY_LAYER_ID, 'fill-color', palette.edges.neutral)
      }
      if (map.getLayer(BOUNDARY_LINE_LAYER_ID)) {
        map.setPaintProperty(BOUNDARY_LINE_LAYER_ID, 'line-color', palette.edges.neutral)
      }
    } catch {
      void 0
    }
  }, [palette, mapReady])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      const source = map.getSource(SOURCE_ID) as unknown as { setData?: (data: unknown) => void } | null
      if (source && typeof source.setData === 'function') source.setData(geoJson)
    } catch {
      void 0
    }
  }, [geoJson, mapReady])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    try {
      map.setFilter(LAYER_SELECTED_ID, ['==', ['get', 'entityId'], selectedNodeId || ''])
    } catch {
      void 0
    }
    const coords = selectedNodeId ? coordById.get(selectedNodeId) : null
    if (coords) {
      try {
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 6), speed: 1.2 })
      } catch {
        void 0
      }
    }
  }, [selectedNodeId, coordById, mapReady])

  React.useEffect(() => {
    let cancelled = false
    if (!center) {
      setMatches([])
      return
    }
    const run = async () => {
      try {
        const next = await proximitySearchFromFeatures({
          center,
          radiusKm,
          features: geoJson,
          limit: 200,
        })
        if (!cancelled) setMatches(next)
      } catch {
        if (!cancelled) setMatches([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [center, radiusKm, geoJson])

  return (
    <div className={`h-full flex flex-col ${UI_THEME_TOKENS.panel.bg}`}>
      <div className={`p-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <div className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_LABELS.geospatialMode}</div>
        <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialPanelSubtitle}</div>
        <div className="mt-2 flex items-center gap-2">
          <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialRadiusLabel}</div>
          <input
            type="range"
            min={1}
            max={250}
            step={1}
            value={radiusKm}
            onChange={e => setRadiusKm(Number(e.target.value))}
            className="flex-1"
          />
          <div className={`text-xs tabular-nums ${UI_THEME_TOKENS.text.secondary}`}>{radiusKm}</div>
        </div>
        {center && (
          <div className={`mt-1 text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>
            {UI_COPY.geospatialCenterStatus(center[1].toFixed(4), center[0].toFixed(4), matches.length)}
          </div>
        )}
        <div className="mt-2">
          <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialBoundaryUrlLabel}</div>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={boundaryUrl}
              onChange={e => setBoundaryUrl(e.target.value)}
              className={[
                'flex-1 h-7 px-2 rounded border text-xs',
                UI_THEME_TOKENS.input.bg,
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.input.text,
              ].join(' ')}
              placeholder={UI_COPY.geospatialBoundaryUrlPlaceholder}
            />
            <button
              type="button"
              className={[
                'h-7 px-2 rounded border text-xs',
                UI_THEME_TOKENS.input.border,
                UI_THEME_TOKENS.button.hoverBg,
                UI_THEME_TOKENS.text.secondary,
              ].join(' ')}
              onClick={() => setBoundaryUrl(v => v.trim())}
            >
              {UI_COPY.geospatialBoundaryLoadButtonLabel}
            </button>
          </div>
          {boundaryStatus && (
            <div className={`mt-1 text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>{boundaryStatus}</div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>

      <div className={`max-h-40 overflow-auto border-t ${UI_THEME_TOKENS.panel.border}`}>
        {matches.length === 0 ? (
          <div className={`p-2 text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.geospatialNoProximityResults}</div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {matches.map(m => (
              <button
                key={m.id}
                type="button"
                className={[
                  'w-full text-left px-2 py-1 text-xs',
                  UI_THEME_TOKENS.button.hoverBg,
                  m.id === selectedNodeId ? UI_THEME_TOKENS.button.activeBg : '',
                ].join(' ')}
                onClick={() => selectNode(m.id)}
              >
                <span className={`font-mono ${UI_THEME_TOKENS.text.secondary}`}>{m.id}</span>
                <span className={`ml-2 tabular-nums ${UI_THEME_TOKENS.text.tertiary}`}>
                  {m.distanceKm.toFixed(2)} km
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
