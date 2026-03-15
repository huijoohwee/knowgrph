import type * as d3 from 'd3'
import { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { GraphSchema } from '@/lib/graph/schema'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'

export type PendingLink = {
  mode: 'create' | 'update-source' | 'update-target'
  fromId: string
  fromPortKey?: string | null
  start?: { x: number; y: number } | null
}

export type TempLinkSelection = d3.Selection<SVGLineElement, unknown, SVGGElement, unknown> | null

export function startEdgeFromNode(
  node: GraphNode,
  tempLinkSelRef: { current: TempLinkSelection },
  linkDragRef: { current: PendingLink | null },
  opts?: { portKey?: string | null; start?: { x: number; y: number } | null },
) {
  const startX = opts?.start && Number.isFinite(opts.start.x) ? opts.start.x : node.x || 0
  const startY = opts?.start && Number.isFinite(opts.start.y) ? opts.start.y : node.y || 0
  linkDragRef.current = {
    mode: 'create',
    fromId: node.id,
    fromPortKey: typeof opts?.portKey === 'string' && opts.portKey.trim() ? opts.portKey.trim() : null,
    start: { x: startX, y: startY },
  }
  if (tempLinkSelRef.current) {
    tempLinkSelRef.current
      .attr('x1', startX)
      .attr('y1', startY)
      .attr('x2', startX)
      .attr('y2', startY)
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
  linkDragRef.current = { mode, fromId: endpointNode.id, fromPortKey: null, start: { x: endpointNode.x || 0, y: endpointNode.y || 0 } }
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
  toPortKey: string | null | undefined,
  data: GraphData,
  selectedEdgeId: string | null,
  tempLinkSelRef: { current: TempLinkSelection },
  linkDragRef: { current: PendingLink | null },
  addEdge: (e: GraphEdge) => void,
  updateEdge: (id: string, u: Partial<GraphEdge>) => void,
  selectEdge: (id: string) => void,
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void,
  schema?: GraphSchema,
  opts?: { label?: string },
) {
  if (!linkDragRef.current) return false
  if (tempLinkSelRef.current) tempLinkSelRef.current.style('display', 'none')
  const { mode, fromId, fromPortKey } = linkDragRef.current
  linkDragRef.current = null
  const label = String(opts?.label || '').trim() || 'link'
  const result = finalizeEdgeAuthoring({
    mode,
    data,
    schema: schema || null,
    label,
    selectedEdgeId,
    from: { nodeId: fromId, portKey: typeof fromPortKey === 'string' ? fromPortKey : null },
    to: { nodeId: toNodeId, portKey: typeof toPortKey === 'string' ? toPortKey : null },
  })
  if (result.kind === 'create') {
    addEdge(result.edge)
    setSelectionSource('canvas')
    selectEdge(result.edge.id)
    return true
  }
  if (result.kind === 'select-existing') {
    setSelectionSource('canvas')
    selectEdge(result.edgeId)
    return true
  }
  if (result.kind === 'update') {
    updateEdge(result.edgeId, result.patch)
    setSelectionSource('canvas')
    selectEdge(result.edgeId)
    return true
  }
  if (result.kind === 'blocked') {
    if (selectedEdgeId) {
      setSelectionSource('canvas')
      selectEdge(selectedEdgeId)
    }
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
