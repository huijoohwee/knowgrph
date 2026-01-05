import type * as d3 from 'd3'
import { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { canAddEdge } from '@/features/schema/validation'

export type PendingLink = { mode: 'create' | 'update-source' | 'update-target'; fromId: string }

export type TempLinkSelection = d3.Selection<SVGLineElement, unknown, SVGGElement, unknown> | null

export function startEdgeFromNode(
  node: GraphNode,
  tempLinkSelRef: { current: TempLinkSelection },
  linkDragRef: { current: PendingLink | null },
) {
  linkDragRef.current = { mode: 'create', fromId: node.id }
  if (tempLinkSelRef.current) {
    tempLinkSelRef.current
      .attr('x1', node.x || 0)
      .attr('y1', node.y || 0)
      .attr('x2', node.x || 0)
      .attr('y2', node.y || 0)
      .style('display', null)
  }
}

export function startUpdateEdgeEndpoint(
  edge: GraphEdge,
  endpointNode: GraphNode,
  mode: 'update-source' | 'update-target',
  tempLinkSelRef: { current: TempLinkSelection },
  linkDragRef: { current: PendingLink | null },
  selectEdge: (id: string) => void,
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void,
) {
  linkDragRef.current = { mode, fromId: endpointNode.id }
  if (tempLinkSelRef.current) {
    tempLinkSelRef.current
      .attr('x1', endpointNode.x || 0)
      .attr('y1', endpointNode.y || 0)
      .attr('x2', endpointNode.x || 0)
      .attr('y2', endpointNode.y || 0)
      .style('display', null)
  }
  setSelectionSource('menu')
  selectEdge(edge.id)
}

export function requestStartEdgeFromNodeId(
  fromId: string,
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => void,
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void,
) {
  setSelectionSource('toolbar')
  requestEdgeCreation({ type: 'create', fromId })
}

export function requestUpdateEdgeEndpointByEdge(
  edgeId: string,
  mode: 'update-source' | 'update-target',
  data: { edges: GraphEdge[] },
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => void,
  selectEdge: (id: string) => void,
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void,
) {
  const e = data.edges.find(x => x.id === edgeId)
  if (!e) return
  const fromId = mode === 'update-source' ? String(e.source) : String(e.target)
  setSelectionSource('toolbar')
  selectEdge(edgeId)
  requestEdgeCreation({ type: mode, fromId })
}

export function finalizePendingEdge(
  toNodeId: string,
  data: GraphData,
  selectedEdgeId: string | null,
  tempLinkSelRef: { current: TempLinkSelection },
  linkDragRef: { current: PendingLink | null },
  addEdge: (e: GraphEdge) => void,
  updateEdge: (id: string, u: Partial<GraphEdge>) => void,
  selectEdge: (id: string) => void,
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void,
  schema?: GraphSchema,
) {
  if (!linkDragRef.current) return false
  if (tempLinkSelRef.current) tempLinkSelRef.current.style('display', 'none')
  const { mode, fromId } = linkDragRef.current
  linkDragRef.current = null
  if (mode === 'create') {
    const exists = data.edges.some(e => String(e.source) === fromId && String(e.target) === toNodeId)
    if (!exists) {
      // Prevent self-loops if configured
      if (schema?.behavior?.preventSelfLoopsGlobal && fromId === toNodeId) {
        return true
      }
      const newEdge: GraphEdge = {
        id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        source: fromId,
        target: toNodeId,
        label: 'link',
        properties: {},
      }
      // Enforce endpoint matrix and cardinality if schema provided
      if (schema && !canAddEdge(schema, data, newEdge)) {
        return true
      }
      addEdge(newEdge)
      setSelectionSource('canvas')
      selectEdge(newEdge.id)
    } else {
      const dup = data.edges.find(e => String(e.source) === fromId && String(e.target) === toNodeId)!
      setSelectionSource('canvas')
      selectEdge(dup.id)
    }
    return true
  }
  if (selectedEdgeId) {
    const existing = data.edges.find(e => e.id === selectedEdgeId)
    if (existing) {
      const next: GraphEdge = {
        ...existing,
        source: mode === 'update-source' ? toNodeId : existing.source,
        target: mode === 'update-target' ? toNodeId : existing.target,
      }
      if (schema?.behavior?.preventSelfLoopsGlobal && String(next.source) === String(next.target)) {
        return true
      }
      if (!schema || canAddEdge(schema, data, next)) {
        if (mode === 'update-source') updateEdge(selectedEdgeId, { source: toNodeId })
        else if (mode === 'update-target') updateEdge(selectedEdgeId, { target: toNodeId })
      } else {
        return true
      }
    }
    setSelectionSource('canvas')
    selectEdge(selectedEdgeId)
    return true
  }
  return false
}

export function hideTempLink(tempLinkSelRef: { current: TempLinkSelection }) {
  if (tempLinkSelRef.current) tempLinkSelRef.current.style('display', 'none')
}

export function cancelPendingEdge(linkDragRef: { current: PendingLink | null }) {
  linkDragRef.current = null
}
