import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { emitSidePanelOpen } from '@/features/canvas/utils'

const hasGeoNodes = (graphData: GraphData): boolean => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const limit = nodes.length > 80 ? 80 : nodes.length
  for (let i = 0; i < limit; i += 1) {
    const n = nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    const geo = (props.geo || {}) as { lat?: unknown; lng?: unknown }
    const lat = geo.lat
    const lng = geo.lng
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) return true
  }
  return false
}

export async function maybeAutoEnableGeospatialModeForGraphData(args: {
  graphData: GraphData | null | undefined
  openSidePanel?: boolean
}): Promise<void> {
  const graphData = args.graphData
  if (!graphData) return
  const state = useGraphStore.getState()
  if (state.autoEnableGeospatialOnGeoImport !== true) return

  const ctx = graphData.context
  const isGeoContext = ctx === 'geojson' || ctx === 'geodata'
  if (!isGeoContext && !hasGeoNodes(graphData)) return

  try {
    const enabled = await setGeospatialModeEnabled(true)
    if (enabled && args.openSidePanel) emitSidePanelOpen({ tab: 'geo', open: true })
  } catch {
    void 0
  }
}

