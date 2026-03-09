import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { splitMarkdownLines, parseMarkdownFrontmatter, parseMarkdownBlocks } from '@/lib/markdown'
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
    const x = pos ? asFiniteNumber(pos.x) : asFiniteNumber((row as Record<string, unknown>).pos_x)
    const y = pos ? asFiniteNumber(pos.y) : asFiniteNumber((row as Record<string, unknown>).pos_y)
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
      ...(category && propsFromRow['visual:layer'] == null ? ({ 'visual:layer': category } as unknown as Record<string, JSONValue>) : {}),
      ...(layer != null && propsFromRow['visual:depth'] == null ? ({ 'visual:depth': layer } as unknown as Record<string, JSONValue>) : {}),
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
  return parseConnections(meta).edges
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
      const socketType = asString(inp.type)

      out.push({
        id,
        source,
        target,
        label: '',
        ...(socketType ? { type: socketType } : {}),
        properties: {
          [FLOW_EDGE_SOURCE_PORT_KEY]: fromPort,
          [FLOW_EDGE_TARGET_PORT_KEY]: toPort,
          [FLOW_EDGE_DISPLAY_LABEL_KEY]: `${fromPort} → ${toPort}`,
          ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
        },
      })
    }
  }

  return out
}

function buildEdgeUniqKey(args: { source: string; fromPort: string; target: string; toPort: string }): string {
  return `${args.source}|${args.fromPort}|${args.target}|${args.toPort}`
}

type ParsedConnection = {
  id: string
  uniq: string
  source: string
  target: string
  fromPort: string
  toPort: string
  socketType: string
}

function parseDotEndpoint(raw: unknown): { nodeId: string; portKey: string } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const dot = s.lastIndexOf('.')
  if (dot < 0) return null
  const nodeId = s.slice(0, dot).trim()
  const portKey = s.slice(dot + 1).trim()
  if (!nodeId || !portKey) return null
  return { nodeId, portKey }
}

function extractConnectionEndpoints(row: Record<string, unknown>): { source: string; target: string; fromPort: string; toPort: string } | null {
  const source = asString(row.from_node)
  const target = asString(row.to_node)
  const fromPort = asString(row.from_port)
  const toPort = asString(row.to_port)
  if (source && target && fromPort && toPort) return { source, target, fromPort, toPort }
  const from = asString(row.from)
  const to = asString(row.to)
  const pFrom = parseDotEndpoint(from)
  const pTo = parseDotEndpoint(to)
  if (!pFrom || !pTo) return null
  return { source: pFrom.nodeId, target: pTo.nodeId, fromPort: pFrom.portKey, toPort: pTo.portKey }
}

function parseConnections(meta: Record<string, unknown>): { edges: GraphEdge[]; declared: ParsedConnection[] } {
  const raw = Array.isArray(meta.connections) ? meta.connections : []
  const edges: GraphEdge[] = []
  const declared: ParsedConnection[] = []
  const seen = new Set<string>()

  for (let i = 0; i < raw.length; i += 1) {
    const rowRaw = raw[i]
    if (!isRecord(rowRaw)) continue
    const row = rowRaw as Record<string, unknown>
    const id = asString(row.id) || `e${i + 1}`
    const socketType = asString(row.type)
    const endpoints = extractConnectionEndpoints(row)
    if (!endpoints) continue
    const uniq = buildEdgeUniqKey({ source: endpoints.source, fromPort: endpoints.fromPort, target: endpoints.target, toPort: endpoints.toPort })
    if (seen.has(uniq)) continue
    seen.add(uniq)

    declared.push({ id, uniq, ...endpoints, socketType })

    const properties: Record<string, JSONValue> = {
      [FLOW_EDGE_SOURCE_PORT_KEY]: endpoints.fromPort,
      [FLOW_EDGE_TARGET_PORT_KEY]: endpoints.toPort,
      [FLOW_EDGE_DISPLAY_LABEL_KEY]: `${endpoints.fromPort} → ${endpoints.toPort}`,
      ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
    }
    edges.push({
      id,
      source: endpoints.source,
      target: endpoints.target,
      label: '',
      ...(socketType ? { type: socketType } : {}),
      properties,
    })
  }

  return { edges, declared }
}

