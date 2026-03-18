import type { GraphColumnDoc, GraphRowDoc } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'

export const mapRowDocToGridRow = (doc: GraphRowDoc): GraphTableGridRow => ({
  id: doc.rowId,
  __order: doc.order,
  ...(doc.data || {}),
})

export const getRowTocId = (row: GraphTableGridRow | null): string | null => {
  if (!row) return null
  const anyRow = row as unknown as Record<string, unknown>
  const anchorId = typeof anyRow.anchorId === 'string' ? anyRow.anchorId.trim() : ''
  if (anchorId) return anchorId
  const anchor = typeof anyRow.anchor === 'string' ? anyRow.anchor.trim() : ''
  if (anchor) return anchor
  const heading = typeof anyRow.heading === 'string' ? anyRow.heading.trim() : ''
  if (heading) return heading
  return null
}

export const applyColumnOrder = (args: { columns: GraphColumnDoc[]; orderIds: string[] | undefined }): GraphColumnDoc[] => {
  const base = args.columns
    .filter(c => !c.hidden)
    .slice()
    .sort((a, b) => a.order - b.order)
  const order = Array.isArray(args.orderIds) ? args.orderIds : null
  if (!order || order.length === 0) return base

  const byId = new Map<string, GraphColumnDoc>()
  for (const c of base) byId.set(c.columnId, c)
  const used = new Set<string>()
  const next: GraphColumnDoc[] = []
  for (const id of order) {
    const c = byId.get(id)
    if (!c) continue
    if (used.has(id)) continue
    used.add(id)
    next.push(c)
  }
  for (const c of base) {
    if (used.has(c.columnId)) continue
    next.push(c)
  }
  return next
}

export const reorderIds = (args: {
  ids: string[]
  fromId: string
  toId: string
  side: 'left' | 'right'
}): string[] => {
  const ids = args.ids.slice()
  const fromIndex = ids.indexOf(args.fromId)
  const toIndex = ids.indexOf(args.toId)
  if (fromIndex < 0 || toIndex < 0) return ids
  if (fromIndex === toIndex) return ids

  const insertBase = toIndex + (args.side === 'right' ? 1 : 0)
  const insertIndex = fromIndex < insertBase ? insertBase - 1 : insertBase
  ids.splice(fromIndex, 1)
  ids.splice(insertIndex, 0, args.fromId)
  return ids
}

