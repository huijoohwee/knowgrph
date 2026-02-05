import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphTableId } from '@/features/graph-table-db/graphTableDb'

export const applyCellUpdateToGraphStore = (
  tableId: GraphTableId,
  rowId: string,
  columnId: string,
  value: unknown,
): void => {
  const s = useGraphStore.getState()
  if (tableId === 'nodes') {
    if (columnId === 'label') {
      s.updateNode(rowId, { label: String(value ?? '') })
      return
    }
    if (columnId === 'type') {
      s.updateNode(rowId, { type: String(value ?? '') })
      return
    }
    if (columnId === 'id') return
    const key = columnId.startsWith('prop:') ? columnId.slice('prop:'.length) : columnId
    const current = s.graphData?.nodes.find(n => n.id === rowId)
    const properties = { ...(current?.properties || {}) }
    properties[key] = value as never
    s.updateNode(rowId, { properties })
    return
  }

  if (columnId === 'label') {
    s.updateEdge(rowId, { label: String(value ?? '') })
    return
  }
  if (columnId === 'source') {
    s.updateEdge(rowId, { source: String(value ?? '') })
    return
  }
  if (columnId === 'target') {
    s.updateEdge(rowId, { target: String(value ?? '') })
    return
  }
  if (columnId === 'id') return
  const key = columnId.startsWith('prop:') ? columnId.slice('prop:'.length) : columnId
  const current = s.graphData?.edges.find(e => e.id === rowId)
  const properties = { ...(current?.properties || {}) }
  properties[key] = value as never
  s.updateEdge(rowId, { properties })
}
