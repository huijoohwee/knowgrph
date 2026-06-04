import type { JSONValue } from '@/lib/graph/types'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_FORM_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_TRANSCRIBER_FORM_ID,
  FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { unwrapFlowEnvelopeFieldValue } from '@/features/parsers/markdownFrontmatterFlowGraph.flowEnvelope'
import {
  appendEmbeddedStructuredTextCandidates,
  collectStructuredTextCandidates,
  parseYamlOrJsonValue,
  STRUCTURED_ENVELOPE_KEYS,
} from './chatResponseStructuredContentCandidates'
export { projectChatResponseStructuredSurfaceIntoKgcFrontmatter } from './chatResponseStructuredContentProjector'

type ChatResponseStructuredRole = 'widget' | 'panel' | 'card' | 'media' | 'node'

export type ChatResponseSurfaceNode = {
  id: string
  label: string
  nodeTypeId: string
  kind: 'text' | 'image' | 'audio' | 'video' | 'html'
  sourceHandle: string
  targetHandle: string
  properties: Record<string, JSONValue>
}

export type ChatResponseSurfaceEdge = {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  label: string
}

export type ChatResponseStructuredSurface = {
  nodes: ChatResponseSurfaceNode[]
  edges: ChatResponseSurfaceEdge[]
}

const MAX_RESPONSE_SURFACE_NODES = 12
const FLOW_WIDGET_FORM_ID_KEY = 'flow:widgetFormId'
const FLOW_WIDGET_TYPE_ID_KEY = 'flow:widgetTypeId'
const STRUCTURED_NODE_META_KEYS = new Set([
  'id',
  'nodeId',
  'node_id',
  'label',
  'title',
  'name',
  'kind',
  'type',
  'mediaKind',
  'media_kind',
  'nodeTypeId',
  'node_type_id',
  'nodeType',
  'widgetNodeType',
  'widget_node_type',
  FLOW_WIDGET_FORM_ID_KEY,
  'widgetFormId',
  'widget_form_id',
  'formId',
  'form_id',
  FLOW_WIDGET_TYPE_ID_KEY,
  'widgetTypeId',
  'widget_type_id',
  'sourceHandle',
  'source_handle',
  'sourcePort',
  'source_port',
  'targetHandle',
  'target_handle',
  'targetPort',
  'target_port',
  'inputHandle',
  'input_handle',
  'inputPort',
  'input_port',
  'outputHandle',
  'output_handle',
  'outputPort',
  'output_port',
  'properties',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toJsonValue = (value: unknown): JSONValue | undefined => {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) {
    const out: JSONValue[] = []
    for (let i = 0; i < value.length; i += 1) {
      const item = toJsonValue(value[i])
      if (typeof item !== 'undefined') out.push(item)
    }
    return out
  }
  if (isRecord(value)) {
    const out: Record<string, JSONValue> = {}
    for (const [key, raw] of Object.entries(value)) {
      const item = toJsonValue(raw)
      if (typeof item !== 'undefined') out[key] = item
    }
    return out
  }
  return undefined
}

const readString = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim()
    : (typeof value === 'number' || typeof value === 'boolean')
      ? String(value).trim()
      : ''

const unwrapStructuredFieldValue = (raw: unknown, key: string): unknown =>
  unwrapFlowEnvelopeFieldValue({
    raw,
    path: `structuredContent.${key}`,
    expectedKey: key || undefined,
    warnings: [],
  })

const mergeStructuredProperties = (record: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...record }
  const assignIfMissing = (keyRaw: unknown, valueRaw: unknown) => {
    const key = readString(unwrapStructuredFieldValue(keyRaw, 'key'))
    if (!key || Object.prototype.hasOwnProperty.call(out, key)) return
    out[key] = unwrapStructuredFieldValue(valueRaw, key)
  }
  const properties = record.properties
  if (isRecord(properties)) {
    for (const [key, value] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(out, key)) continue
      out[key] = unwrapStructuredFieldValue(value, key)
    }
  } else if (Array.isArray(properties)) {
    for (const item of properties) {
      if (!isRecord(item)) continue
      assignIfMissing(item.key, Object.prototype.hasOwnProperty.call(item, 'value') ? item.value : item)
    }
  }
  return out
}

const readFieldValue = (record: Record<string, unknown>, key: string): unknown =>
  unwrapStructuredFieldValue(record[key], key)

