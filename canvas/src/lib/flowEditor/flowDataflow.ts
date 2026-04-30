import { getObjectPath } from '@/lib/data/objectPath'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
} from '@/lib/graph/flowPorts'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry, WidgetRegistryField, WidgetRegistryPort, WidgetRegistrySchemaMapping } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { applyFlowDataflowReducer, applyFlowDataflowTransform } from '@/lib/flowEditor/flowDataflowTransforms'
import { isFrontmatterFlowComputedEnabled } from '@/lib/graph/frontmatterFlowSettings'
import { readFlowComputeSource, runFlowComputeSource } from '@/lib/flowEditor/flowComputeInline'
import { buildTextWidgetOutputSrcDoc } from '@/lib/render/widgetOutputSrcDoc'
import { hashRecordSignature32 } from '@/lib/hash/signature'

export type FlowConnectedValueSource = {
  edgeId: string
  nodeId: string
  portKey: string
}

export type FlowConnectedValue = {
  value: unknown
  sources: ReadonlyArray<FlowConnectedValueSource>
}

export type FlowConnectedValuesBySchemaPath = Record<string, FlowConnectedValue>

const CONNECTED_VALUES_RESULT_CACHE_LIMIT = 64
const connectedValuesResultCache = new WeakMap<GraphData, Map<string, Map<string, Map<string, FlowConnectedValuesBySchemaPath>>>>()

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function registryCollectionKey(registry: ReadonlyArray<WidgetRegistryEntry>): string {
  if (!Array.isArray(registry) || registry.length === 0) return ''
  const parts: string[] = []
  for (let i = 0; i < registry.length; i += 1) {
    const entry = registry[i]
    if (!entry || entry.isEnabled !== true) continue
    const nodeTypeId = cleanString(entry.nodeTypeId)
    if (!nodeTypeId) continue
    const fields = Array.isArray(entry.fields) ? entry.fields as ReadonlyArray<WidgetRegistryField> : []
    const ports = Array.isArray(entry.ports) ? entry.ports as ReadonlyArray<WidgetRegistryPort> : []
    const mappings = Array.isArray(entry.schemaMappings) ? entry.schemaMappings as ReadonlyArray<WidgetRegistrySchemaMapping> : []
    const fieldsKey = fields.map(field => `${cleanString(field.fieldKey)}:${cleanString(field.schemaPath)}`).join(',')
    const portsKey = ports.map(port => `${cleanString(port.portKey)}:${cleanString(port.direction)}:${cleanString(port.schemaPath)}`).join(',')
    const mappingsKey = mappings.map(mapping => `${cleanString(mapping.fromPath)}>${cleanString(mapping.toPath)}`).join(',')
    parts.push([
      nodeTypeId,
      cleanString(entry.widgetTypeId),
      cleanString(entry.formId),
      fieldsKey,
      portsKey,
      mappingsKey,
    ].join('|'))
  }
  return parts.join('\n')
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function buildConnectedValuesTargetKey(targetNodeIds?: ReadonlySet<string>): string {
  if (!targetNodeIds || targetNodeIds.size === 0) return '*'
  return Array.from(targetNodeIds.values())
    .map(v => cleanString(v))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join('\n')
}

function readConnectedValuesResultCache(args: {
  graphData: GraphData
  registryKey: string
  targetKey: string
}): Map<string, FlowConnectedValuesBySchemaPath> | null {
  return connectedValuesResultCache.get(args.graphData)?.get(args.registryKey)?.get(args.targetKey) || null
}

function writeConnectedValuesResultCache(args: {
  graphData: GraphData
  registryKey: string
  targetKey: string
  result: Map<string, FlowConnectedValuesBySchemaPath>
}): void {
  let byRegistry = connectedValuesResultCache.get(args.graphData)
  if (!byRegistry) {
    byRegistry = new Map<string, Map<string, Map<string, FlowConnectedValuesBySchemaPath>>>()
    connectedValuesResultCache.set(args.graphData, byRegistry)
  }
  let byTarget = byRegistry.get(args.registryKey)
  if (!byTarget) {
    byTarget = new Map<string, Map<string, FlowConnectedValuesBySchemaPath>>()
    byRegistry.set(args.registryKey, byTarget)
  }
  if (!byTarget.has(args.targetKey) && byTarget.size >= CONNECTED_VALUES_RESULT_CACHE_LIMIT) {
    const oldestKey = byTarget.keys().next().value
    if (typeof oldestKey === 'string') byTarget.delete(oldestKey)
  }
  byTarget.set(args.targetKey, args.result)
}

function normalizeSchemaPath(schemaPath: string | undefined, fallbackKey: string): string {
  const raw = String(schemaPath || fallbackKey || '').trim()
  if (!raw) return ''
  if (raw.startsWith('properties') || raw.startsWith('metadata') || raw.startsWith('label') || raw.startsWith('type')) return raw
  return `properties.${raw}`
}

function readFlowEdgePortKey(edge: GraphEdge, key: string): string {
  const props = isRecord(edge?.properties) ? (edge.properties as Record<string, unknown>) : null
  return cleanString(props?.[key])
}

function nodeIndex(nodes: ReadonlyArray<GraphNode>): Map<string, GraphNode> {
  const out = new Map<string, GraphNode>()
  for (const n of nodes) {
    const id = cleanString(n?.id)
    if (!id) continue
    out.set(id, n)
  }
  return out
}

function resolveRegistryEntryByNodeId(args: {
  nodes: ReadonlyArray<GraphNode>
  registry: ReadonlyArray<WidgetRegistryEntry>
}): Map<string, WidgetRegistryEntry | null> {
  const out = new Map<string, WidgetRegistryEntry | null>()
  for (const n of args.nodes) {
    const id = cleanString(n?.id)
    if (!id) continue
    out.set(id, resolveWidgetRegistryEntry({ node: n, registry: args.registry }) || null)
  }
  return out
}

function buildPortSchemaPathIndex(entry: WidgetRegistryEntry | null): {
  input: Map<string, string>
  output: Map<string, string>
  schemaMappings: ReadonlyArray<{ fromPath: string; toPath: string; transformId?: string; reduceId?: string }>
} {
  const input = new Map<string, string>()
  const output = new Map<string, string>()
  const ports = Array.isArray(entry?.ports) ? entry.ports : []
  for (const p of ports) {
    const portKey = cleanString(p?.portKey)
    if (!portKey) continue
    const path = normalizeSchemaPath(p?.schemaPath, portKey)
    if (!path) continue
    if (p.direction === 'input') input.set(portKey, path)
    if (p.direction === 'output') output.set(portKey, path)
  }
  const schemaMappings = (entry && Array.isArray(entry.schemaMappings) ? entry.schemaMappings : [])
    .map(m => ({
      fromPath: cleanString(m?.fromPath),
      toPath: cleanString(m?.toPath),
      transformId: cleanString((m as unknown as { transformId?: unknown })?.transformId) || undefined,
      reduceId: cleanString((m as unknown as { reduceId?: unknown })?.reduceId) || undefined,
    }))
    .filter(m => m.fromPath && m.toPath)
  return { input, output, schemaMappings }
}

type EdgeConnection = {
  edgeId: string
  sourceId: string
  targetId: string
  sourcePortKey: string
  targetPortKey: string
}

function collectConnections(edges: ReadonlyArray<GraphEdge>): EdgeConnection[] {
  const out: EdgeConnection[] = []
  for (const e of edges) {
    const edgeId = cleanString((e as unknown as { id?: unknown })?.id)
    const sourceId = readEdgeEndpointId((e as unknown as { source?: unknown })?.source)
    const targetId = readEdgeEndpointId((e as unknown as { target?: unknown })?.target)
    if (!edgeId || !sourceId || !targetId) continue
    const sourcePortKey = readFlowEdgePortKey(e, FLOW_EDGE_SOURCE_PORT_KEY)
    const targetPortKey = readFlowEdgePortKey(e, FLOW_EDGE_TARGET_PORT_KEY)
    if (!sourcePortKey || !targetPortKey) continue
    out.push({ edgeId, sourceId, targetId, sourcePortKey, targetPortKey })
  }
  return out
}

function computeOutputPortValue(args: {
  nodeId: string
  node: GraphNode
  outputPortPaths: Map<string, string>
  computedByNodeId: Map<string, FlowConnectedValuesBySchemaPath>
  portKey: string
}): unknown {
  const path = args.outputPortPaths.get(args.portKey) || `properties.${args.portKey}`
  const computed = args.computedByNodeId.get(args.nodeId)?.[path]
  if (computed) return computed.value
  const direct = getObjectPath(args.node, path)
  if (typeof direct !== 'undefined') return direct
  if (path === 'properties.outputSrcDoc') {
    const output = getObjectPath(args.node, 'properties.output')
    if (typeof output === 'string' && output.trim()) {
      return buildTextWidgetOutputSrcDoc({
        title: args.node.label,
        text: output,
      })
    }
  }
  return direct
}

function buildConnectedValuesForNode(args: {
  node: GraphNode
  inbound: Map<string, Array<{ edgeId: string; sourceId: string; sourcePortKey: string; value: unknown }>>
  inputPortPaths: Map<string, string>
  outputPortPaths: Map<string, string>
  schemaMappings: ReadonlyArray<{ fromPath: string; toPath: string; transformId?: string; reduceId?: string }>
  computeEnabled: boolean
}): FlowConnectedValuesBySchemaPath {
  const byPath: FlowConnectedValuesBySchemaPath = {}
  const inByPortKey: Record<string, unknown> = {}

  for (const [targetPortKey, items] of Array.from(args.inbound.entries())) {
    if (!items || items.length === 0) continue
    const schemaPath = args.inputPortPaths.get(targetPortKey)
    if (schemaPath) {
      const sources = items.map(it => ({ edgeId: it.edgeId, nodeId: it.sourceId, portKey: it.sourcePortKey }))
      const value = items.length === 1 ? items[0].value : items.map(it => it.value)
      byPath[schemaPath] = { value, sources }
    }
    inByPortKey[targetPortKey] = items.length === 1 ? items[0].value : items.map(it => it.value)
  }

  if (args.schemaMappings.length > 0) {
    const context = {
      in: inByPortKey,
      node: {
        label: args.node.label,
        type: args.node.type,
        properties: args.node.properties || {},
        metadata: args.node.metadata || {},
      },
    }

    const allSources = Array.from(args.inbound.values())
      .flat()
      .map(it => ({ edgeId: it.edgeId, nodeId: it.sourceId, portKey: it.sourcePortKey }))

    for (const m of args.schemaMappings) {
      const raw = getObjectPath(context, m.fromPath)
      const reduced = m.reduceId && Array.isArray(raw) ? applyFlowDataflowReducer({ reduceId: m.reduceId, values: raw }) : raw
      const v = applyFlowDataflowTransform({ transformId: m.transformId, value: reduced })
      const toPath = normalizeSchemaPath(m.toPath, m.toPath)
      if (!toPath) continue
      if (typeof v === 'undefined') continue
      byPath[toPath] = { value: v, sources: allSources }
    }
  }

  const computeSource = args.computeEnabled ? readFlowComputeSource(args.node) : ''
  if (computeSource) {
    const computed = runFlowComputeSource(computeSource, inByPortKey)
    if (computed) {
      const allSources = Array.from(args.inbound.values())
        .flat()
        .map(it => ({ edgeId: it.edgeId, nodeId: it.sourceId, portKey: it.sourcePortKey }))
      for (const [portKeyRaw, value] of Object.entries(computed)) {
        const portKey = cleanString(portKeyRaw)
        if (!portKey) continue
        const toPath = args.outputPortPaths.get(portKey) || normalizeSchemaPath(`properties.data.${portKey}`, portKey)
        if (!toPath) continue
        if (typeof value === 'undefined') continue
        byPath[toPath] = { value, sources: allSources }
      }
    }
  }

  return byPath
}

export function computeFlowConnectedValuesBySchemaPath(args: {
  graphData: GraphData | null
  registry: ReadonlyArray<WidgetRegistryEntry>
  targetNodeIds?: ReadonlySet<string>
}): Map<string, FlowConnectedValuesBySchemaPath> {
  const graph = args.graphData
  if (!graph) return new Map()
  const registry = Array.isArray(args.registry) ? args.registry : []
  const registryKey = registryCollectionKey(registry)
  const targetKey = buildConnectedValuesTargetKey(args.targetNodeIds)
  const cached = readConnectedValuesResultCache({ graphData: graph, registryKey, targetKey })
  if (cached) return cached
  const computeEnabled = isFrontmatterFlowComputedEnabled(graph)
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []

  const byNodeId = nodeIndex(nodes)
  const registryByNodeId = resolveRegistryEntryByNodeId({ nodes, registry })

  const requestedTargets = args.targetNodeIds
  const allConnections = collectConnections(edges)
  const includedNodeIds = (() => {
    if (!requestedTargets || requestedTargets.size === 0) return new Set<string>(Array.from(byNodeId.keys()))
    const reverseAdj = new Map<string, string[]>()
    for (const c of allConnections) {
      if (!reverseAdj.has(c.targetId)) reverseAdj.set(c.targetId, [])
      reverseAdj.get(c.targetId)!.push(c.sourceId)
    }
    const out = new Set<string>()
    const queue: string[] = []
    for (const id of Array.from(requestedTargets.values())) {
      const s = cleanString(id)
      if (!s) continue
      queue.push(s)
    }
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (out.has(cur)) continue
      if (!byNodeId.has(cur)) continue
      out.add(cur)
      const parents = reverseAdj.get(cur) || []
      for (const p of parents) {
        const pid = cleanString(p)
        if (pid && !out.has(pid)) queue.push(pid)
      }
    }
    return out
  })()

  const portPathsByNodeId = new Map<
    string,
    {
      input: Map<string, string>
      output: Map<string, string>
      schemaMappings: ReadonlyArray<{ fromPath: string; toPath: string }>
    }
  >()
  for (const [nodeId, entry] of Array.from(registryByNodeId.entries())) {
    if (!includedNodeIds.has(nodeId)) continue
    portPathsByNodeId.set(nodeId, buildPortSchemaPathIndex(entry))
  }

  const includedNodes = Array.from(includedNodeIds.values())
    .map(id => byNodeId.get(id) || null)
    .filter((n): n is GraphNode => !!n)

  const computedByNodeId = new Map<string, FlowConnectedValuesBySchemaPath>()
  const maxIterations = Math.max(2, Math.min(12, includedNodes.length + 1))
  const connections = allConnections.filter(c => includedNodeIds.has(c.sourceId) && includedNodeIds.has(c.targetId))
  const objectValueKeyCache = new WeakMap<object, string>()

  const valueKey = (v: unknown): string => {
    if (typeof v === 'string') return `s:${v.length}:${v}`
    if (typeof v === 'number') return Number.isFinite(v) ? `n:${v}` : 'n:NaN'
    if (typeof v === 'boolean') return v ? 'b:1' : 'b:0'
    if (v == null) return 'null'
    if (Array.isArray(v)) return `a:${v.length}:${hashRecordSignature32({ value: v }, { maxEntries: 1, maxDepth: 3 })}`
    if (typeof v === 'object') {
      const key = objectValueKeyCache.get(v as object)
      if (key) return key
      const next = `o:${hashRecordSignature32(v, { maxEntries: 80, maxDepth: 3 })}`
      objectValueKeyCache.set(v as object, next)
      return next
    }
    return `u:${String(v)}`
  }

  const connectedKey = (m: FlowConnectedValuesBySchemaPath): string => {
    const keys = Object.keys(m).sort()
    const parts: string[] = []
    for (const k of keys) {
      const cv = m[k]
      if (!cv) continue
      const sources = Array.isArray(cv.sources) ? cv.sources : []
      const sourceParts: string[] = []
      for (let i = 0; i < sources.length; i += 1) {
        const source = sources[i]
        sourceParts.push(`${source.edgeId}|${source.nodeId}|${source.portKey}`)
      }
      const sourcesKey = sourceParts.join(',')
      parts.push(`${k}=${valueKey(cv.value)}@${sourcesKey}`)
    }
    return parts.join('\n')
  }

  let prevKeysByNodeId = new Map<string, string>()
  for (let iter = 0; iter < maxIterations; iter += 1) {
    const inboundByNodeId = new Map<
      string,
      Map<string, Array<{ edgeId: string; sourceId: string; sourcePortKey: string; value: unknown }>>
    >()

    for (const c of connections) {
      const sourceNode = byNodeId.get(c.sourceId)
      const targetNode = byNodeId.get(c.targetId)
      if (!sourceNode || !targetNode) continue
      const sourcePortPaths = portPathsByNodeId.get(c.sourceId)?.output || new Map()
      const value = computeOutputPortValue({
        nodeId: c.sourceId,
        node: sourceNode,
        outputPortPaths: sourcePortPaths,
        computedByNodeId,
        portKey: c.sourcePortKey,
      })

      if (!inboundByNodeId.has(c.targetId)) inboundByNodeId.set(c.targetId, new Map())
      const inbound = inboundByNodeId.get(c.targetId)!
      if (!inbound.has(c.targetPortKey)) inbound.set(c.targetPortKey, [])
      inbound.get(c.targetPortKey)!.push({ edgeId: c.edgeId, sourceId: c.sourceId, sourcePortKey: c.sourcePortKey, value })
    }

    const nextComputedByNodeId = new Map<string, FlowConnectedValuesBySchemaPath>()
    const nextKeysByNodeId = new Map<string, string>()

    for (const n of includedNodes) {
      const id = cleanString(n?.id)
      if (!id) continue
      const inbound = inboundByNodeId.get(id) || new Map()
      const portPaths = portPathsByNodeId.get(id)
      const connected = buildConnectedValuesForNode({
        node: n,
        inbound,
        inputPortPaths: portPaths?.input || new Map(),
        outputPortPaths: portPaths?.output || new Map(),
        schemaMappings: portPaths?.schemaMappings || [],
        computeEnabled,
      })
      nextComputedByNodeId.set(id, connected)
      nextKeysByNodeId.set(id, connectedKey(connected))
    }

    let changed = false
    for (const [id, key] of Array.from(nextKeysByNodeId.entries())) {
      if (prevKeysByNodeId.get(id) !== key) {
        changed = true
        break
      }
    }
    computedByNodeId.clear()
    for (const [id, m] of Array.from(nextComputedByNodeId.entries())) computedByNodeId.set(id, m)
    prevKeysByNodeId = nextKeysByNodeId
    if (!changed) break
  }

  const out = new Map<string, FlowConnectedValuesBySchemaPath>()
  for (const id of Array.from(includedNodeIds.values())) {
    if (requestedTargets && !requestedTargets.has(id)) continue
    out.set(id, computedByNodeId.get(id) || {})
  }
  writeConnectedValuesResultCache({ graphData: graph, registryKey, targetKey, result: out })
  return out
}
