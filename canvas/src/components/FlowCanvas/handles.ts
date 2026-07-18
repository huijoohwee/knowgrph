import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  buildSchemaFieldPortKey,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config.storyboard-widget'
import { resolveWidgetRegistryEntry } from '@/features/storyboard-widget-manager/resolveWidgetRegistry'
import {
  hashArrayOfObjectsSignature,
  hashRecordSignature32,
  hashScopedStringArraySignature,
  hashSignatureParts,
} from '@/lib/hash/signature'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'

export type FlowHandleDir = 'in' | 'out'

export type FlowHandleId = `${FlowHandleDir}:${string}`

export type FlowPortHandle = {
  id: FlowHandleId
  topPct: number
}

export type FlowNodeHandles = {
  in: FlowPortHandle[]
  out: FlowPortHandle[]
}

export function parseFlowHandleKey(handleId: FlowHandleId): string {
  const raw = String(handleId || '')
  const idx = raw.indexOf(':')
  if (idx < 0) return ''
  return raw.slice(idx + 1)
}

export const FLOW_HANDLE_DEFAULT_EDGE_ID = '__flow_default_handle__' as const
const FLOW_HANDLES_BY_NODE_CACHE_LIMIT = 32
const flowHandlesByNodeCache = new Map<string, Record<string, FlowNodeHandles>>()
const RICH_MEDIA_FLOW_PORT_PRIORITY_BY_TAB: Readonly<Record<string, ReadonlyArray<string>>> = {
  text: ['output', 'outputSrcDoc', 'imageUrl', 'videoUrl', 'audioUrl'],
  image: ['imageUrl', 'output', 'outputSrcDoc', 'videoUrl', 'audioUrl'],
  video: ['videoUrl', 'imageUrl', 'audioUrl', 'outputSrcDoc', 'output'],
  audio: ['audioUrl', 'videoUrl', 'imageUrl', 'outputSrcDoc', 'output'],
}

export function resolveRichMediaFlowPortPriority(activeTab: unknown): ReadonlyArray<string> {
  const normalizedTab = String(unwrapGraphCellValue(activeTab) || '').trim().toLowerCase()
  return RICH_MEDIA_FLOW_PORT_PRIORITY_BY_TAB[normalizedTab] || []
}

export function buildFlowHandleId(args: { dir: FlowHandleDir; edgeId: string }): FlowHandleId {
  const edgeId = String(args.edgeId || '').trim()
  const dir = args.dir === 'in' ? 'in' : 'out'
  return `${dir}:${edgeId || 'edge'}` as FlowHandleId
}

export function ensureFlowHandlesHaveDefaults(handles: FlowNodeHandles): FlowNodeHandles {
  const hasIn = Array.isArray(handles.in) && handles.in.length > 0
  const hasOut = Array.isArray(handles.out) && handles.out.length > 0
  if (hasIn && hasOut) return handles

  const nextIn = hasIn ? handles.in : [{ id: buildFlowHandleId({ dir: 'in', edgeId: FLOW_HANDLE_DEFAULT_EDGE_ID }), topPct: 50 }]
  const nextOut = hasOut ? handles.out : [{ id: buildFlowHandleId({ dir: 'out', edgeId: FLOW_HANDLE_DEFAULT_EDGE_ID }), topPct: 50 }]
  return { in: nextIn, out: nextOut }
}

function readCachedFlowHandlesByNode(signature: string): Record<string, FlowNodeHandles> | null {
  const cached = flowHandlesByNodeCache.get(signature) || null
  if (!cached) return null
  flowHandlesByNodeCache.delete(signature)
  flowHandlesByNodeCache.set(signature, cached)
  return cached
}

function writeCachedFlowHandlesByNode(
  signature: string,
  value: Record<string, FlowNodeHandles>,
): Record<string, FlowNodeHandles> {
  flowHandlesByNodeCache.set(signature, value)
  if (flowHandlesByNodeCache.size > FLOW_HANDLES_BY_NODE_CACHE_LIMIT) {
    const oldestKey = flowHandlesByNodeCache.keys().next().value
    if (typeof oldestKey === 'string') flowHandlesByNodeCache.delete(oldestKey)
  }
  return value
}