function collectNodeInputConnections(meta: Record<string, unknown>): Set<string> {
  const rawNodes = Array.isArray(meta.nodes) ? (meta.nodes as unknown[]) : []
  const set = new Set<string>()
  for (let i = 0; i < rawNodes.length; i += 1) {
    const node = rawNodes[i]
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
      set.add(buildEdgeUniqKey({ source, fromPort, target, toPort }))
    }
  }
  return set
}

function collectDeclaredPortTypes(meta: Record<string, unknown>): {
  inputTypeByNodeId: Record<string, Record<string, string>>
  outputTypeByNodeId: Record<string, Record<string, string>>
} {
  const rawNodes = Array.isArray(meta.nodes) ? (meta.nodes as unknown[]) : []
  const inputTypeByNodeId: Record<string, Record<string, string>> = {}
  const outputTypeByNodeId: Record<string, Record<string, string>> = {}
  for (let i = 0; i < rawNodes.length; i += 1) {
    const node = rawNodes[i]
    if (!isRecord(node)) continue
    const nodeId = asString(node.id)
    if (!nodeId) continue
    const inputs = Array.isArray(node.inputs) ? node.inputs : []
    for (let j = 0; j < inputs.length; j += 1) {
      const inp = inputs[j]
      if (!isRecord(inp)) continue
      const port = asString(inp.port)
      const type = asString(inp.type)
      if (!port || !type) continue
      const byPort = inputTypeByNodeId[nodeId] || {}
      if (!Object.prototype.hasOwnProperty.call(byPort, port)) {
        byPort[port] = type
        inputTypeByNodeId[nodeId] = byPort
      }
    }
    const outputs = Array.isArray(node.outputs) ? node.outputs : []
    for (let j = 0; j < outputs.length; j += 1) {
      const out = outputs[j]
      if (!isRecord(out)) continue
      const port = asString(out.port)
      const type = asString(out.type)
      if (!port || !type) continue
      const byPort = outputTypeByNodeId[nodeId] || {}
      if (!Object.prototype.hasOwnProperty.call(byPort, port)) {
        byPort[port] = type
        outputTypeByNodeId[nodeId] = byPort
      }
    }
  }
  return { inputTypeByNodeId, outputTypeByNodeId }
}

function coercePortTypesFromNode(node: GraphNode): { in: Record<string, string>; out: Record<string, string> } {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = props[FLOW_PORT_TYPES_KEY]
  if (!isRecord(raw)) return { in: {}, out: {} }
  const rec = raw as Record<string, unknown>
  const inRec = isRecord(rec.in) ? (rec.in as Record<string, unknown>) : {}
  const outRec = isRecord(rec.out) ? (rec.out as Record<string, unknown>) : {}
  const outIn: Record<string, string> = {}
  const outOut: Record<string, string> = {}
  for (const [k, v] of Object.entries(inRec)) {
    const key = String(k || '').trim()
    const val = typeof v === 'string' ? v.trim() : ''
    if (key && val) outIn[key] = val
  }
  for (const [k, v] of Object.entries(outRec)) {
    const key = String(k || '').trim()
    const val = typeof v === 'string' ? v.trim() : ''
    if (key && val) outOut[key] = val
  }
  return { in: outIn, out: outOut }
}

