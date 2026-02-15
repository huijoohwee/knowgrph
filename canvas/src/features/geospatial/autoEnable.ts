import type { GraphData } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { emitSidePanelOpen } from '@/features/canvas/utils'

const hasGeoNodes = (graphData: GraphData): boolean => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const limit = nodes.length > 80 ? 80 : nodes.length
  for (let i = 0; i < limit; i += 1) {
    const n = nodes[i] as any
    const props = n && typeof n === 'object' ? (n.properties as any) : null
    const geo = props && typeof props === 'object' ? (props.geo as any) : null
    const lat = geo && typeof geo === 'object' ? geo.lat : null
    const lng = geo && typeof geo === 'object' ? geo.lng : null
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

  const ctx = (graphData as any).context
  const isGeoContext = ctx === 'geojson' || ctx === 'geodata'
  if (!isGeoContext && !hasGeoNodes(graphData)) return

  try {
    const enabled = await setGeospatialModeEnabled(true)
    if (enabled && args.openSidePanel) emitSidePanelOpen({ tab: 'geo', open: true })
  } catch {
    void 0
  }
}

