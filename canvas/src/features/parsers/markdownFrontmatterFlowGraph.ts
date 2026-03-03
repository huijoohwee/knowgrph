import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { splitMarkdownLines, parseMarkdownFrontmatter } from '@/lib/markdown'
import { hashText } from '@/features/parsers/hash'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'
import { FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { FLOW_EDGE_DISPLAY_LABEL_KEY, FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { KG_SUBGRAPHS_KEY } from '@/lib/graph/subgraphs'

type RegistryPort = { portKey: string; direction: 'input' | 'output'; schemaPath?: string }
type RegistryEntry = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  quickEditorTypeId: string
  formId: string
  fields: unknown[]
  ports: RegistryPort[]
  updatedAt: string
}

const FRONTMATTER_REGISTRY_UPDATED_AT = '1970-01-01T00:00:00.000Z'
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function cleanIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

function categoryLayerIndex(category: string): number | null {
  const key = String(category || '').trim().toLowerCase()
  if (!key) return null
  if (key === 'source') return 0
  if (key === 'timing') return 1
  if (key === 'audio') return 2
  if (key === 'visual') return 3
  if (key === 'overlay') return 4
  if (key === 'assembly') return 5
  if (key === 'publish') return 6
  if (key === 'output') return 7
  return null
}

function tierForCategory(category: string): number | null {
  const key = String(category || '').trim().toLowerCase()
  if (!key) return null
  if (key === 'source') return 0
  if (key === 'timing') return 1
  if (key === 'audio' || key === 'visual') return 1
  if (key === 'overlay') return 2
  if (key === 'assembly' || key === 'publish') return 3
  if (key === 'output') return 4
  return null
}

function buildDefaultSubgraphsFromNodes(rawNodes: ReadonlyArray<unknown>): Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null }> {
  const byCategory = new Map<string, string[]>()
  const byTier = new Map<number, string[]>()

  for (let i = 0; i < rawNodes.length; i += 1) {
    const row = rawNodes[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id) continue
    const category = asString(row.category)
    if (category) {
      const list = byCategory.get(category) || []
      list.push(id)
      byCategory.set(category, list)
    }
    const tier = tierForCategory(category)
    if (tier != null) {
      const list = byTier.get(tier) || []
      list.push(id)
      byTier.set(tier, list)
    }
  }

  const normalize = (ids: string[]): string[] => Array.from(new Set(ids)).filter(Boolean).sort((a, b) => a.localeCompare(b))

  const out: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null }> = []
  const tierIds = Array.from(byTier.keys()).sort((a, b) => a - b)
  for (let i = 0; i < tierIds.length; i += 1) {
    const t = tierIds[i]
    const ids = normalize(byTier.get(t) || [])
    if (ids.length === 0) continue
    out.push({ id: `tier-${t}`, label: `Tier ${t}`, memberNodeIds: ids, parentId: null })
  }

  const categoryKeys = Array.from(byCategory.keys()).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < categoryKeys.length; i += 1) {
    const cat = categoryKeys[i]
    const ids = normalize(byCategory.get(cat) || [])
    if (ids.length === 0) continue
    const parentTier = tierForCategory(cat)
    const parentId = parentTier != null ? `tier-${parentTier}` : null
    out.push({ id: `cat-${cleanIdPart(cat) || hashText(cat)}`, label: cat, memberNodeIds: ids, parentId })
  }

  return out
}