function buildWidgetRegistryPortsSignature(entry: WidgetRegistryEntry): string {
  const ports = Array.isArray(entry?.ports) ? entry.ports : []
  const portParts: Array<string | number> = ['ports', ports.length]
  for (let i = 0; i < ports.length; i += 1) {
    const port = ports[i]
    portParts.push(
      String(port?.direction || '').trim(),
      String(port?.portKey || '').trim(),
      port?.isHidden === true ? 1 : 0,
    )
  }
  return hashSignatureParts(portParts)
}

function buildFlowHandlesByNodeSignature(args: {
  nodes: ReadonlyArray<{ id: unknown; type?: unknown; properties?: unknown }>
  edges: ReadonlyArray<{ id: unknown; source: unknown; target: unknown; properties?: unknown }>
  widgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
}): string {
  const nodeSignature = hashArrayOfObjectsSignature(
    (Array.isArray(args.nodes) ? args.nodes : []).map(node => ({
      id: String(node?.id ?? '').trim(),
      type: String(node?.type ?? '').trim(),
      propertiesSignature: hashRecordSignature32(
        node && typeof node === 'object' && !Array.isArray(node)
          ? (node as { properties?: unknown }).properties
          : null,
        { maxEntries: 80, maxDepth: 2 },
      ),
    })),
    { maxItems: Math.max(12, Array.isArray(args.nodes) ? args.nodes.length : 0), maxKeysPerItem: 3 },
  )
  const edgeSignature = hashArrayOfObjectsSignature(
    (Array.isArray(args.edges) ? args.edges : []).map(edge => {
      const props =
        edge && typeof edge === 'object' && !Array.isArray(edge)
          ? ((edge as { properties?: unknown }).properties as Record<string, unknown> | null | undefined)
          : null
      const { src: source, tgt: target } = readGraphEdgeEndpoints(edge)
      return {
        id: String(edge?.id ?? '').trim(),
        source,
        target,
        sourcePortKey:
          props && typeof props[FLOW_EDGE_SOURCE_PORT_KEY] === 'string'
            ? String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
            : '',
        targetPortKey:
          props && typeof props[FLOW_EDGE_TARGET_PORT_KEY] === 'string'
            ? String(props[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
            : '',
      }
    }),
    { maxItems: Math.max(24, Array.isArray(args.edges) ? args.edges.length : 0), maxKeysPerItem: 5 },
  )
  const registry = Array.isArray(args.widgetRegistry) ? args.widgetRegistry : []
  const registrySignature = hashArrayOfObjectsSignature(
    registry.map(entry => ({
      id: String(entry?.id || '').trim(),
      nodeTypeId: String(entry?.nodeTypeId || '').trim(),
      widgetTypeId: String(entry?.widgetTypeId || '').trim(),
      formId: String(entry?.formId || '').trim(),
      updatedAt: String(entry?.updatedAt || '').trim(),
      portsSignature: buildWidgetRegistryPortsSignature(entry),
    })),
    { maxItems: Math.max(24, registry.length), maxKeysPerItem: 6 },
  )
  const nodeIdSignature = hashScopedStringArraySignature(
    'flow-handle-node-ids',
    (Array.isArray(args.nodes) ? args.nodes : []).map(node => String(node?.id ?? '').trim()),
    { unique: true },
  )
  return hashSignatureParts([
    'flow-handles-by-node',
    nodeIdSignature,
    nodeSignature,
    edgeSignature,
    registrySignature,
  ])
}

export function computeFlowHandlesByNode(args: {
  nodes: ReadonlyArray<{ id: unknown; type?: unknown; properties?: unknown }>
  edges: ReadonlyArray<{ id: unknown; source: unknown; target: unknown; properties?: unknown }>
  widgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
}): Record<string, FlowNodeHandles> {
  const cacheKey = buildFlowHandlesByNodeSignature(args)
  const cached = readCachedFlowHandlesByNode(cacheKey)
  if (cached) return cached

  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const edges = Array.isArray(args.edges) ? args.edges : []
  const registry = Array.isArray(args.widgetRegistry) ? args.widgetRegistry : []

  const nodeIds: string[] = []
  const nodeIdSet = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id ?? '').trim()
    if (!id) continue
    if (nodeIdSet.has(id)) continue
    nodeIdSet.add(id)
    nodeIds.push(id)
  }

  const incomingByNode = new Map<string, Array<{ handleKey: string; otherId: string }>>()
  const outgoingByNode = new Map<string, Array<{ handleKey: string; otherId: string }>>()

  const schemaFieldsByNodeId = new Map<string, string[]>()
  const registryPortsByNodeId = new Map<string, Array<{ dir: FlowHandleDir; portKey: string }>>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i] as unknown as { id?: unknown; type?: unknown; properties?: unknown }
    const id = String(n?.id ?? '').trim()
    if (!id) continue
    const fields = readSchemaFieldSpecs({ properties: (n as { properties?: unknown }).properties as never }).map(f => f.id).filter(Boolean)
    if (fields.length) schemaFieldsByNodeId.set(id, fields)

    const entry = resolveWidgetRegistryEntry({
      node: { id, type: String(n?.type ?? ''), properties: (n as { properties?: unknown }).properties as never },
      registry,
    })
    const ports = entry?.ports || []
    if (ports.length > 0) {
      const list: Array<{ dir: FlowHandleDir; portKey: string }> = []
      const seen = new Set<string>()
      for (let j = 0; j < ports.length; j += 1) {
        const p = ports[j]
        if ((p as { isHidden?: boolean }).isHidden === true) continue
        const portKey = String(p?.portKey || '').trim()
        if (!portKey) continue
        const dir: FlowHandleDir = p.direction === 'input' ? 'in' : 'out'
        const uniq = `${dir}:${portKey}`
        if (seen.has(uniq)) continue
        seen.add(uniq)
        list.push({ dir, portKey })
      }
      if (list.length > 0) registryPortsByNodeId.set(id, list)
    }
  }

  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const edgeId = String(e?.id ?? '').trim()
    const { src: source, tgt: target } = readGraphEdgeEndpoints(e)
    if (!edgeId || !source || !target) continue

    const props = (e as unknown as { properties?: unknown }).properties
    const sourcePortKey = (() => {
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const raw = (props as Record<string, unknown>)[FLOW_EDGE_SOURCE_PORT_KEY]
        if (typeof raw === 'string' && raw.trim()) return raw.trim()
      }
      return ''
    })()
    const targetPortKey = (() => {
      if (props && typeof props === 'object' && !Array.isArray(props)) {
        const raw = (props as Record<string, unknown>)[FLOW_EDGE_TARGET_PORT_KEY]
        if (typeof raw === 'string' && raw.trim()) return raw.trim()
      }
      return ''
    })()
    if (!sourcePortKey || !targetPortKey) continue

    if (nodeIdSet.has(target)) {
      const list = incomingByNode.get(target) || []
      list.push({ handleKey: targetPortKey, otherId: source })
      incomingByNode.set(target, list)
    }
    if (nodeIdSet.has(source)) {
      const list = outgoingByNode.get(source) || []
      list.push({ handleKey: sourcePortKey, otherId: target })
      outgoingByNode.set(source, list)
    }
  }

  const toHandles = (dir: 'in' | 'out', list: Array<{ handleKey: string }>): FlowPortHandle[] => {
    const n = list.length
    if (n <= 0) return []
    const out: FlowPortHandle[] = []
    for (let i = 0; i < n; i += 1) {
      const pct = ((i + 1) / (n + 1)) * 100
      out.push({ id: buildFlowHandleId({ dir, edgeId: list[i].handleKey }), topPct: pct })
    }
    return out
  }

  const rebalanceRichMediaPanelHandles = (
    node: Readonly<{ type?: unknown; properties?: unknown }>,
    dir: 'in' | 'out',
    handles: FlowPortHandle[],
  ): FlowPortHandle[] => {
    if (String(node?.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return handles
    const props = node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
      ? (node.properties as Record<string, unknown>)
      : null
    const preferredKeys = resolveRichMediaFlowPortPriority(props?.richMediaActiveTab)
    if (preferredKeys.length === 0 || handles.length <= 1) return handles
    const handleById = new Map(handles.map(handle => [handle.id, handle] as const))
    const ordered = preferredKeys
      .map(key => handleById.get(buildFlowHandleId({ dir, edgeId: key })) || null)
      .filter((handle): handle is FlowPortHandle => !!handle)
    for (let i = 0; i < handles.length; i += 1) {
      const handle = handles[i]
      if (!handle || ordered.some(entry => entry.id === handle.id)) continue
      ordered.push(handle)
    }
    if (ordered.length !== handles.length) return handles
    return ordered.map((handle, index) => ({
      id: handle.id,
      topPct: ((index + 1) / (ordered.length + 1)) * 100,
    }))
  }

  const out: Record<string, FlowNodeHandles> = {}
  for (let i = 0; i < nodeIds.length; i += 1) {
    const nodeId = nodeIds[i]
    const incoming = incomingByNode.get(nodeId) || []
    const outgoing = outgoingByNode.get(nodeId) || []
    incoming.sort((a, b) => (a.otherId === b.otherId ? a.handleKey.localeCompare(b.handleKey) : a.otherId.localeCompare(b.otherId)))
    outgoing.sort((a, b) => (a.otherId === b.otherId ? a.handleKey.localeCompare(b.handleKey) : a.otherId.localeCompare(b.otherId)))

    const schemaFields = schemaFieldsByNodeId.get(nodeId) || []
    const schemaHandles = (() => {
      const n = schemaFields.length
      if (n <= 0) return null
      const sin: FlowPortHandle[] = []
      const sout: FlowPortHandle[] = []
      for (let j = 0; j < n; j += 1) {
        const pct = ((j + 1) / (n + 1)) * 100
        const key = buildSchemaFieldPortKey(schemaFields[j])
        sin.push({ id: buildFlowHandleId({ dir: 'in', edgeId: key }), topPct: pct })
        sout.push({ id: buildFlowHandleId({ dir: 'out', edgeId: key }), topPct: pct })
      }
      return { in: sin, out: sout } satisfies FlowNodeHandles
    })()

    const registryHandles = (() => {
      const ports = registryPortsByNodeId.get(nodeId) || []
      if (ports.length === 0) return null
      const sin: FlowPortHandle[] = []
      const sout: FlowPortHandle[] = []
      const ins = ports.filter(p => p.dir === 'in')
      const outs = ports.filter(p => p.dir === 'out')
      for (let j = 0; j < ins.length; j += 1) {
        const pct = ((j + 1) / (ins.length + 1)) * 100
        sin.push({ id: buildFlowHandleId({ dir: 'in', edgeId: ins[j].portKey }), topPct: pct })
      }
      for (let j = 0; j < outs.length; j += 1) {
        const pct = ((j + 1) / (outs.length + 1)) * 100
        sout.push({ id: buildFlowHandleId({ dir: 'out', edgeId: outs[j].portKey }), topPct: pct })
      }
      return { in: sin, out: sout } satisfies FlowNodeHandles
    })()

    const dyn = { in: toHandles('in', incoming), out: toHandles('out', outgoing) }

    const mergeByPrecedence = (lists: Array<FlowPortHandle[] | null | undefined>): FlowPortHandle[] => {
      const seen = new Set<string>()
      const merged: FlowPortHandle[] = []
      for (let l = 0; l < lists.length; l += 1) {
        const list = lists[l]
        if (!list || list.length === 0) continue
        for (let k = 0; k < list.length; k += 1) {
          const h = list[k]
          if (!h) continue
          if (seen.has(h.id)) continue
          seen.add(h.id)
          merged.push(h)
        }
      }
      return merged
    }

    const node = nodes.find(candidate => String(candidate?.id ?? '').trim() === nodeId) || null
    out[nodeId] = {
      in: rebalanceRichMediaPanelHandles(node || {}, 'in', mergeByPrecedence([registryHandles?.in, schemaHandles?.in, dyn.in])),
      out: rebalanceRichMediaPanelHandles(node || {}, 'out', mergeByPrecedence([registryHandles?.out, schemaHandles?.out, dyn.out])),
    }
  }
  return writeCachedFlowHandlesByNode(cacheKey, out)
}

export function computeFlowNodeHandles(args: {
  nodeId: string
  edges: ReadonlyArray<{ id: string; source: string; target: string }>
}): FlowNodeHandles {
  const nodeId = String(args.nodeId || '').trim()
  if (!nodeId) return { in: [], out: [] }
  const byNode = computeFlowHandlesByNode({ nodes: [{ id: nodeId }], edges: args.edges })
  return byNode[nodeId] || { in: [], out: [] }
}