const readFirstString = (record: Record<string, unknown>, keys: readonly string[]): string => {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i] as string
    const value = readString(readFieldValue(record, key))
    if (value) return value
  }
  return ''
}

const slugify = (value: unknown, fallback: string): string => {
  const slug = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || fallback
}

const normalizeNodeId = (value: unknown, fallback: string): string =>
  `mcp-response-${slugify(value, fallback)}`

const normalizeKind = (value: unknown, props: Record<string, unknown>): ChatResponseSurfaceNode['kind'] => {
  const explicit = readString(value).toLowerCase()
  if (explicit === 'image' || explicit === 'audio' || explicit === 'video' || explicit === 'html' || explicit === 'text') return explicit
  if (readFirstString(props, ['audioUrl', 'audio_url', 'audio'])) return 'audio'
  if (readFirstString(props, ['videoUrl', 'video_url', 'video'])) return 'video'
  if (readFirstString(props, ['imageUrl', 'image_url', 'image', 'mediaUrl', 'media_url'])) return 'image'
  if (readFirstString(props, ['outputSrcDoc', 'srcDoc', 'srcdoc', 'html'])) return 'html'
  return 'text'
}

const readTargetHandle = (kind: ChatResponseSurfaceNode['kind']): ChatResponseSurfaceNode['targetHandle'] => {
  if (kind === 'image') return 'imageUrl'
  if (kind === 'audio') return 'audioUrl'
  if (kind === 'video') return 'videoUrl'
  if (kind === 'html') return 'outputSrcDoc'
  return 'output'
}

const isKnownWidgetNodeType = (value: string): boolean =>
  value === FLOW_TEXT_GENERATION_NODE_TYPE_ID
  || value === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
  || value === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
  || value === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID
  || value === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID

const readWidgetFormId = (record: Record<string, unknown>): string =>
  readFirstString(record, [FLOW_WIDGET_FORM_ID_KEY, 'widgetFormId', 'widget_form_id', 'formId', 'form_id'])

const readWidgetTypeId = (record: Record<string, unknown>, nodeTypeId: string): string => {
  const explicit = readFirstString(record, [FLOW_WIDGET_TYPE_ID_KEY, 'widgetTypeId', 'widget_type_id'])
  if (explicit) return explicit
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return FLOW_RICH_MEDIA_PANEL_WIDGET_TYPE_ID
  return 'default'
}

const defaultWidgetFormIdForNodeType = (nodeTypeId: string): string => {
  if (nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) return 'textGeneration'
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return 'imageGeneration'
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'videoGeneration'
  if (nodeTypeId === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) return FLOW_VIDEO_TRANSCRIBER_FORM_ID
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) return FLOW_RICH_MEDIA_PANEL_FORM_ID
  return ''
}

const inferWidgetNodeTypeId = (record: Record<string, unknown>, role: ChatResponseStructuredRole): string => {
  const explicit = readFirstString(record, ['nodeTypeId', 'node_type_id', 'nodeType', 'widgetNodeType', 'widget_node_type'])
  if (isKnownWidgetNodeType(explicit)) return explicit
  const rawType = readFirstString(record, ['type'])
  if (isKnownWidgetNodeType(rawType)) return rawType
  const formId = readWidgetFormId(record)
  const normalized = formId.toLowerCase()
  if (normalized === FLOW_RICH_MEDIA_PANEL_FORM_ID.toLowerCase()) return FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
  if (normalized === FLOW_VIDEO_TRANSCRIBER_FORM_ID.toLowerCase()) return FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID
  if (normalized.startsWith('textgeneration') || normalized.startsWith('videoscript')) return FLOW_TEXT_GENERATION_NODE_TYPE_ID
  if (normalized.startsWith('imagegeneration')) return FLOW_IMAGE_GENERATION_NODE_TYPE_ID
  if (normalized.startsWith('videogeneration')) return FLOW_VIDEO_GENERATION_NODE_TYPE_ID
  return role === 'widget' && formId ? FLOW_TEXT_GENERATION_NODE_TYPE_ID : FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}

const readConfiguredHandle = (record: Record<string, unknown>, keys: readonly string[]): string =>
  readFirstString(record, keys)

