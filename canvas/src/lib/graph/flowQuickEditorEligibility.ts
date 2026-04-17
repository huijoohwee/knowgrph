import type { GraphNode } from '@/lib/graph/types'
import type { GraphData, GraphEdge } from '@/lib/graph/types'

const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY = 'flow:quickEditorFormId' as const
const FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY_LEGACY = 'flow:nodeQuickEditorFormId' as const
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export function isFlowQuickEditorEligibleNode(node: Pick<GraphNode, 'properties'> | null | undefined): boolean {
  const props = node?.properties
  if (!isRecord(props)) return false
  const raw = props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]
  const rawLegacy = props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY_LEGACY]
  const formId = typeof raw === 'string' ? raw.trim() : typeof rawLegacy === 'string' ? rawLegacy.trim() : ''
  if (formId && formId.startsWith('fm:')) return true
  const portTypes = props[FLOW_PORT_TYPES_KEY]
  if (isRecord(portTypes)) return true
  return false
}

export function buildFlowQuickEditorEligibleNodeIdSet(nodes: Array<Pick<GraphNode, 'id' | 'properties'>>): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (!id) continue
    if (!isFlowQuickEditorEligibleNode(node)) continue
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

export function filterGraphToFlowQuickEditorEligible(data: GraphData): GraphData {
  const allNodes = Array.isArray(data.nodes) ? (data.nodes as GraphNode[]) : []
  const allEdges = Array.isArray(data.edges) ? (data.edges as GraphEdge[]) : []
  const eligible = buildFlowQuickEditorEligibleNodeIdSet(allNodes)
  if (eligible.size === 0) return { ...data, nodes: [], edges: [] }

  const nodes = allNodes.filter(n => eligible.has(String(n?.id || '').trim()))
  const edges = allEdges.filter(e => {
    const src = readEndpointId((e as { source?: unknown }).source)
    const tgt = readEndpointId((e as { target?: unknown }).target)
    return Boolean(src && tgt && eligible.has(src) && eligible.has(tgt))
  })

  return { ...data, nodes, edges }
}
