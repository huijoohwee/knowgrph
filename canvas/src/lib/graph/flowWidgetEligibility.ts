import type { GraphNode } from '@/lib/graph/types'
import type { GraphData, GraphEdge } from '@/lib/graph/types'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'

const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId' as const
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const
const FLOW_WIDGET_NODE_TYPE_IDS = new Set<string>([
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
])

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export function isFlowWidgetEligibleNode(node: Pick<GraphNode, 'properties' | 'type'> | null | undefined): boolean {
  const nodeTypeId = typeof node?.type === 'string' ? node.type.trim() : ''
  if (nodeTypeId && FLOW_WIDGET_NODE_TYPE_IDS.has(nodeTypeId)) return true
  const props = node?.properties
  if (!isRecord(props)) return false
  const raw = props[FLOW_WIDGET_FORM_ID_KEY]
  const formId = typeof raw === 'string' ? raw.trim() : ''
  if (formId) return true
  const portTypes = props[FLOW_PORT_TYPES_KEY]
  if (isRecord(portTypes)) return true
  return false
}

export function buildFlowWidgetEligibleNodeIdSet(nodes: Array<Pick<GraphNode, 'id' | 'properties' | 'type'>>): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    if (!isFlowWidgetEligibleNode(node)) continue
    out.add(id)
  }
  return out
}

function readEndpointId(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
    const id = (v as Record<string, unknown>).id
    if (typeof id === 'string') return id.trim()
    if (typeof id === 'number') return Number.isFinite(id) ? String(id) : ''
  }
  return ''
}

function normalizeEndpointNodeId(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const dot = s.indexOf('.')
  return dot > 0 ? s.slice(0, dot).trim() : s
}

export function filterGraphToFlowWidgetEligible(data: GraphData): GraphData {
  const allNodes = Array.isArray(data.nodes) ? (data.nodes as GraphNode[]) : []
  const allEdges = Array.isArray(data.edges) ? (data.edges as GraphEdge[]) : []
  const eligible = buildFlowWidgetEligibleNodeIdSet(allNodes)
  if (eligible.size === 0) return { ...data, nodes: [], edges: [] }

  const nodes = allNodes.filter(n => eligible.has(String(n?.id || '').trim()))
  const edges = allEdges.filter(e => {
    const src = normalizeEndpointNodeId(readEndpointId((e as { source?: unknown }).source))
    const tgt = normalizeEndpointNodeId(readEndpointId((e as { target?: unknown }).target))
    return Boolean(src && tgt && eligible.has(src) && eligible.has(tgt))
  })

  return { ...data, nodes, edges }
}
