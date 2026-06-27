import React from 'react'

import type { ToolMode } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createUniqueId } from '@/lib/ids'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { pickDefaultFlowPortKey } from '@/lib/graph/flowPorts'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'

export function useFlowEditorGraphActions(args: {
  active: boolean
  draftGraphData: GraphData | null
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  baseGraphData: GraphData | null
  schema: GraphSchema
  selectedNodeId: string | null
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  pendingEdgeSourcePortKey: string | null
  extraGraphNodesById?: Readonly<Record<string, GraphNode>> | null
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
  const materializeConnectedMediaValue = React.useCallback((materializeArgs: {
    sourceNode: GraphNode | null
    targetNode: GraphNode | null
    sourcePort: string | null
    targetPort: string | null
  }) => {
    const sourcePort = String(materializeArgs.sourcePort || '').trim()
    const targetPort = String(materializeArgs.targetPort || '').trim()
    if (!sourcePort || !targetPort) return
    if (!/^(mediaUrl|imageUrl|videoUrl)$/i.test(targetPort)) return
    const sourceProperties = (materializeArgs.sourceNode?.properties || {}) as Record<string, unknown>
    const targetProperties = (materializeArgs.targetNode?.properties || {}) as Record<string, unknown>
    const sourceCandidates = [
      sourceProperties[sourcePort],
      sourceProperties[targetPort],
      sourceProperties.mediaUrl,
      sourceProperties.renderUrl,
      sourceProperties.sourceUrl,
      sourceProperties.url,
    ]
    const value = sourceCandidates
      .map(candidate => (typeof candidate === 'string' ? candidate.trim() : ''))
      .find(Boolean) || ''
    if (!value) return
    if (String(targetProperties[targetPort] || '').trim() === value) return
    const liveGraphData = useGraphStore.getState().graphData as GraphData | null
    const rawTargetId = String(materializeArgs.targetNode?.id || '').trim()
    const resolvedTargetId = String(resolveGraphNodeByCanonicalId(liveGraphData, rawTargetId)?.id || '').trim()
    const targetIds = Array.from(new Set([resolvedTargetId, rawTargetId].filter(Boolean)))
    if (targetIds.length === 0) return
    for (const targetId of targetIds) {
      useGraphStore.getState().updateNode(targetId, {
        properties: {
          ...targetProperties,
          [targetPort]: value,
        } as never,
      })
    }
  }, [])

  const readLiveGraphData = React.useCallback((): GraphData | null => {
    return (useGraphStore.getState().graphData as GraphData | null) || null
  }, [])

  const readAuthoringGraphData = React.useCallback((): GraphData | null => {
    const base = args.draftGraphDataRef.current || readLiveGraphData() || args.draftGraphData || args.baseGraphData || null
    const extraNodesById = args.extraGraphNodesById || null
    if (!base || !extraNodesById) return base
    const nodes = Array.isArray(base.nodes) ? base.nodes : []
    const nodeIds = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
    const extraNodes = Object.values(extraNodesById).filter(node => {
      const id = String(node?.id || '').trim()
      return id && !nodeIds.has(id)
    })
    if (extraNodes.length === 0) return base
    return { ...base, nodes: [...nodes, ...extraNodes] }
  }, [args, readLiveGraphData])

  const readCommittedNodeIds = React.useCallback((): Set<string> => {
    const committed = readLiveGraphData() || args.draftGraphDataRef.current || args.draftGraphData || null
    return new Set(((committed?.nodes || []) as GraphNode[]).map(node => String(node.id || '')).filter(Boolean))
  }, [args, readLiveGraphData])

  const beginAddEdgeFromNode = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!args.active) return
      const authoringGraphData = readAuthoringGraphData()
      if (!authoringGraphData) return
      const nodeIds = new Set((authoringGraphData.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      const nodeById = new Map((authoringGraphData.nodes || []).map(node => [String(node.id || ''), node] as const))
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
    [args, readAuthoringGraphData],
  )

  const finalizePendingEdge = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!args.active) return
      if (args.toolMode !== 'addEdge') return
      const authoringGraphData = readAuthoringGraphData()
      if (!authoringGraphData) return
      const baseNodeIds = readCommittedNodeIds()
      const nodeIds = new Set((authoringGraphData.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      if (!args.pendingEdgeSourceId) {
        args.setPendingEdgeSourceId(id)
        args.setPendingEdgeSourcePortKey(null)
        return
      }
      if (args.pendingEdgeSourceId === id) return

      const nodeById = new Map((authoringGraphData.nodes || []).map(node => [String(node.id || ''), node] as const))
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
        data: authoringGraphData,
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
        const sourceNode = nodeById.get(String(args.pendingEdgeSourceId || '')) || null
        const targetNode = nodeById.get(id) || null
        if (sourceNode && !baseNodeIds.has(String(sourceNode.id || ''))) args.addNode(sourceNode)
        if (targetNode && !baseNodeIds.has(String(targetNode.id || ''))) args.addNode(targetNode)
        args.addEdge(result.edge)
        materializeConnectedMediaValue({ sourceNode, targetNode, sourcePort, targetPort })
        args.setPendingEdgeSourceId(null)
        args.setPendingEdgeSourcePortKey(null)
        args.setToolMode('select')
      }
    },
    [args, materializeConnectedMediaValue, readAuthoringGraphData, readCommittedNodeIds],
  )

  React.useEffect(() => {
    if (!args.active) return
    if (args.toolMode !== 'addEdge') return
    if (!args.selectedNodeId) return
    finalizePendingEdge(args.selectedNodeId)
  }, [args.active, args.selectedNodeId, args.toolMode, finalizePendingEdge])

  const appendDraftNode = React.useCallback(
    (nodeArgs: { id?: string | null; type: string; label?: string | null; x: number; y: number; properties?: Record<string, unknown> }) => {
      const base: GraphData = (args.draftGraphDataRef.current || args.draftGraphData || args.baseGraphData || {
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
      const actualId = String(exactId || composedId || insertedId || '').trim()
      if (!actualId) return ''
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
