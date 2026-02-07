import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Subscription } from 'rxjs'
import type { RxChangeEvent } from 'rxdb'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import {
  getGraphTableDb,
  type GraphColumnDoc,
  type GraphRowDoc,
  type GraphTableId,
  updateGraphTableCell,
} from '@/features/graph-table-db/graphTableDb'
import { GraphTableInspector, type GraphTableInspectorRow } from '@/features/graph-table/ui/GraphTableInspector'
import { applyCellUpdateToGraphStore } from '@/features/graph-table/lib/applyCellUpdateToGraphStore'
import { useGraphTableDbSync } from '@/features/graph-table/hooks/useGraphTableDbSync'
import { hashString32 } from 'grph-shared/hash/stringHash'

const toInspectorRow = (tableId: GraphTableId, doc: GraphRowDoc): GraphTableInspectorRow => ({
  tableId,
  rowId: doc.rowId,
  order: doc.order,
  data: {
    id: doc.rowId,
    ...(doc.data || {}),
  },
})

export default function GraphTableSelectionInspector() {
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const baseGraphData = useGraphStore(s => s.graphData)
  const renderGraphData = useActiveGraphRenderData()
  const syncGraphData = workspaceViewMode === 'editor' ? baseGraphData : renderGraphData
  const { noteGraphWrite } = useGraphTableDbSync(graphDataRevision, syncGraphData)
  const [columns, setColumns] = useState<GraphColumnDoc[]>([])
  const [row, setRow] = useState<GraphTableInspectorRow | null>(null)
  const rowHashRef = useRef<number>(0)

  const selection = useMemo(() => {
    if (selectedNodeId) return { tableId: 'nodes' as const, rowId: selectedNodeId }
    if (selectedEdgeId) return { tableId: 'edges' as const, rowId: selectedEdgeId }
    return null
  }, [selectedEdgeId, selectedNodeId])

  useEffect(() => {
    if (!selection) {
      setColumns([])
      setRow(null)
      rowHashRef.current = 0
      return
    }
    let cancelled = false
    let colSub: Subscription | null = null
    let rowSub: Subscription | null = null
    let colMap = new Map<string, GraphColumnDoc>()
    const { tableId, rowId } = selection
    const pk = `${tableId}:${rowId}`

    void (async () => {
      const { collections } = await getGraphTableDb()
      const initialCols = await collections.columns.find({ selector: { tableId } }).sort({ order: 'asc' }).exec()
      if (cancelled) return
      colMap = new Map(initialCols.map(d => [d.get('pk'), d.toJSON() as GraphColumnDoc]))
      setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))

      const doc = await collections.rows.findOne(pk).exec()
      if (cancelled) return
      if (!doc) {
        setRow(null)
      } else {
        const json = doc.toJSON() as GraphRowDoc
        rowHashRef.current = hashString32(JSON.stringify(json.data || {}))
        setRow(toInspectorRow(tableId, json))
      }

      colSub = collections.columns.$.subscribe((ev: RxChangeEvent<GraphColumnDoc>) => {
        const docData = ev.documentData
        if (!docData || docData.tableId !== tableId) return
        if (ev.operation === 'DELETE') colMap.delete(ev.documentId)
        else colMap.set(ev.documentId, docData)
        setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))
      })

      rowSub = collections.rows.$.subscribe((ev: RxChangeEvent<GraphRowDoc>) => {
        const docData = ev.documentData
        if (!docData || docData.tableId !== tableId || docData.rowId !== rowId) return
        if (ev.operation === 'DELETE') {
          rowHashRef.current = 0
          setRow(null)
          return
        }
        const nextHash = hashString32(JSON.stringify(docData.data || {}))
        setRow(prevRow => {
          if (nextHash === rowHashRef.current && prevRow) return prevRow
          rowHashRef.current = nextHash
          return toInspectorRow(tableId, docData)
        })
      })
    })()

    return () => {
      cancelled = true
      try {
        colSub?.unsubscribe()
      } catch {
        void 0
      }
      try {
        rowSub?.unsubscribe()
      } catch {
        void 0
      }
    }
  }, [selection])

  const handleClose = useCallback(() => {
    const store = useGraphStore.getState()
    if (selectedNodeId) store.selectNode(null)
    else if (selectedEdgeId) store.selectEdge(null)
  }, [selectedEdgeId, selectedNodeId])

  const handleDelete = useCallback(() => {
    if (!selection) return
    const { tableId, rowId } = selection
    void (async () => {
      const { collections } = await getGraphTableDb()
      const pk = `${tableId}:${rowId}`
      const doc = await collections.rows.findOne(pk).exec()
      if (doc) await doc.remove()
      const prev = useGraphStore.getState().graphDataRevision
      noteGraphWrite(prev + 1)
      if (tableId === 'nodes') useGraphStore.getState().removeNode(rowId)
      else useGraphStore.getState().removeEdge(rowId)
      if (tableId === 'nodes') useGraphStore.getState().selectNode(null)
      else useGraphStore.getState().selectEdge(null)
    })()
  }, [noteGraphWrite, selection])

  const handleChangeCell = useCallback(
    (columnId: string, next: unknown) => {
      if (!selection) return
      const { tableId, rowId } = selection
      void (async () => {
        await updateGraphTableCell(tableId, rowId, columnId, next)
        const prev = useGraphStore.getState().graphDataRevision
        noteGraphWrite(prev + 1)
        applyCellUpdateToGraphStore(tableId, rowId, columnId, next)
      })()
    },
    [noteGraphWrite, selection],
  )

  return (
    <GraphTableInspector
      columns={columns}
      row={row}
      onClose={handleClose}
      onDeleteRow={handleDelete}
      onChangeCell={handleChangeCell}
    />
  )
}