function normalizeSubgraphsFromFrontmatter(args: {
  meta: Record<string, unknown>
  rawNodes: ReadonlyArray<unknown>
}): Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }> | null {
  const raw = args.meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(raw)) return buildDefaultSubgraphsFromNodes(args.rawNodes)
  const nodeIdSet = new Set<string>()
  for (let i = 0; i < args.rawNodes.length; i += 1) {
    const row = args.rawNodes[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (id) nodeIdSet.add(id)
  }
  const out: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }> = []
  const seen = new Set<string>()
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const label = asString(row.label) || id
    const memberNodeIds = (() => {
      const ids = Array.isArray(row.memberNodeIds) ? row.memberNodeIds : []
      const set = new Set<string>()
      for (let j = 0; j < ids.length; j += 1) {
        const nid = asString(ids[j])
        if (!nid) continue
        if (!nodeIdSet.has(nid)) continue
        set.add(nid)
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b))
    })()
    const parentId = row.parentId == null ? null : asString(row.parentId) || null
    const kindRaw = asString(row.kind)
    const kind = kindRaw === 'cluster' ? 'cluster' : kindRaw === 'subgraph' ? 'subgraph' : undefined
    out.push({
      id,
      label,
      memberNodeIds,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(kind ? { kind } : {}),
    })
  }
  return out
}

function normalizeRegistryPorts(args: { inputs: unknown; outputs: unknown }): RegistryPort[] {
  const ports: RegistryPort[] = []
  const seen = new Set<string>()
  const add = (dir: 'input' | 'output', raw: unknown) => {
    if (!isRecord(raw)) return
    const portKey = asString(raw.port)
    if (!portKey) return
    const k = `${dir}:${portKey}`
    if (seen.has(k)) return
    seen.add(k)
    ports.push({ portKey, direction: dir })
  }
  const inputs = Array.isArray(args.inputs) ? args.inputs : []
  const outputs = Array.isArray(args.outputs) ? args.outputs : []
  for (let i = 0; i < inputs.length; i += 1) add('input', inputs[i])
  for (let i = 0; i < outputs.length; i += 1) add('output', outputs[i])
  return ports
}

function normalizeFlowPortTypes(args: { inputs: unknown; outputs: unknown }): JSONValue | null {
  const inByKey: Record<string, JSONValue> = {}
  const outByKey: Record<string, JSONValue> = {}
  const add = (dir: 'in' | 'out', raw: unknown) => {
    if (!isRecord(raw)) return
    const portKey = asString(raw.port)
    if (!portKey) return
    const type = asString(raw.type)
    if (!type) return
    if (dir === 'in') inByKey[portKey] = type
    else outByKey[portKey] = type
  }
  const inputs = Array.isArray(args.inputs) ? args.inputs : []
  const outputs = Array.isArray(args.outputs) ? args.outputs : []
  for (let i = 0; i < inputs.length; i += 1) add('in', inputs[i])
  for (let i = 0; i < outputs.length; i += 1) add('out', outputs[i])
  if (Object.keys(inByKey).length === 0 && Object.keys(outByKey).length === 0) return null
  return { in: inByKey, out: outByKey } as unknown as JSONValue
}

function normalizeVisualOverrides(raw: unknown): Record<string, JSONValue> {
  if (!isRecord(raw)) return {}
  const out: Record<string, JSONValue> = {}
  for (const k of Object.keys(raw)) {
    const key = String(k || '').trim()
    if (!key) continue
    const destKey = key.startsWith('visual:') ? key : `visual:${key}`
    const v = raw[key]
    const numLike = destKey === 'visual:opacity' || destKey === 'visual:zIndex' || destKey === 'visual:layer' || destKey === 'visual:depth' || destKey === 'visual:width' || destKey === 'visual:height' || destKey === 'visual:xIndex' || destKey === 'visual:yIndex'
    if (numLike) {
      const n = asFiniteNumber(v)
      if (n != null) {
        out[destKey] = destKey === 'visual:opacity' ? Math.max(0, Math.min(1, n)) : Math.floor(n)
        continue
      }
    }
    out[destKey] = v as JSONValue
  }
  return out
}

