import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Unsubscribable } from 'rxjs'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import {
  getGraphRecordDb,
  type GraphRecordColumnDoc,
  type GraphRecordRowDoc,
  type GraphRecordTableId,
  updateGraphRecordCell,
} from '@/lib/graph-record-db'
import { GraphRecordInspector, type GraphRecordInspectorRow } from '@/features/graph-inspector/ui/GraphRecordInspector'
import { applyRecordCellUpdateToGraphStore } from '@/features/graph-inspector/lib/applyRecordCellUpdateToGraphStore'
import { useGraphRecordDbSync } from '@/features/graph-inspector/hooks/useGraphRecordDbSync'
import { hashRecordSignature32 } from '@/lib/hash/signature'
import type { PersistedCollectionChangeEvent } from '@/lib/storage/persistedCollectionStore'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { getCachedGraphLookup, type CachedGraphLookup } from '@/lib/graph/lookupCache'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

const EMPTY_STRING_ARRAY: string[] = []

const toInspectorRow = (tableId: GraphRecordTableId, doc: GraphRecordRowDoc): GraphRecordInspectorRow => ({
  tableId,
  rowId: doc.rowId,
  order: doc.order,
  data: {
    id: doc.rowId,
    ...(doc.data || {}),
  },
})

const buildFallbackInspectorRow = (
  selection: { tableId: GraphRecordTableId; rowId: string } | null,
  baseGraphLookup: CachedGraphLookup | null,
): GraphRecordInspectorRow | null => {
  if (!selection) return null
  const { tableId, rowId } = selection
  if (!baseGraphLookup) return { tableId, rowId, order: 0, data: { id: rowId } }

  if (tableId === 'nodes') {
    const node = baseGraphLookup.nodeById.get(rowId) || null
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

  const edge = baseGraphLookup.edgeById.get(rowId) || null
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

export default function GraphRecordSelectionInspector() {
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds ?? EMPTY_STRING_ARRAY)
  const graphContentRevision = useGraphStore(s => s.graphContentRevision)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const canvasWorkspaceSyncMode = useGraphStore(s => s.canvasWorkspaceSyncMode)
  const baseGraphData = useGraphStore(s => s.graphData)
  const collapsedGroupIds = useGraphStore(s => (s.collapsedGroupIds ?? EMPTY_STRING_ARRAY) as string[])

  const collapsedGroupIdsKey = useMemo(() => {
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])
  const baseGraphSemanticKey = useMemo(
    () => buildScopedGraphSemanticKey('graph-record-selection-inspector-base-graph', { graphData: baseGraphData ?? null, graphRevision: graphDataRevision }),
    [baseGraphData, graphDataRevision],
  )
  const baseGraphLookup = useMemo(
    () => getCachedGraphLookup({
      cacheScope: 'graph-record-selection-inspector-base-graph',
      graphData: baseGraphData,
      graphRevision: graphDataRevision,
      graphSemanticKey: baseGraphSemanticKey,
      preferCurrentGraphDataRefs: true,
    }),
    [baseGraphData, baseGraphSemanticKey, graphDataRevision],
  )

  const syncGraphData = useMemo(() => {
    if (!baseGraphData) return null
    if (!collapsedGroupIdsKey) return baseGraphData
    return deriveGraphDataWithGroupCollapse({ graphData: baseGraphData, collapsedGroupIds: collapsedGroupIdsKey.split('|').filter(Boolean) })
  }, [baseGraphData, collapsedGroupIdsKey])

  const syncEnabled = canvasWorkspaceSyncMode === 'realtime'
  const graphSyncRevision = infiniteCanvasInteractionMode === 'interactive' ? graphDataRevision : graphContentRevision
  const { noteGraphWrite } = useGraphRecordDbSync(graphSyncRevision, syncGraphData, `baseline:${collapsedGroupIdsKey}`, syncEnabled)
  const [columns, setColumns] = useState<GraphRecordColumnDoc[]>([])
  const [row, setRow] = useState<GraphRecordInspectorRow | null>(null)
  const rowHashRef = useRef<number>(0)

  const selection = useMemo(() => {
    if (selectedNodeId) return { tableId: 'nodes' as const, rowId: selectedNodeId }
    if (selectedEdgeId) return { tableId: 'edges' as const, rowId: selectedEdgeId }
    if (openWidgetNodeIds.length > 0) {
      const nodeById = baseGraphLookup?.nodeById || null
      for (let i = openWidgetNodeIds.length - 1; i >= 0; i -= 1) {
        const id = String(openWidgetNodeIds[i] || '').trim()
        if (!id) continue
        if (!nodeById?.has(id)) continue
        return { tableId: 'nodes' as const, rowId: id }
      }
    }
    return null
  }, [baseGraphLookup, openWidgetNodeIds, selectedEdgeId, selectedNodeId])

  useEffect(() => {
    if (!selection) {
      setColumns([])
      setRow(null)
      rowHashRef.current = 0
      return
    }
    const fallback = buildFallbackInspectorRow(selection, baseGraphLookup)
    if (fallback) {
      const fallbackHash = hashRecordSignature32(fallback.data || {}, { maxEntries: 120, maxDepth: 1 })
      rowHashRef.current = fallbackHash
      setRow(fallback)
    }
    let cancelled = false
    let colSub: Unsubscribable | null = null
    let rowSub: Unsubscribable | null = null
    let colMap = new Map<string, GraphRecordColumnDoc>()
    const { tableId, rowId } = selection
    const pk = `${tableId}:${rowId}`

    void (async () => {
      const { collections } = await getGraphRecordDb()
      const initialCols = await collections.columns.find({ selector: { tableId } }).sort({ order: 'asc' }).exec()
      if (cancelled) return
      colMap = new Map(initialCols.map(d => [d.get('pk'), d.toJSON() as GraphRecordColumnDoc]))
      setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))

      const doc = await collections.rows.findOne(pk).exec()
      if (cancelled) return
      if (!doc) {
        const nextFallback = buildFallbackInspectorRow(selection, baseGraphLookup)
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
        const json = doc.toJSON() as GraphRecordRowDoc
        rowHashRef.current = hashRecordSignature32(json.data || {}, { maxEntries: 120, maxDepth: 1 })
        setRow(toInspectorRow(tableId, json))
      }

      colSub = collections.columns.$.subscribe((ev: PersistedCollectionChangeEvent<GraphRecordColumnDoc>) => {
        const docData = ev.documentData
        if (!docData || docData.tableId !== tableId) return
        if (ev.operation === 'DELETE') colMap.delete(ev.documentId)
        else colMap.set(ev.documentId, docData)
        setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))
      })

      rowSub = collections.rows.$.subscribe((ev: PersistedCollectionChangeEvent<GraphRecordRowDoc>) => {
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
  }, [baseGraphLookup, selection])

  const handleClose = useCallback(() => {
    const store = useGraphStore.getState()
    if (selectedNodeId) store.selectNode(null)
    else if (selectedEdgeId) store.selectEdge(null)
  }, [selectedEdgeId, selectedNodeId])

  const handleDelete = useCallback(() => {
    if (!selection) return
    const { tableId, rowId } = selection
    void (async () => {
      const { collections } = await getGraphRecordDb()
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
        await updateGraphRecordCell(tableId, rowId, columnId, next)
        const prev = graphSyncRevision
        noteGraphWrite(prev + 1)
        applyRecordCellUpdateToGraphStore(tableId, rowId, columnId, next)
      })()
    },
    [graphSyncRevision, noteGraphWrite, selection],
  )

  return (
    <GraphRecordInspector
      columns={columns}
      row={row}
      scrollMode="parent"
      onClose={handleClose}
      onDeleteRow={handleDelete}
      onChangeCell={handleChangeCell}
    />
  )
}