const defaultSourceHandleForNode = (args: {
  nodeTypeId: string
  targetHandle: string
  record: Record<string, unknown>
}): string => {
  const explicit = readConfiguredHandle(args.record, ['sourceHandle', 'source_handle', 'sourcePort', 'source_port', 'outputHandle', 'output_handle', 'outputPort', 'output_port'])
  if (explicit) return explicit
  if (args.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID || args.nodeTypeId === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) return 'text_out'
  if (args.nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return 'imageUrl'
  if (args.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'videoUrl'
  return args.targetHandle
}

const defaultTargetHandleForNode = (args: {
  nodeTypeId: string
  kind: ChatResponseSurfaceNode['kind']
  record: Record<string, unknown>
}): string => {
  const explicit = readConfiguredHandle(args.record, ['targetHandle', 'target_handle', 'targetPort', 'target_port', 'inputHandle', 'input_handle', 'inputPort', 'input_port'])
  if (explicit) return explicit
  if (args.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID || args.nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID || args.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'prompt_in'
  if (args.nodeTypeId === FLOW_VIDEO_TRANSCRIBER_NODE_TYPE_ID) return 'sourceUrl_in'
  return readTargetHandle(args.kind)
}

const pickRichMediaTab = (kind: ChatResponseSurfaceNode['kind']): JSONValue => {
  if (kind === 'image' || kind === 'audio' || kind === 'video') return kind
  if (kind === 'html') return 'html'
  return 'text'
}

const normalizeNodeRecord = (value: unknown, index: number, role: ChatResponseStructuredRole): ChatResponseSurfaceNode | null => {
  if (!isRecord(value)) return null
  const record = mergeStructuredProperties(value)
  const kind = normalizeKind(readFieldValue(record, 'kind') || readFieldValue(record, 'type') || readFieldValue(record, 'mediaKind') || readFieldValue(record, 'media_kind'), record)
  const nodeTypeId = inferWidgetNodeTypeId(record, role)
  const targetHandle = defaultTargetHandleForNode({ nodeTypeId, kind, record })
  const sourceHandle = defaultSourceHandleForNode({ nodeTypeId, targetHandle: readTargetHandle(kind), record })
  const output = readFirstString(record, ['output', 'result', 'response', 'transcript', 'text', 'content', 'markdown', 'description'])
  const imageUrl = readFirstString(record, ['imageUrl', 'image_url', 'image', 'mediaUrl', 'media_url'])
  const audioUrl = readFirstString(record, ['audioUrl', 'audio_url', 'audio'])
  const videoUrl = readFirstString(record, ['videoUrl', 'video_url', 'video'])
  const outputSrcDoc = readFirstString(record, ['outputSrcDoc', 'srcDoc', 'srcdoc', 'html'])
  const hasRenderableContent = Boolean(output || imageUrl || audioUrl || videoUrl || outputSrcDoc)
  const hasDeclaredWidgetInput = nodeTypeId !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    && Boolean(readWidgetFormId(record) || readFirstString(record, ['prompt', 'input', 'instructions', 'systemPrompt', 'system_prompt']))
  if (!hasRenderableContent && !hasDeclaredWidgetInput) return null

  const label = readFirstString(record, ['label', 'title', 'name']) || `Response ${index + 1}`
  const rawId = readFirstString(record, ['id', 'nodeId', 'node_id']) || label
  const nodeId = normalizeNodeId(rawId, String(index + 1))
  const properties: Record<string, JSONValue> = {
    'chat:structuredContent': true,
    'chat:structuredRole': role,
    [FLOW_WIDGET_FORM_ID_KEY]: readWidgetFormId(record) || defaultWidgetFormIdForNodeType(nodeTypeId),
    [FLOW_WIDGET_TYPE_ID_KEY]: readWidgetTypeId(record, nodeTypeId),
  }
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    properties.richMediaActiveTab = pickRichMediaTab(kind)
    properties.media_interactive = kind === 'audio' || kind === 'video' || kind === 'html'
  }
  if (output) properties.output = output
  if (imageUrl) properties.imageUrl = imageUrl
  if (audioUrl) properties.audioUrl = audioUrl
  if (videoUrl) properties.videoUrl = videoUrl
  if (outputSrcDoc) properties.outputSrcDoc = outputSrcDoc
  for (const [key, raw] of Object.entries(record)) {
    if (Object.prototype.hasOwnProperty.call(properties, key)) continue
    if (STRUCTURED_NODE_META_KEYS.has(key)) continue
    const nextValue = toJsonValue(readFieldValue(record, key))
    if (typeof nextValue !== 'undefined') properties[key] = nextValue
  }

  return {
    id: nodeId,
    label,
    nodeTypeId,
    kind,
    sourceHandle,
    targetHandle,
    properties,
  }
}

const collectRecords = (value: unknown): Array<{ role: ChatResponseStructuredRole; value: unknown }> => {
  if (!isRecord(value)) return []
  const out: Array<{ role: ChatResponseStructuredRole; value: unknown }> = []
  const pushArray = (role: ChatResponseStructuredRole, raw: unknown) => {
    if (Array.isArray(raw)) raw.forEach(item => out.push({ role, value: item }))
  }
  pushArray('widget', value.widgets)
  pushArray('panel', value.panels)
  pushArray('card', value.cards)
  pushArray('media', value.media)
  pushArray('media', value.richMedia)
  pushArray('media', value.rich_media)
  pushArray('node', value.nodes)
  if (out.length === 0) out.push({ role: 'node', value })
  return out
}

const collectEdgeRecords = (value: unknown): unknown[] => {
  if (!isRecord(value)) return []
  return Array.isArray(value.edges) ? value.edges : []
}

const readDirectStructuredRecord = (record: Record<string, unknown>): Record<string, unknown> | null => {
  if (isRecord(record.structuredContent)) return record.structuredContent
  if (isRecord(record.structured_content)) return record.structured_content
  return null
}

const hasStructuredSurfaceLists = (record: Record<string, unknown>): boolean =>
  Array.isArray(record.widgets)
  || Array.isArray(record.panels)
  || Array.isArray(record.cards)
  || Array.isArray(record.media)
  || Array.isArray(record.richMedia)
  || Array.isArray(record.rich_media)
  || Array.isArray(record.nodes)
  || Array.isArray(record.edges)

const readStructuredRoot = (parsed: unknown, allowFallback = true): Record<string, unknown> | null => {
  if (!isRecord(parsed)) return null
  const direct = readDirectStructuredRecord(parsed)
  if (direct) return direct
  for (const key of STRUCTURED_ENVELOPE_KEYS) {
    const nested = isRecord(parsed[key]) ? readStructuredRoot(parsed[key], false) : null
    if (nested) return nested
  }
  if (hasStructuredSurfaceLists(parsed)) return parsed
  return allowFallback ? parsed : null
}

const parseYamlOrJsonCandidate = (text: string): Record<string, unknown> | null => {
  const parsed = parseYamlOrJsonValue(text)
  return readStructuredRoot(parsed)
}

const collectNodeAliases = (record: unknown, node: ChatResponseSurfaceNode, fallback: string): string[] => {
  if (!isRecord(record)) return [node.id]
  const normalized = mergeStructuredProperties(record)
  const rawId = readFirstString(normalized, ['id', 'nodeId', 'node_id'])
  const label = readFirstString(normalized, ['label', 'title', 'name'])
  const aliases = [
    node.id,
    rawId,
    label,
    slugify(rawId, fallback),
    slugify(label, fallback),
    normalizeNodeId(rawId, fallback),
    normalizeNodeId(label, fallback),
  ]
  return aliases.map(alias => String(alias || '').trim()).filter(Boolean)
}

const readEndpoint = (record: Record<string, unknown>, nodeKeys: readonly string[], handleKeys: readonly string[]): { nodeId: string; handle: string } | null => {
  let nodeId = readFirstString(record, nodeKeys)
  let handle = readFirstString(record, handleKeys)
  if (!nodeId) return null
  if (!handle) {
    const dot = nodeId.lastIndexOf('.')
    if (dot > 0 && dot < nodeId.length - 1) {
      handle = nodeId.slice(dot + 1).trim()
      nodeId = nodeId.slice(0, dot).trim()
    }
  }
  return nodeId ? { nodeId, handle } : null
}

const defaultSourceHandle = (sourceId: string, nodeHandleById: Map<string, string>): string =>
  sourceId === 'n-deliver' ? 'rendered' : (nodeHandleById.get(sourceId) || 'output')

const defaultTargetHandle = (targetId: string, nodeHandleById: Map<string, string>): string =>
  nodeHandleById.get(targetId) || 'input'

const normalizeStructuredEdge = (args: {
  raw: unknown
  index: number
  nodeIdByAlias: Map<string, string>
  nodeSourceHandleById: Map<string, string>
  nodeTargetHandleById: Map<string, string>
}): ChatResponseSurfaceEdge | null => {
  if (!isRecord(args.raw)) return null
  const record = mergeStructuredProperties(args.raw)
  const source = readEndpoint(record, ['source', 'from', 'fromNode', 'from_node'], ['sourceHandle', 'source_handle', 'sourcePort', 'source_port', 'fromHandle', 'from_handle', 'fromPort', 'from_port'])
  const target = readEndpoint(record, ['target', 'to', 'toNode', 'to_node'], ['targetHandle', 'target_handle', 'targetPort', 'target_port', 'toHandle', 'to_handle', 'toPort', 'to_port'])
  if (!source || !target) return null
  const sourceId = args.nodeIdByAlias.get(source.nodeId) || source.nodeId
  const targetId = args.nodeIdByAlias.get(target.nodeId) || target.nodeId
  const sourceHandle = source.handle || defaultSourceHandle(sourceId, args.nodeSourceHandleById)
  const targetHandle = target.handle || defaultTargetHandle(targetId, args.nodeTargetHandleById)
  if (!sourceId || !targetId || !sourceHandle || !targetHandle) return null
  const rawId = readFirstString(record, ['id', 'edgeId', 'edge_id'])
  const label = readFirstString(record, ['label', 'name', 'title']) || `${sourceHandle}->${targetHandle}`
  const fallback = `${sourceId}-${sourceHandle}-${targetId}-${targetHandle}`
  return {
    id: `e-mcp-response-${slugify(rawId, fallback || String(args.index + 1))}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    label,
  }
}

const buildDefaultResponseEdge = (node: ChatResponseSurfaceNode, index: number): ChatResponseSurfaceEdge => ({
  id: `e-mcp-response-${index + 1}`,
  source: 'n-deliver',
  target: node.id,
  sourceHandle: 'rendered',
  targetHandle: node.targetHandle,
  label: node.targetHandle,
})

const edgeSignature = (edge: ChatResponseSurfaceEdge): string =>
  [edge.source, edge.sourceHandle, edge.target, edge.targetHandle].map(value => String(value || '').trim()).join('\u0000')

export const extractChatResponseStructuredSurface = (assistantText: string): ChatResponseStructuredSurface | null => {
  const candidates = collectStructuredTextCandidates(assistantText, 8)
  appendEmbeddedStructuredTextCandidates(candidates, 8)

  const seenIds = new Set<string>()
  const nodeIdByAlias = new Map<string, string>()
  const nodeSourceHandleById = new Map<string, string>()
  const nodeTargetHandleById = new Map<string, string>()
  const nodes: ChatResponseSurfaceNode[] = []
  const rawEdges: unknown[] = []
  for (let i = 0; i < candidates.length && nodes.length < MAX_RESPONSE_SURFACE_NODES; i += 1) {
    const root = parseYamlOrJsonCandidate(candidates[i] || '')
    if (!root) continue
    const records = collectRecords(root)
    for (let j = 0; j < records.length && nodes.length < MAX_RESPONSE_SURFACE_NODES; j += 1) {
      const record = records[j]
      const node = normalizeNodeRecord(record.value, nodes.length, record.role)
      if (!node || seenIds.has(node.id)) continue
      seenIds.add(node.id)
      nodeSourceHandleById.set(node.id, node.sourceHandle)
      nodeTargetHandleById.set(node.id, node.targetHandle)
      collectNodeAliases(record.value, node, String(nodes.length + 1)).forEach(alias => {
        if (!nodeIdByAlias.has(alias)) nodeIdByAlias.set(alias, node.id)
      })
      nodes.push(node)
    }
    rawEdges.push(...collectEdgeRecords(root))
  }
  if (nodes.length === 0) return null
  const edges: ChatResponseSurfaceEdge[] = []
  const seenEdges = new Set<string>()
  const pushEdge = (edge: ChatResponseSurfaceEdge) => {
    const signature = edgeSignature(edge)
    if (seenEdges.has(signature)) return
    seenEdges.add(signature)
    edges.push(edge)
  }
  for (let i = 0; i < rawEdges.length; i += 1) {
    const edge = normalizeStructuredEdge({ raw: rawEdges[i], index: i, nodeIdByAlias, nodeSourceHandleById, nodeTargetHandleById })
    if (edge) pushEdge(edge)
  }
  nodes.forEach((node, index) => pushEdge(buildDefaultResponseEdge(node, index)))
  return { nodes, edges }
}