function normalizeNodes(meta: Record<string, unknown>): { nodes: GraphNode[]; registry: RegistryEntry[] } | null {
  const rawNodes = Array.isArray(meta.nodes) ? meta.nodes : null
  if (!rawNodes || rawNodes.length === 0) return null

  const nodes: GraphNode[] = []
  const registry: RegistryEntry[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < rawNodes.length; i += 1) {
    const row = rawNodes[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id) continue
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const type = asString(row.type) || 'Node'
    const label = asString(row.label) || id
    const pos = isRecord(row.pos) ? row.pos : null
    const x = pos ? asFiniteNumber(pos.x) : null
    const y = pos ? asFiniteNumber(pos.y) : null
    const category = asString(row.category)
    const layer = categoryLayerIndex(category)
    const ports = normalizeRegistryPorts({ inputs: row.inputs, outputs: row.outputs })
    const portTypes = normalizeFlowPortTypes({ inputs: row.inputs, outputs: row.outputs })

    const formId = `fm:${cleanIdPart(id) || hashText(id)}`

    const propsFromRow = isRecord(row.properties) ? (row.properties as Record<string, JSONValue>) : ({} as Record<string, JSONValue>)
    const visualOverrides = normalizeVisualOverrides(row.visual)
    const paramsFromRow = isRecord(row.params) ? (row.params as unknown as JSONValue) : null

    const properties: Record<string, JSONValue> = {
      ...propsFromRow,
      ...(category && propsFromRow.category == null ? ({ category } as unknown as Record<string, JSONValue>) : {}),
      ...(layer != null && propsFromRow['visual:layer'] == null ? ({ 'visual:layer': layer } as unknown as Record<string, JSONValue>) : {}),
      ...(category && propsFromRow['visual:community'] == null ? ({ 'visual:community': category } as unknown as Record<string, JSONValue>) : {}),
      ...(x != null && propsFromRow['visual:xIndex'] == null ? ({ 'visual:xIndex': Math.floor(x / 320) } as unknown as Record<string, JSONValue>) : {}),
      ...(y != null && propsFromRow['visual:yIndex'] == null ? ({ 'visual:yIndex': Math.floor(y / 220) } as unknown as Record<string, JSONValue>) : {}),
      ...visualOverrides,
      ...(portTypes != null && propsFromRow[FLOW_PORT_TYPES_KEY] == null ? ({ [FLOW_PORT_TYPES_KEY]: portTypes } as unknown as Record<string, JSONValue>) : {}),
      ...(paramsFromRow != null ? ({ params: paramsFromRow } as unknown as Record<string, JSONValue>) : {}),
      ...(row[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] == null
        ? ({ [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: formId } as unknown as Record<string, JSONValue>)
        : {}),
    }

    nodes.push({
      id,
      label,
      type,
      ...(x != null ? { x } : {}),
      ...(y != null ? { y } : {}),
      properties,
    })

    if (ports.length > 0) {
      registry.push({
        id: `qer-fm-${cleanIdPart(type) || 'node'}-${cleanIdPart(id) || hashText(id)}`,
        isEnabled: true,
        nodeTypeId: type,
        quickEditorTypeId: 'default',
        formId,
        fields: [],
        ports,
        updatedAt: FRONTMATTER_REGISTRY_UPDATED_AT,
      })
    }
  }

  if (nodes.length === 0) return null
  return { nodes, registry }
}

function normalizeEdgesFromConnections(meta: Record<string, unknown>): GraphEdge[] {
  const raw = Array.isArray(meta.connections) ? meta.connections : []
  const out: GraphEdge[] = []
  const seen = new Set<string>()

  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i]
    if (!isRecord(row)) continue
    const id = asString(row.id) || `e${i + 1}`
    const source = asString(row.from_node)
    const target = asString(row.to_node)
    const fromPort = asString(row.from_port)
    const toPort = asString(row.to_port)
    if (!source || !target || !fromPort || !toPort) continue

    const uniq = `${source}|${fromPort}|${target}|${toPort}`
    if (seen.has(uniq)) continue
    seen.add(uniq)

    const socketType = asString(row.type)
    const properties: Record<string, JSONValue> = {
      [FLOW_EDGE_SOURCE_PORT_KEY]: fromPort,
      [FLOW_EDGE_TARGET_PORT_KEY]: toPort,
      [FLOW_EDGE_DISPLAY_LABEL_KEY]: `${fromPort} → ${toPort}`,
      ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
    }

    out.push({
      id,
      source,
      target,
      label: '',
      ...(socketType ? { type: socketType } : {}),
      properties,
    })
  }

  return out
}