function ensureAugmentedPortsFromDeclaredConnections(args: {
  nodes: GraphNode[]
  registry: RegistryEntry[]
  declared: ParsedConnection[]
}): void {
  if (args.declared.length === 0) return
  const nodeById = new Map<string, GraphNode>()
  const formIdByNodeId = new Map<string, string>()
  const nodeTypeByNodeId = new Map<string, string>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const n = args.nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    nodeById.set(id, n)
    nodeTypeByNodeId.set(id, String(n.type || 'Node') || 'Node')
    const props = (n.properties || {}) as Record<string, unknown>
    const formId = typeof props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] === 'string' ? String(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] || '').trim() : ''
    if (formId) formIdByNodeId.set(id, formId)
  }

  const registryByFormId = new Map<string, RegistryEntry>()
  for (let i = 0; i < args.registry.length; i += 1) {
    const entry = args.registry[i]
    const formId = String(entry.formId || '').trim()
    if (!formId) continue
    registryByFormId.set(formId, entry)
  }

  const ensureRegistryEntryForNode = (nodeId: string): RegistryEntry | null => {
    const node = nodeById.get(nodeId)
    if (!node) return null
    const formId = formIdByNodeId.get(nodeId) || ''
    if (!formId) return null
    const existing = registryByFormId.get(formId)
    if (existing) return existing
    const type = nodeTypeByNodeId.get(nodeId) || 'Node'
    const created: RegistryEntry = {
      id: `qer-fm-${cleanIdPart(type) || 'node'}-${cleanIdPart(nodeId) || hashText(nodeId)}`,
      isEnabled: true,
      nodeTypeId: type,
      quickEditorTypeId: 'default',
      formId,
      fields: [],
      ports: [],
      updatedAt: FRONTMATTER_REGISTRY_UPDATED_AT,
    }
    args.registry.push(created)
    registryByFormId.set(formId, created)
    return created
  }

  const ensureRegistryPort = (entry: RegistryEntry, direction: 'input' | 'output', portKey: string) => {
    const key = String(portKey || '').trim()
    if (!key) return
    const ports = Array.isArray(entry.ports) ? entry.ports : []
    for (let i = 0; i < ports.length; i += 1) {
      const p = ports[i]
      if (!p) continue
      if (p.direction === direction && p.portKey === key) return
    }
    entry.ports = [...ports, { portKey: key, direction }]
  }

  const ensureNodePortType = (nodeId: string, dir: 'input' | 'output', portKey: string, socketType: string) => {
    const node = nodeById.get(nodeId)
    if (!node) return
    const type = String(socketType || '').trim()
    if (!type) return
    const key = String(portKey || '').trim()
    if (!key) return
    const existing = coercePortTypesFromNode(node)
    const cur = dir === 'input' ? existing.in[key] : existing.out[key]
    if (cur === type) return
    const nextIn = dir === 'input' ? { ...existing.in, [key]: type } : existing.in
    const nextOut = dir === 'output' ? { ...existing.out, [key]: type } : existing.out
    node.properties = {
      ...((node.properties || {}) as Record<string, JSONValue>),
      [FLOW_PORT_TYPES_KEY]: { in: nextIn, out: nextOut } as unknown as JSONValue,
    }
  }

  for (let i = 0; i < args.declared.length; i += 1) {
    const d = args.declared[i]
    const socketType = String(d.socketType || '').trim()
    if (!socketType) continue
    const srcEntry = ensureRegistryEntryForNode(d.source)
    if (srcEntry) ensureRegistryPort(srcEntry, 'output', d.fromPort)
    ensureNodePortType(d.source, 'output', d.fromPort, socketType)

    const tgtEntry = ensureRegistryEntryForNode(d.target)
    if (tgtEntry) ensureRegistryPort(tgtEntry, 'input', d.toPort)
    ensureNodePortType(d.target, 'input', d.toPort, socketType)
  }
}

