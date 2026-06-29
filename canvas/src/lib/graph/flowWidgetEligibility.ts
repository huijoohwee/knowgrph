import type { GraphNode } from '@/lib/graph/types'
import type { GraphData, GraphEdge } from '@/lib/graph/types'
import {
  FLOW_ANNOTATION_ENGINE_NODE_TYPE_ID,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
import { readNodeProperties, unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import { filterSubgraphsByRetainedNodeIds } from '@/lib/graph/subgraphs'
import { isPlainObject } from '@/lib/graph/value'

const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId' as const
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const
const FLOW_WIDGET_NODE_TYPE_IDS = new Set<string>([
  FLOW_ANNOTATION_ENGINE_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
])

export function isFlowWidgetEligibleNode(node: Pick<GraphNode, 'properties' | 'type'> | null | undefined): boolean {
  const typeValue = unwrapGraphCellValue(node?.type)
  const nodeTypeId = typeof typeValue === 'string' ? typeValue.trim() : ''
  if (nodeTypeId && FLOW_WIDGET_NODE_TYPE_IDS.has(nodeTypeId)) return true
  const props = readNodeProperties(node)
  const raw = props[FLOW_WIDGET_FORM_ID_KEY]
  const formIdValue = unwrapGraphCellValue(raw)
  const formId = typeof formIdValue === 'string' ? formIdValue.trim() : ''
  if (formId) return true
  const portTypes = unwrapGraphCellValue(props[FLOW_PORT_TYPES_KEY])
  if (isPlainObject(portTypes)) return true
  return false
}

export function isFlowWidgetOverlayEligibleNode(
  node: Pick<GraphNode, 'properties' | 'type'> | null | undefined,
): boolean {
  return isFlowWidgetEligibleNode(node)
}

export function buildFlowWidgetEligibleNodeIdSet(nodes: Array<Pick<GraphNode, 'id' | 'properties' | 'type'>>): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(unwrapGraphCellValue(node?.id) || '').trim()
    if (!id) continue
    if (!isFlowWidgetEligibleNode(node)) continue
    out.add(id)
  }
  return out
}

export function buildFlowWidgetOverlayEligibleNodeIdSet(
  nodes: Array<Pick<GraphNode, 'id' | 'properties' | 'type'>>,
): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(unwrapGraphCellValue(node?.id) || '').trim()
    if (!id) continue
    if (!isFlowWidgetOverlayEligibleNode(node)) continue
    out.add(id)
  }
  return out
}

export function filterGraphToFlowWidgetEligible(data: GraphData): GraphData {
  const allNodes = Array.isArray(data.nodes) ? (data.nodes as GraphNode[]) : []
  const allEdges = Array.isArray(data.edges) ? (data.edges as GraphEdge[]) : []
  const eligible = buildFlowWidgetEligibleNodeIdSet(allNodes)
  if (eligible.size === 0) return filterSubgraphsByRetainedNodeIds({ ...data, nodes: [], edges: [] }, new Set<string>())

  const nodes = allNodes.filter(n => eligible.has(String(n?.id || '').trim()))
  const edges = allEdges.filter(e => {
    const src = readEdgeEndpointId((e as { source?: unknown }).source)
    const tgt = readEdgeEndpointId((e as { target?: unknown }).target)
    return Boolean(src && tgt && eligible.has(src) && eligible.has(tgt))
  })

  const retainedNodeIds = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
  return filterSubgraphsByRetainedNodeIds({ ...data, nodes, edges }, retainedNodeIds)
}