function normalizeEdgesFromNodeInputs(nodes: ReadonlyArray<Record<string, unknown>>): GraphEdge[] {
  const out: GraphEdge[] = []
  const seen = new Set<string>()
  let n = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isRecord(node)) continue
    const target = asString(node.id)
    if (!target) continue
    const inputs = Array.isArray(node.inputs) ? node.inputs : []
    for (let j = 0; j < inputs.length; j += 1) {
      const inp = inputs[j]
      if (!isRecord(inp)) continue
      const toPort = asString(inp.port)
      const from = asString(inp.from)
      if (!toPort || !from) continue
      const dot = from.lastIndexOf('.')
      const source = dot >= 0 ? from.slice(0, dot).trim() : ''
      const fromPort = dot >= 0 ? from.slice(dot + 1).trim() : ''
      if (!source || !fromPort) continue

      const uniq = `${source}|${fromPort}|${target}|${toPort}`
      if (seen.has(uniq)) continue
      seen.add(uniq)
      const id = `fm-e${String(++n).padStart(2, '0')}-${hashText(uniq)}`

      out.push({
        id,
        source,
        target,
        label: '',
        properties: {
          [FLOW_EDGE_SOURCE_PORT_KEY]: fromPort,
          [FLOW_EDGE_TARGET_PORT_KEY]: toPort,
          [FLOW_EDGE_DISPLAY_LABEL_KEY]: `${fromPort} → ${toPort}`,
        },
      })
    }
  }

  return out
}

export function tryParseMarkdownFrontmatterFlowGraph(
  name: string,
  text: string,
): { graphData: GraphData; warnings: string[] } | null {
  const raw = String(text || '')
  if (!raw.trimStart().startsWith('---')) return null

  const lines = splitMarkdownLines(raw)
  const { meta } = parseMarkdownFrontmatter(lines)
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null

  const normalized = normalizeNodes(meta)
  if (!normalized) return null

  const edgesFromConnections = normalizeEdgesFromConnections(meta)
  const rawNodes = Array.isArray((meta as Record<string, unknown>).nodes) ? ((meta as Record<string, unknown>).nodes as unknown[]) : []
  const edges = edgesFromConnections.length > 0 ? edgesFromConnections : normalizeEdgesFromNodeInputs(rawNodes as Record<string, unknown>[])
  const subgraphs = normalizeSubgraphsFromFrontmatter({ meta, rawNodes })

  const frontmatterMeta = isRecord(meta.meta) ? (meta.meta as Record<string, unknown>) : null
  const stableId = asString(frontmatterMeta?.id) || cleanIdPart(name) || 'frontmatter'
  const sourceLayerHash = hashText(`frontmatter-flow|${stableId}`)

  const metadata: Record<string, JSONValue> = {
    kind: 'frontmatter-flow',
    sourceLayerHash,
    ...(frontmatterMeta ? ({ frontmatterMeta: frontmatterMeta as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(isRecord(meta.socket_types) ? ({ socketTypes: meta.socket_types as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(normalized.registry.length > 0
      ? ({ [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: normalized.registry as unknown as JSONValue } as unknown as Record<string, JSONValue>)
      : {}),
    ...(subgraphs && subgraphs.length > 0 ? ({ [KG_SUBGRAPHS_KEY]: subgraphs as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
  }

  const graphData: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: normalized.nodes,
    edges,
    metadata,
  }

  return { graphData, warnings: [] }
}