function normalizeHeaderKey(v: unknown): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function stripAllBackticks(v: unknown): string {
  return String(v || '').replace(/`+/g, '').trim()
}

function parseHexColor(v: unknown): string {
  const s = String(v || '')
  const m = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})/.exec(s)
  if (!m) return ''
  const hex = String(m[0] || '').trim()
  if (!hex.startsWith('#')) return ''
  return hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex
}

function extractConnectionsAndSocketTypesFromMarkdownTables(args: {
  lines: string[]
  startIndex: number
  existingConnections?: unknown
  existingSocketTypes?: unknown
}): { connections: Array<Record<string, unknown>>; socketTypes: Record<string, unknown> | null } {
  const hasConnections = Array.isArray(args.existingConnections) && args.existingConnections.length > 0
  const hasSocketTypes = isRecord(args.existingSocketTypes) && Object.keys(args.existingSocketTypes).length > 0
  if (hasConnections && hasSocketTypes) return { connections: [], socketTypes: null }

  const blocks = parseMarkdownBlocks(args.lines, args.startIndex)
  const connections: Array<Record<string, unknown>> = []
  const seenConn = new Set<string>()
  const socketTypes: Record<string, unknown> = {}

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]
    if (!b || b.kind !== 'table') continue
    const header = Array.isArray(b.tableHeader) ? b.tableHeader : null
    const rows = Array.isArray(b.tableRows) ? b.tableRows : null
    if (!header || !rows) continue

    const headerKeys = header.map(normalizeHeaderKey)
    const idx = (k: string): number => headerKeys.indexOf(k)

    if (!hasConnections) {
      const edgeIdx = idx('edge')
      const fromPortIdx = idx('fromport')
      const toPortIdx = idx('toport')
      const typeIdx = idx('type')
      const isEdgeTable = edgeIdx >= 0 && fromPortIdx >= 0 && toPortIdx >= 0 && typeIdx >= 0
      if (isEdgeTable) {
        for (let r = 0; r < rows.length; r += 1) {
          const row = rows[r] || []
          const id = stripAllBackticks(row[edgeIdx])
          const from = stripAllBackticks(row[fromPortIdx])
          const to = stripAllBackticks(row[toPortIdx])
          const socketType = stripAllBackticks(row[typeIdx])
          if (!id || !from || !to) continue
          const uniq = `${from}→${to}`
          if (seenConn.has(uniq)) continue
          seenConn.add(uniq)
          connections.push({ id, from, to, ...(socketType ? { type: socketType } : {}) })
        }
        continue
      }
    }

    if (!hasSocketTypes) {
      const typeIdx = idx('type')
      const colorIdx = (() => {
        const c1 = idx('colour')
        if (c1 >= 0) return c1
        return idx('color')
      })()
      const isSocketLegend = typeIdx >= 0 && colorIdx >= 0
      if (isSocketLegend) {
        for (let r = 0; r < rows.length; r += 1) {
          const row = rows[r] || []
          const typeId = stripAllBackticks(row[typeIdx])
          const color = parseHexColor(row[colorIdx])
          if (!typeId || !color) continue
          if (!Object.prototype.hasOwnProperty.call(socketTypes, typeId)) {
            socketTypes[typeId] = { color, accepts: [typeId] }
          }
        }
      }
    }
  }

  return { connections, socketTypes: Object.keys(socketTypes).length > 0 ? socketTypes : null }
}

function mergeFrontmatterMeta(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const k of Object.keys(b)) {
    const av = out[k]
    const bv = b[k]
    if (Array.isArray(av) && Array.isArray(bv)) {
      out[k] = [...av, ...bv]
      continue
    }
    if (isRecord(av) && isRecord(bv)) {
      out[k] = mergeFrontmatterMeta(av, bv)
      continue
    }
    out[k] = bv
  }
  return out
}

function tryParseMergedFrontmatterMetaWithNodes(lines: string[]): { meta: Record<string, unknown>; startIndex: number } | null {
  const dashIdx: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') dashIdx.push(i)
    if (dashIdx.length >= 10) break
  }
  if (dashIdx.length < 4) return null

  let merged: Record<string, unknown> = {}
  for (let seg = 0; seg < dashIdx.length - 1; seg += 1) {
    const a = dashIdx[seg] ?? -1
    const b = dashIdx[seg + 1] ?? -1
    if (a < 0 || b < 0) continue
    if (b <= a + 1) continue
    const segmentLines = ['---', ...lines.slice(a + 1, b), '---']
    const parsed = parseMarkdownFrontmatter(segmentLines).meta
    if (!isRecord(parsed)) continue
    merged = mergeFrontmatterMeta(merged, parsed)
    if (Array.isArray(merged.nodes) && merged.nodes.length > 0) {
      return { meta: merged, startIndex: b + 1 }
    }
  }
  return null
}

export function tryParseMarkdownFrontmatterFlowGraph(
  name: string,
  text: string,
): { graphData: GraphData; warnings: string[] } | null {
  const raw = String(text || '').replace(/^\uFEFF/, '')
  if (!raw.trimStart().startsWith('---')) return null

  const lines = splitMarkdownLines(raw)
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return null

  const initialSegment = lead > 0 ? lines.slice(lead) : lines
  const initial = parseMarkdownFrontmatter(initialSegment)
  const initialMeta = initial.meta
  if (!initialMeta || typeof initialMeta !== 'object' || Array.isArray(initialMeta)) return null
  let meta: Record<string, unknown> = initialMeta as Record<string, unknown>
  let startIndex = initial.startIndex + lead
  const initialNormalized = normalizeNodes(meta)
  if (!initialNormalized) {
    const merged = tryParseMergedFrontmatterMetaWithNodes(lines)
    if (merged) {
      meta = merged.meta
      startIndex = merged.startIndex
    }
  }

  const metaRecord = meta as Record<string, unknown>
  const extracted = extractConnectionsAndSocketTypesFromMarkdownTables({
    lines,
    startIndex,
    existingConnections: metaRecord.connections,
    existingSocketTypes: metaRecord.socket_types,
  })
  if ((!Array.isArray(metaRecord.connections) || metaRecord.connections.length === 0) && extracted.connections.length > 0) {
    metaRecord.connections = extracted.connections
  }
  if ((!isRecord(metaRecord.socket_types) || Object.keys(metaRecord.socket_types).length === 0) && extracted.socketTypes) {
    metaRecord.socket_types = extracted.socketTypes
  }

  const normalized = normalizeNodes(meta)
  if (!normalized) return null

  const connParsed = parseConnections(meta)
  ensureAugmentedPortsFromDeclaredConnections({ nodes: normalized.nodes, registry: normalized.registry, declared: connParsed.declared })
  const edgesFromConnections = connParsed.edges
  const rawNodes = Array.isArray((meta as Record<string, unknown>).nodes) ? ((meta as Record<string, unknown>).nodes as unknown[]) : []
  const edges = edgesFromConnections.length > 0 ? edgesFromConnections : normalizeEdgesFromNodeInputs(rawNodes as Record<string, unknown>[])
  const subgraphs = normalizeSubgraphsFromFrontmatter({ meta, rawNodes })

  const frontmatterMeta = isRecord(meta.meta) ? (meta.meta as Record<string, unknown>) : null
  const stableId = asString(frontmatterMeta?.id) || cleanIdPart(name) || 'frontmatter'
  const sourceLayerHash = hashText(`frontmatter-flow|${stableId}`)

  const warnings: string[] = []
  const socketTypes = isRecord(meta.socket_types) ? (meta.socket_types as Record<string, unknown>) : null

  const declared = connParsed.declared
  if (declared.length > 0) {
    const declaredPortTypes = collectDeclaredPortTypes(meta)
    const inputs = collectNodeInputConnections(meta)
    const declaredSet = new Set<string>()
    for (let i = 0; i < declared.length; i += 1) {
      const d = declared[i]
      declaredSet.add(d.uniq)
      if (!d.socketType) {
        warnings.push(`Untyped connection: ${d.source}.${d.fromPort} → ${d.target}.${d.toPort}`)
      } else if (socketTypes && !Object.prototype.hasOwnProperty.call(socketTypes, d.socketType)) {
        warnings.push(`Unknown socket type "${d.socketType}" on connection: ${d.source}.${d.fromPort} → ${d.target}.${d.toPort}`)
      } else {
        const outType = declaredPortTypes.outputTypeByNodeId[d.source]?.[d.fromPort] || ''
        const inType = declaredPortTypes.inputTypeByNodeId[d.target]?.[d.toPort] || ''
        if (!outType) {
          warnings.push(`Connection source port missing type: ${d.source}.${d.fromPort}`)
        } else if (outType !== d.socketType) {
          warnings.push(`Connection type mismatch at source port: ${d.source}.${d.fromPort} expected ${outType} got ${d.socketType}`)
        }
        if (!inType) {
          warnings.push(`Connection target port missing type: ${d.target}.${d.toPort}`)
        } else if (inType !== d.socketType) {
          warnings.push(`Connection type mismatch at target port: ${d.target}.${d.toPort} expected ${inType} got ${d.socketType}`)
        }
      }
    }
    for (const uniq of inputs) {
      if (!declaredSet.has(uniq)) warnings.push(`Missing connection for node input: ${uniq}`)
    }
    for (const uniq of declaredSet) {
      if (!inputs.has(uniq)) warnings.push(`Connection not mirrored in node inputs: ${uniq}`)
    }
  }

  const rawNodesForPos = Array.isArray(meta.nodes) ? (meta.nodes as unknown[]) : []
  for (let i = 0; i < rawNodesForPos.length; i += 1) {
    const row = rawNodesForPos[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id) continue
    const pos = isRecord(row.pos) ? row.pos : null
    const x = pos ? asFiniteNumber(pos.x) : asFiniteNumber((row as Record<string, unknown>).pos_x)
    const y = pos ? asFiniteNumber(pos.y) : asFiniteNumber((row as Record<string, unknown>).pos_y)
    if (x == null || y == null) warnings.push(`Node missing pos: ${id}`)
  }

  const metadata: Record<string, JSONValue> = {
    kind: 'frontmatter-flow',
    sourceLayerHash,
    ...(frontmatterMeta ? ({ frontmatterMeta: frontmatterMeta as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(socketTypes ? ({ socketTypes: meta.socket_types as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
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

  warnings.sort((a, b) => a.localeCompare(b))
  return { graphData, warnings }
}
