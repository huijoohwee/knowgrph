import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { GraphColumnKind } from '@/features/graph-table-db/graphTableDb'
import { parseGeodataValueToLatLng } from '@/features/geospatial/geodataValue'
import { maybeAutoEnableGeospatialModeForGraphData } from '@/features/geospatial/autoEnable'

export const applyCellUpdateToGraphStore = (
  tableId: GraphTableId,
  rowId: string,
  columnId: string,
  value: unknown,
  columnKind?: GraphColumnKind,
  options?: { skipGeospatialAutoEnable?: boolean },
): void => {
  const s = useGraphStore.getState()
  const normalizedValue = typeof value === 'string' && !value.trim() ? null : value
  if (tableId === 'nodes') {
    if (columnId === 'label') {
      s.updateNode(rowId, { label: String(normalizedValue ?? '') })
      return
    }
    if (columnId === 'type') {
      s.updateNode(rowId, { type: String(normalizedValue ?? '') })
      return
    }
    if (columnId === 'id') return
    const key = columnId.startsWith('prop:') ? columnId.slice('prop:'.length) : columnId
    const current = s.graphData?.nodes.find(n => n.id === rowId)
    const properties = { ...(current?.properties || {}) }
    if (normalizedValue == null) delete properties[key]
    else properties[key] = normalizedValue as never
    if (columnKind === 'geodata') {
      const geo = parseGeodataValueToLatLng(normalizedValue)
      if (geo) {
        const baseGeo =
          properties.geo && typeof properties.geo === 'object' && !Array.isArray(properties.geo)
            ? (properties.geo as Record<string, unknown>)
            : {}
        properties.geo = {
          ...baseGeo,
          lat: geo.lat,
          lng: geo.lng,
        } as never
      }
    }
    s.updateNode(rowId, { properties })
    if (columnKind === 'geodata' && !options?.skipGeospatialAutoEnable) {
      void maybeAutoEnableGeospatialModeForGraphData({ graphData: useGraphStore.getState().graphData, openSidePanel: false })
    }
    return
  }

  if (columnId === 'label') {
    s.updateEdge(rowId, { label: String(normalizedValue ?? '') })
    return
  }
  if (columnId === 'source') {
    s.updateEdge(rowId, { source: String(normalizedValue ?? '') })
    return
  }
  if (columnId === 'target') {
    s.updateEdge(rowId, { target: String(normalizedValue ?? '') })
    return
  }
  if (columnId === 'id') return
  const key = columnId.startsWith('prop:') ? columnId.slice('prop:'.length) : columnId
  const current = s.graphData?.edges.find(e => e.id === rowId)
  const properties = { ...(current?.properties || {}) }
  if (normalizedValue == null) delete properties[key]
  else properties[key] = normalizedValue as never
  s.updateEdge(rowId, { properties })
}
