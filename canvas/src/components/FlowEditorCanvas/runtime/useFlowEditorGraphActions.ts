import React from 'react'

import type { ToolMode } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { pickDefaultFlowPortKey } from '@/lib/graph/flowPorts'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'

export function useFlowEditorGraphActions(args: {
  active: boolean
  draftGraphData: GraphData | null
  baseGraphData: GraphData | null
  schema: unknown
  selectedNodeId: string | null
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  pendingEdgeSourcePortKey: string | null
  pendingSelectNodeIdRef: React.MutableRefObject<string | null>
  setSelectionSource: (source: 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown') => void
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  addEdge: (edge: GraphData['edges'][number]) => void
  addNode: (node: GraphNode) => void
  setToolMode: React.Dispatch<React.SetStateAction<ToolMode>>
  setPendingEdgeSourceId: React.Dispatch<React.SetStateAction<string | null>>
  setPendingEdgeSourcePortKey: React.Dispatch<React.SetStateAction<string | null>>
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
}) {
  const beginAddEdgeFromNode = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!args.active) return
      if (!args.draftGraphData) return
      const nodeIds = new Set((args.draftGraphData.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      const nodeById = new Map((args.draftGraphData.nodes || []).map(node => [String(node.id || ''), node] as const))
      const node = nodeById.get(id) || null
      const explicit = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const defaultPortKey = explicit || pickDefaultFlowPortKey(node, 'out') || null
      args.setSelectionSource('canvas')
      args.selectEdge(null)
      args.selectNode(id)
      args.setToolMode('addEdge')
      args.setPendingEdgeSourceId(id)
      args.setPendingEdgeSourcePortKey(defaultPortKey)
    },
    [args],
  )

  const finalizePendingEdge = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!args.active) return
      if (args.toolMode !== 'addEdge') return
      if (!args.draftGraphData) return
      const nodeIds = new Set((args.draftGraphData.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      if (!args.pendingEdgeSourceId) {
        args.setPendingEdgeSourceId(id)
        args.setPendingEdgeSourcePortKey(null)
        return
      }
      if (args.pendingEdgeSourceId === id) return

      const nodeById = new Map((args.draftGraphData.nodes || []).map(node => [String(node.id || ''), node] as const))
      const sourceNode = nodeById.get(args.pendingEdgeSourceId) || null
      const targetNode = nodeById.get(id) || null
      const explicitSource =
        typeof args.pendingEdgeSourcePortKey === 'string' && args.pendingEdgeSourcePortKey.trim()
          ? args.pendingEdgeSourcePortKey.trim()
          : null
      const sourcePort = explicitSource || pickDefaultFlowPortKey(sourceNode, 'out') || null
      const explicitTarget = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const targetPort = explicitTarget || pickDefaultFlowPortKey(targetNode, 'in') || null

      const result = finalizeEdgeAuthoring({
        mode: 'create',
        data: args.draftGraphData,
        schema: args.schema,
        label: 'linksTo',
        selectedEdgeId: null,
        from: { nodeId: args.pendingEdgeSourceId, portKey: sourcePort },
        to: { nodeId: id, portKey: targetPort },
      })

      if (result.kind === 'blocked') {
        const message =
          result.reason === 'socket'
            ? `Incompatible port types: ${result.outType || '∅'} → ${result.inType || '∅'}.`
            : result.reason === 'schema'
              ? 'Edge blocked by schema rules.'
              : null
        if (message) {
          args.upsertUiToast({ id: 'flow-editor-edge-denied', kind: 'warning', message, ttlMs: 2200 })
        }
        return
      }

      if (result.kind === 'select-existing') {
        args.setSelectionSource('canvas')
        args.selectEdge(String(result.edgeId || ''))
        args.selectNode(null)
        args.setPendingEdgeSourceId(null)
        args.setPendingEdgeSourcePortKey(null)
        args.setToolMode('select')
        return
      }

      if (result.kind === 'create') {
        args.addEdge(result.edge)
        args.setPendingEdgeSourceId(null)
        args.setPendingEdgeSourcePortKey(null)
        args.setToolMode('select')
      }
    },
    [args],
  )

  React.useEffect(() => {
    if (!args.active) return
    if (args.toolMode !== 'addEdge') return
    if (!args.selectedNodeId) return
    finalizePendingEdge(args.selectedNodeId)
  }, [args.active, args.selectedNodeId, args.toolMode, finalizePendingEdge])

  const appendDraftNode = React.useCallback(
    (nodeArgs: { id?: string | null; type: string; label?: string | null; x: number; y: number; properties?: Record<string, unknown> }) => {
      const base: GraphData = (args.draftGraphData || args.baseGraphData || {
        context: '',
        type: 'Graph',
        nodes: [],
        edges: [],
      }) as GraphData
      const used = new Set<string>((base.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      const requested = typeof nodeArgs.id === 'string' && nodeArgs.id.trim() ? nodeArgs.id.trim() : ''
      const id = requested && !used.has(requested) ? requested : createUniqueId('n', used)

      const x = Number.isFinite(nodeArgs.x) ? nodeArgs.x : 0
      const y = Number.isFinite(nodeArgs.y) ? nodeArgs.y : 0
      const type = String(nodeArgs.type || '').trim() || 'Node'
      const label = String(nodeArgs.label || '').trim() || id
      const nextNode: GraphNode = {
        id,
        label,
        type,
        x,
        y,
        properties: (nodeArgs.properties || {}) as never,
      }
      const beforeIds = new Set<string>((useGraphStore.getState().graphData?.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      args.addNode(nextNode)
      const committedGraph = useGraphStore.getState().graphData as GraphData | null
      const committedNodes = Array.isArray(committedGraph?.nodes) ? (committedGraph.nodes as GraphNode[]) : []
      const exactId = committedNodes.find(node => String(node.id || '') === id)?.id
      const composedId = committedNodes.find(node => String(node.id || '').endsWith(`::${id}`))?.id
      const insertedId = committedNodes.find(node => {
        const nodeId = String(node.id || '')
        if (!nodeId || beforeIds.has(nodeId)) return false
        return String(node.type || '').trim() === type && String(node.label || '').trim() === label
      })?.id
      const actualId = String(exactId || composedId || insertedId || id).trim() || id
      args.pendingSelectNodeIdRef.current = actualId
      return actualId
    },
    [args],
  )

  return {
    appendDraftNode,
    beginAddEdgeFromNode,
    finalizePendingEdge,
  }
}
