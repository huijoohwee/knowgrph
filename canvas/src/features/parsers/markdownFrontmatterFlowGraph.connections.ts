import type { GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { hashText } from '@/features/parsers/hash'
import { parseMarkdownBlocks } from '@/lib/markdown'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { FLOW_EDGE_DISPLAY_LABEL_KEY, FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'

const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const
const FRONTMATTER_REGISTRY_UPDATED_AT = '1970-01-01T00:00:00.000Z'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (!s) return null
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

function cleanIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
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

function buildEdgeUniqKey(args: { source: string; fromPort: string; target: string; toPort: string }): string {
  return `${args.source}|${args.fromPort}|${args.target}|${args.toPort}`
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

export type ParsedConnection = {
  id: string
  uniq: string
  source: string
  target: string
  fromPort: string
  toPort: string
  socketType: string
}

export type RegistryPort = {
  portKey: string
  direction: 'input' | 'output'
  schemaPath?: string
}

export type RegistryEntry = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  quickEditorTypeId: string
  formId: string
  fields: unknown[]
  ports: RegistryPort[]
  schemaMappings?: Array<{ fromPath: string; toPath: string; transformId?: string; reduceId?: string }>
  updatedAt: string
}

export function normalizeEdgesFromNodeInputs(nodes: ReadonlyArray<Record<string, unknown>>): GraphEdge[] {
  const out: GraphEdge[] = []
  const seen = new Set<string>()
  let n = 0

  const buildDisplayLabel = (fromPort: string, toPort: string, socketType: string): string => {
    const base = `${fromPort} → ${toPort}`
    const t = String(socketType || '').trim()
    return t ? `${base} · ${t}` : base
  }

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
          [FLOW_EDGE_DISPLAY_LABEL_KEY]: buildDisplayLabel(fromPort, toPort, socketType),
          ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
        },
      })
    }
  }

  return out
}

export function parseConnections(meta: Record<string, unknown>): { edges: GraphEdge[]; declared: ParsedConnection[] } {
  const raw = Array.isArray(meta.connections) ? meta.connections : []
  const edges: GraphEdge[] = []
  const declared: ParsedConnection[] = []
  const seen = new Set<string>()

  const buildDisplayLabel = (fromPort: string, toPort: string, socketType: string): string => {
    const base = `${fromPort} → ${toPort}`
    const t = String(socketType || '').trim()
    return t ? `${base} · ${t}` : base
  }

  for (let i = 0; i < raw.length; i += 1) {
    const rowRaw = raw[i]
    if (!isRecord(rowRaw)) continue
    const row = rowRaw as Record<string, unknown>
    const id = asString(row.id) || `e${i + 1}`
    const socketType = asString(row.type)
    const edgeLabel = asString(row.label)
    const animated = asBoolean(row.animated) === true
    const endpoints = extractConnectionEndpoints(row)
    if (!endpoints) continue
    const uniq = buildEdgeUniqKey({ source: endpoints.source, fromPort: endpoints.fromPort, target: endpoints.target, toPort: endpoints.toPort })
    if (seen.has(uniq)) continue
    seen.add(uniq)

    declared.push({ id, uniq, ...endpoints, socketType })

    const properties: Record<string, JSONValue> = {
      [FLOW_EDGE_SOURCE_PORT_KEY]: endpoints.fromPort,
      [FLOW_EDGE_TARGET_PORT_KEY]: endpoints.toPort,
      [FLOW_EDGE_DISPLAY_LABEL_KEY]: buildDisplayLabel(endpoints.fromPort, endpoints.toPort, socketType),
      ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
    }
    edges.push({
      id,
      source: endpoints.source,
      target: endpoints.target,
      label: edgeLabel,
      ...(socketType ? { type: socketType } : {}),
      properties,
    })
    if (edgeLabel) {
      ;(edges[edges.length - 1].properties as Record<string, JSONValue>)[FLOW_EDGE_DISPLAY_LABEL_KEY] = edgeLabel
    }
    if (animated) {
      ;(edges[edges.length - 1].properties as Record<string, JSONValue>)['flow:animated'] = true as unknown as JSONValue
    }
  }

  return { edges, declared }
}

export function collectNodeInputConnections(meta: Record<string, unknown>): Set<string> {
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

export function collectDeclaredPortTypes(meta: Record<string, unknown>): {
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

export function ensureAugmentedPortsFromDeclaredConnections(args: {
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

export function extractConnectionsAndSocketTypesFromMarkdownTables(args: {
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

export function buildConnectionWarnings(args: {
  meta: Record<string, unknown>
  socketTypes: Record<string, unknown> | null
  declared: ParsedConnection[]
}): string[] {
  const warnings: string[] = []
  if (args.declared.length === 0) return warnings
  const declaredPortTypes = collectDeclaredPortTypes(args.meta)
  const inputs = collectNodeInputConnections(args.meta)
  const declaredSet = new Set<string>()
  for (let i = 0; i < args.declared.length; i += 1) {
    const d = args.declared[i]
    declaredSet.add(d.uniq)
    if (!d.socketType) {
      warnings.push(`Untyped connection: ${d.source}.${d.fromPort} → ${d.target}.${d.toPort}`)
    } else if (args.socketTypes && !Object.prototype.hasOwnProperty.call(args.socketTypes, d.socketType)) {
      warnings.push(`Unknown socket type "${d.socketType}" on connection: ${d.source}.${d.fromPort} → ${d.target}.${d.toPort}`)
    } else {
      const outType = declaredPortTypes.outputTypeByNodeId[d.source]?.[d.fromPort] || ''
      const inType = declaredPortTypes.inputTypeByNodeId[d.target]?.[d.toPort] || ''
      if (!outType) warnings.push(`Connection source port missing type: ${d.source}.${d.fromPort}`)
      else if (outType !== d.socketType) warnings.push(`Connection type mismatch at source port: ${d.source}.${d.fromPort} expected ${outType} got ${d.socketType}`)
      if (!inType) warnings.push(`Connection target port missing type: ${d.target}.${d.toPort}`)
      else if (inType !== d.socketType) warnings.push(`Connection type mismatch at target port: ${d.target}.${d.toPort} expected ${inType} got ${d.socketType}`)
    }
  }
  for (const uniq of inputs) {
    if (!declaredSet.has(uniq)) warnings.push(`Missing connection for node input: ${uniq}`)
  }
  for (const uniq of declaredSet) {
    if (!inputs.has(uniq)) warnings.push(`Connection not mirrored in node inputs: ${uniq}`)
  }
  return warnings
}
