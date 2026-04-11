import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Subscription } from 'rxjs'
import type { RxChangeEvent } from 'rxdb'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
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
import { hashRecordSignature32 } from '@/lib/hash/signature'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'

const toInspectorRow = (tableId: GraphTableId, doc: GraphRowDoc): GraphTableInspectorRow => ({
  tableId,
  rowId: doc.rowId,
  order: doc.order,
  data: {
    id: doc.rowId,
    ...(doc.data || {}),
  },
})

const buildFallbackInspectorRow = (selection: { tableId: GraphTableId; rowId: string } | null): GraphTableInspectorRow | null => {
  if (!selection) return null
  const { tableId, rowId } = selection
  const store = useGraphStore.getState()
  const graphData = store.graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
  if (!graphData) return { tableId, rowId, order: 0, data: { id: rowId } }

  if (tableId === 'nodes') {
    const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as Array<{ id?: unknown; label?: unknown; type?: unknown }>) : []
    const node = nodes.find(n => String(n.id || '') === rowId) || null
    return {
      tableId,
      rowId,
      order: 0,
      data: {
        id: rowId,
        label: node ? String(node.label || '') : '',
        type: node ? String(node.type || '') : '',
      },
    }
  }

  const edges = Array.isArray(graphData.edges)
    ? (graphData.edges as Array<{ id?: unknown; label?: unknown; source?: unknown; target?: unknown }>)
    : []
  const edge = edges.find(e => String(e.id || '') === rowId) || null
  return {
    tableId,
    rowId,
    order: 0,
    data: {
      id: rowId,
      label: edge ? String(edge.label || '') : '',
      source: edge ? String(edge.source || '') : '',
      target: edge ? String(edge.target || '') : '',
    },
  }
}

export default function GraphTableSelectionInspector() {
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const editorWorkspacePane = useGraphStore(s => s.editorWorkspacePane)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const openQuickEditorNodeIds = useGraphStore(s => s.openQuickEditorNodeIds || [])
  const graphContentRevision = useGraphStore(s => s.graphContentRevision)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const canvasWorkspaceSyncMode = useGraphStore(s => s.canvasWorkspaceSyncMode)
  const baseGraphData = useGraphStore(s => s.graphData)
  const collapsedGroupIds = useGraphStore(s => (s.collapsedGroupIds || []) as string[])

  const collapsedGroupIdsKey = useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const syncGraphData = useMemo(() => {
    if (!baseGraphData) return null
    if (!collapsedGroupIdsKey) return baseGraphData
    return deriveGraphDataWithGroupCollapse({ graphData: baseGraphData, collapsedGroupIds: collapsedGroupIdsKey.split('|').filter(Boolean) })
  }, [baseGraphData, collapsedGroupIdsKey])

  const syncEnabled = (workspaceViewMode !== 'editor' || editorWorkspacePane !== 'graphTable') && canvasWorkspaceSyncMode === 'realtime'
  const graphSyncRevision = infiniteCanvasInteractionMode === 'interactive' ? graphDataRevision : graphContentRevision
  const { noteGraphWrite } = useGraphTableDbSync(graphSyncRevision, syncGraphData, `baseline:${collapsedGroupIdsKey}`, syncEnabled)
  const [columns, setColumns] = useState<GraphColumnDoc[]>([])
  const [row, setRow] = useState<GraphTableInspectorRow | null>(null)
  const rowHashRef = useRef<number>(0)

  const selection = useMemo(() => {
    if (selectedNodeId) return { tableId: 'nodes' as const, rowId: selectedNodeId }
    if (selectedEdgeId) return { tableId: 'edges' as const, rowId: selectedEdgeId }
    if (openQuickEditorNodeIds.length > 0) {
      const graphData = baseGraphData as unknown as { nodes?: unknown[] } | null
      const nodes = Array.isArray(graphData?.nodes) ? (graphData?.nodes as Array<{ id?: unknown }>) : []
      const nodeIdSet = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
      for (let i = openQuickEditorNodeIds.length - 1; i >= 0; i -= 1) {
        const id = String(openQuickEditorNodeIds[i] || '').trim()
        if (!id) continue
        if (!nodeIdSet.has(id)) continue
        return { tableId: 'nodes' as const, rowId: id }
      }
    }
    return null
  }, [baseGraphData, openQuickEditorNodeIds, selectedEdgeId, selectedNodeId])

  useEffect(() => {
    if (!selection) {
      setColumns([])
      setRow(null)
      rowHashRef.current = 0
      return
    }
    const fallback = buildFallbackInspectorRow(selection)
    if (fallback) {
      const fallbackHash = hashRecordSignature32(fallback.data || {}, { maxEntries: 120, maxDepth: 1 })
      rowHashRef.current = fallbackHash
      setRow(fallback)
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
        const nextFallback = buildFallbackInspectorRow(selection)
        if (!nextFallback) {
          rowHashRef.current = 0
          setRow(null)
          return
        }
        const nextHash = hashRecordSignature32(nextFallback.data || {}, { maxEntries: 120, maxDepth: 1 })
        setRow(prevRow => {
          if (nextHash === rowHashRef.current && prevRow) return prevRow
          rowHashRef.current = nextHash
          return nextFallback
        })
      } else {
        const json = doc.toJSON() as GraphRowDoc
        rowHashRef.current = hashRecordSignature32(json.data || {}, { maxEntries: 120, maxDepth: 1 })
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
        const nextHash = hashRecordSignature32(docData.data || {}, { maxEntries: 120, maxDepth: 1 })
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
      const prev = graphSyncRevision
      noteGraphWrite(prev + 1)
      if (tableId === 'nodes') useGraphStore.getState().removeNode(rowId)
      else useGraphStore.getState().removeEdge(rowId)
      if (tableId === 'nodes') useGraphStore.getState().selectNode(null)
      else useGraphStore.getState().selectEdge(null)
    })()
  }, [graphSyncRevision, noteGraphWrite, selection])

  const handleChangeCell = useCallback(
    (columnId: string, next: unknown) => {
      if (!selection) return
      const { tableId, rowId } = selection
      void (async () => {
        await updateGraphTableCell(tableId, rowId, columnId, next)
        const prev = graphSyncRevision
        noteGraphWrite(prev + 1)
        applyCellUpdateToGraphStore(tableId, rowId, columnId, next)
      })()
    },
    [graphSyncRevision, noteGraphWrite, selection],
  )

  return (
    <GraphTableInspector
      columns={columns}
      row={row}
      scrollMode="parent"
      onClose={handleClose}
      onDeleteRow={handleDelete}
      onChangeCell={handleChangeCell}
    />
  )
}
