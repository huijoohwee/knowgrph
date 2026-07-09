import { toMetadataRecord } from '@/lib/graph/documentMetadata'
import { STRUCTURAL_GRAPH_EDGE_LABELS } from '@/lib/graph/graphTopology'

type GraphFlowOrderNodeLike = {
  id?: unknown
  metadata?: unknown
  properties?: unknown
} | null | undefined

export type GraphFlowOrderDirection = 'backward' | 'forward' | 'same' | 'unknown'

export type GraphFlowOrderIndex = {
  index: number
  source: 'metadata' | 'node-order' | 'source'
}

const FLOW_ORDER_KEYS = [
  'flow:orderIndex',
  'flow:order',
  'visual:flowIndex',
  'visual:orderIndex',
  'visual:order',
] as const

const SOURCE_FLOW_ORDER_KEYS = [
  'lineStart',
  'sourceLineStart',
  'sourceLine',
  'line',
  'corpus:lineStart',
  'evidence:lineStart',
] as const

const AXIS_FLOW_ORDER_KEYS = {
  LR: ['visual:xIndex', 'visual:yIndex'],
  TB: ['visual:yIndex', 'visual:xIndex'],
} as const

function readFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

function readNodeId(node: GraphFlowOrderNodeLike): string {
  return String(node?.id || '').trim()
}

function readNodeProps(node: GraphFlowOrderNodeLike): Record<string, unknown> {
  const props = node?.properties
  return props && typeof props === 'object' && !Array.isArray(props) ? props as Record<string, unknown> : {}
}

function readSourceOrderIndex(record: Record<string, unknown>): number | null {
  for (let i = 0; i < SOURCE_FLOW_ORDER_KEYS.length; i += 1) {
    const index = readFiniteNumber(record[SOURCE_FLOW_ORDER_KEYS[i]])
    if (index != null) return index
  }
  return null
}

function readMarkdownBlockSourceOrderIndexFromId(rawId: unknown): number | null {
  const id = String(rawId || '').trim()
  if (!id.startsWith('blk:md:')) return null
  const parts = id.split(':').map(part => part.trim()).filter(Boolean)
  if (parts.length < 5) return null
  const ordinal = readFiniteNumber(parts[parts.length - 1])
  const lineStart = readFiniteNumber(parts[parts.length - 2])
  return lineStart == null ? null : lineStart + (ordinal == null ? 0 : ordinal / 1000000)
}

function buildOrderKeys(args: {
  extraOrderKeys?: readonly string[] | null
  rankdir?: 'LR' | 'TB' | null
}): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (key: unknown) => {
    const value = String(key || '').trim()
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
  }
  for (let i = 0; i < (args.extraOrderKeys || []).length; i += 1) push(args.extraOrderKeys?.[i])
  for (let i = 0; i < FLOW_ORDER_KEYS.length; i += 1) push(FLOW_ORDER_KEYS[i])
  const axisKeys = args.rankdir === 'TB' ? AXIS_FLOW_ORDER_KEYS.TB : AXIS_FLOW_ORDER_KEYS.LR
  for (let i = 0; i < axisKeys.length; i += 1) push(axisKeys[i])
  return out
}

export function readGraphNodeFlowOrderIndex(args: {
  fallbackIndex?: number | null
  extraOrderKeys?: readonly string[] | null
  node: GraphFlowOrderNodeLike
  rankdir?: 'LR' | 'TB' | null
}): GraphFlowOrderIndex | null {
  const props = readNodeProps(args.node)
  const keys = buildOrderKeys(args)
  for (let i = 0; i < keys.length; i += 1) {
    const index = readFiniteNumber(props[keys[i]])
    if (index != null) return { index, source: 'metadata' }
  }
  const metadataSourceIndex = readSourceOrderIndex(toMetadataRecord(args.node?.metadata))
  if (metadataSourceIndex != null) return { index: metadataSourceIndex, source: 'source' }
  const propertySourceIndex = readSourceOrderIndex(props)
  if (propertySourceIndex != null) return { index: propertySourceIndex, source: 'source' }
  const idSourceIndex = readMarkdownBlockSourceOrderIndexFromId(args.node?.id)
  if (idSourceIndex != null) return { index: idSourceIndex, source: 'source' }
  const fallbackIndex = readFiniteNumber(args.fallbackIndex)
  return fallbackIndex == null ? null : { index: fallbackIndex, source: 'node-order' }
}

export function buildGraphFlowOrderIndexByNodeId(
  nodes: readonly GraphFlowOrderNodeLike[],
  args: {
    extraOrderKeys?: readonly string[] | null
    rankdir?: 'LR' | 'TB' | null
  } = {},
): Map<string, GraphFlowOrderIndex> {
  const out = new Map<string, GraphFlowOrderIndex>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = readNodeId(node)
    if (!id) continue
    const order = readGraphNodeFlowOrderIndex({ node, fallbackIndex: i, rankdir: args.rankdir, extraOrderKeys: args.extraOrderKeys })
    if (order) out.set(id, order)
  }
  return out
}

export function resolveGraphEdgeFlowOrderDirection(args: {
  edgeLabel?: unknown
  orderByNodeId: ReadonlyMap<string, GraphFlowOrderIndex> | null | undefined
  sourceId: string
  targetId: string
}): GraphFlowOrderDirection {
  const sourceId = String(args.sourceId || '').trim()
  const targetId = String(args.targetId || '').trim()
  if (!sourceId || !targetId || sourceId === targetId) return sourceId && targetId && sourceId === targetId ? 'same' : 'unknown'
  const sourceOrder = args.orderByNodeId?.get(sourceId) || null
  const targetOrder = args.orderByNodeId?.get(targetId) || null
  if (!sourceOrder || !targetOrder) return 'unknown'
  const edgeLabel = String(args.edgeLabel || '').trim()
  if (
    edgeLabel
    && STRUCTURAL_GRAPH_EDGE_LABELS.has(edgeLabel)
    && sourceOrder.source === 'source'
    && targetOrder.source === 'source'
    && Math.floor(targetOrder.index) >= Math.floor(sourceOrder.index)
  ) {
    return 'forward'
  }
  const delta = targetOrder.index - sourceOrder.index
  if (Math.abs(delta) <= 1e-6) return 'same'
  return delta > 0 ? 'forward' : 'backward'
}
