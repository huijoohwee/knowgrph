import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import {
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
} from '@/lib/chatEndpoint'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_WIDGET_BUNDLE_KIND,
  FLOW_WIDGET_BUNDLE_VERSION,
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

type RegistryFieldLike = {
  fieldKey: string
  fieldType: string
  label?: string
  schemaPath?: string
  required?: boolean
}

type RegistryPortLike = {
  portKey: string
  direction: 'input' | 'output'
  schemaPath?: string
}

type RegistryEntryLike = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  widgetTypeId: string
  formId: string
  fields: RegistryFieldLike[]
  ports: RegistryPortLike[]
  schemaMappings?: Array<{ fromPath: string; toPath: string; transformId?: string; reduceId?: string }>
  updatedAt: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const parsed = Number.parseFloat(v)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asBoolOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  return null
}

function looksLikeGraphData(v: unknown): v is GraphData {
  if (!isRecord(v)) return false
  if (!Array.isArray(v.nodes) || !Array.isArray(v.edges)) return false
  return typeof v.type === 'string'
}

function buildRegistryEntryId(parts: string[]): string {
  const cleaned = parts.map(p => cleanIdPart(p)).filter(Boolean)
  const joined = cleaned.join('-')
  return joined ? `qer-${joined}` : `qer-${Date.now()}`
}

function buildDefaultSmartMediaRegistryEntry(args: {
  nodeTypeId: string
  widgetTypeId?: string
  formId?: string
  mode?: 'image' | 'video'
}): RegistryEntryLike {
  const mode = args.mode === 'image' ? 'image' : 'video'
  const fallbackNodeType = mode === 'image' ? FLOW_IMAGE_GENERATION_NODE_TYPE_ID : FLOW_VIDEO_GENERATION_NODE_TYPE_ID
  const nodeTypeId = String(args.nodeTypeId || fallbackNodeType).trim() || fallbackNodeType
  const widgetTypeId = String(args.widgetTypeId || 'default').trim() || 'default'
  const formId = String(args.formId || (mode === 'image' ? 'imageGeneration' : 'videoGeneration')).trim() || (mode === 'image' ? 'imageGeneration' : 'videoGeneration')
  const updatedAt = new Date().toISOString()

  return {
    id: buildRegistryEntryId([nodeTypeId, widgetTypeId, formId]),
    isEnabled: true,
    nodeTypeId,
    widgetTypeId,
    formId,
    fields: [
      { fieldKey: 'model', fieldType: 'select', label: 'Model', schemaPath: 'properties.model', required: true },
      { fieldKey: 'prompt', fieldType: 'textarea', label: 'Prompt', schemaPath: 'properties.prompt', required: true },
      { fieldKey: 'aspect_ratio', fieldType: 'select', label: 'Aspect Ratio', schemaPath: 'properties.aspect_ratio', required: true },
      { fieldKey: 'resolution', fieldType: 'select', label: 'Resolution', schemaPath: 'properties.resolution', required: true },
      ...(mode === 'video'
        ? [
            { fieldKey: 'duration', fieldType: 'select', label: 'Duration (seconds)', schemaPath: 'properties.duration', required: true } as RegistryFieldLike,
            { fieldKey: 'generate_audio', fieldType: 'boolean', label: 'Generate Audio', schemaPath: 'properties.generate_audio' } as RegistryFieldLike,
            { fieldKey: 'fast', fieldType: 'boolean', label: 'Fast', schemaPath: 'properties.fast' } as RegistryFieldLike,
          ]
        : [
            { fieldKey: 'fast', fieldType: 'boolean', label: 'Fast', schemaPath: 'properties.fast' } as RegistryFieldLike,
          ]),
      { fieldKey: 'reference_image', fieldType: 'text', label: 'Reference Image', schemaPath: 'properties.reference_image' },
    ],
    ports: [
      { portKey: 'reference_image', direction: 'input', schemaPath: 'properties.reference_image' },
      { portKey: mode === 'image' ? 'imageUrl' : 'videoUrl', direction: 'output', schemaPath: mode === 'image' ? 'properties.imageUrl' : 'properties.videoUrl' },
    ],
    updatedAt,
  }
}

function normalizeImportedSmartMediaModel(args: {
  model?: unknown
  nodeTypeId?: unknown
}): string {
  const raw = asString(args.model).trim()
  const nodeTypeId = String(args.nodeTypeId || '').trim()
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
    return raw && raw !== 'generate_image' ? raw : CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT
  }
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
    return raw && raw !== 'generate_video' ? raw : CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT
  }
  return raw
}

function withRegistryMetadata(graphData: GraphData, entries: RegistryEntryLike[], warnings: string[]): { graphData: GraphData; warnings: string[] } {
  const baseMeta = isRecord(graphData.metadata) ? graphData.metadata : {}
  const nextMeta: Record<string, JSONValue> = { ...baseMeta }
  nextMeta[FLOW_WIDGET_REGISTRY_METADATA_KEY] = entries as unknown as JSONValue
  return { graphData: { ...graphData, metadata: nextMeta }, warnings }
}

function parseWidgetBundle(json: unknown): { graphData: GraphData; warnings: string[] } | null {
  if (!isRecord(json)) return null
  const kind = asString(json.kind).trim()
  const version = typeof json.version === 'number' ? json.version : asNumberOrNull(json.version)
  if (kind !== FLOW_WIDGET_BUNDLE_KIND) return null
  if (version !== FLOW_WIDGET_BUNDLE_VERSION) return null

  const warnings: string[] = []
  const registryRaw = Array.isArray(json.registry) ? json.registry : []
  const registry = registryRaw.filter(isRecord) as unknown as RegistryEntryLike[]

  const graphRaw = json.graph
  const graphData: GraphData = looksLikeGraphData(graphRaw)
    ? (graphRaw as GraphData)
    : {
        type: 'Graph',
        nodes: [],
        edges: [],
      }

  if (registry.length === 0) warnings.push('Widget bundle contains no registry entries.')
  return withRegistryMetadata(graphData, registry, warnings)
}

function parseAiFlowProcessorList(json: unknown): { graphData: GraphData; warnings: string[] } | null {
  if (!Array.isArray(json) || json.length === 0) return null
  const first = json[0]
  if (!isRecord(first)) return null
  const processorType = asString(first.processorType).trim()
  if (!processorType) return null

  const nodes: GraphNode[] = []
  const entries: RegistryEntryLike[] = []
  const warnings: string[] = []

  for (let i = 0; i < json.length; i += 1) {
    const item = json[i]
    if (!isRecord(item)) continue
    const model = asString(item.model).trim()
    const inferredNodeTypeId =
      model === 'generate_image'
        ? FLOW_IMAGE_GENERATION_NODE_TYPE_ID
        : model === 'generate_video'
          ? FLOW_VIDEO_GENERATION_NODE_TYPE_ID
          : cleanIdPart(model) || 'Processor'
    const normalizedModel = normalizeImportedSmartMediaModel({
      model,
      nodeTypeId: inferredNodeTypeId,
    })
    const name = asString(item.name).trim() || `${processorType}:${i + 1}`

    const node: GraphNode = {
      id: cleanIdPart(name) || `node_${i + 1}`,
      label: cleanIdPart(name) || name || inferredNodeTypeId,
      type: inferredNodeTypeId,
      properties: {
        ...(normalizedModel ? ({ model: normalizedModel } as unknown as Record<string, JSONValue>) : {}),
        ...(asString(item.aspect_ratio).trim() ? ({ aspect_ratio: asString(item.aspect_ratio).trim() } as unknown as Record<string, JSONValue>) : {}),
        ...(asString(item.resolution).trim() ? ({ resolution: asString(item.resolution).trim() } as unknown as Record<string, JSONValue>) : {}),
        ...(asString(item.duration).trim() ? ({ duration: asNumberOrNull(item.duration) ?? asString(item.duration).trim() } as unknown as Record<string, JSONValue>) : {}),
        ...(asBoolOrNull(item.generate_audio) != null ? ({ generate_audio: asBoolOrNull(item.generate_audio) as boolean } as unknown as Record<string, JSONValue>) : {}),
        ...(asBoolOrNull(item.fast) != null ? ({ fast: asBoolOrNull(item.fast) as boolean } as unknown as Record<string, JSONValue>) : {}),
      },
    }
    nodes.push(node)

    const cfg = isRecord(item.config) ? item.config : null
    const fieldsRaw = cfg && Array.isArray(cfg.fields) ? cfg.fields : []
    const fields: RegistryFieldLike[] = []
    const ports: RegistryPortLike[] = []

    for (let fIdx = 0; fIdx < fieldsRaw.length; fIdx += 1) {
      const f = fieldsRaw[fIdx]
      if (!isRecord(f)) continue
      const fieldKey = asString(f.name).trim()
      const fieldType = asString(f.type).trim() || 'text'
      if (!fieldKey) continue
      const label = asString(f.label).trim() || undefined
      const required = typeof f.required === 'boolean' ? f.required : undefined
      const hasHandle = typeof f.hasHandle === 'boolean' ? f.hasHandle : null
      fields.push({ fieldKey, fieldType, ...(label ? { label } : {}), schemaPath: `properties.${fieldKey}`, ...(required != null ? { required } : {}) })
      if (hasHandle === true) {
        ports.push({ portKey: fieldKey, direction: 'input', schemaPath: `properties.${fieldKey}` })
      }
    }

    const outputType = cfg ? asString(cfg.outputType).trim() : ''
    if (outputType) {
      ports.push({ portKey: outputType, direction: 'output', schemaPath: `properties.${outputType}` })
    }

    if (fields.length === 0 && (inferredNodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID || inferredNodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID)) {
      const fallback = buildDefaultSmartMediaRegistryEntry({
        nodeTypeId: inferredNodeTypeId,
        mode: inferredNodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID ? 'image' : 'video',
      })
      entries.push(fallback)
      warnings.push('AI-Flow form did not include fields; using default smart media widget registry entry.')
      continue
    }

    if (fields.length > 0 || ports.length > 0) {
      const widgetTypeId = 'default'
      const formId = cfg ? asString(cfg.nodeName).trim() || cleanIdPart(model) || 'default' : cleanIdPart(model) || 'default'
      entries.push({
        id: buildRegistryEntryId([inferredNodeTypeId, widgetTypeId, formId]),
        isEnabled: true,
        nodeTypeId: inferredNodeTypeId,
        widgetTypeId,
        formId,
        fields,
        ports,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  if (nodes.length === 0) return null
  const graphData: GraphData = { type: 'Graph', nodes, edges: [] }
  return withRegistryMetadata(graphData, entries.length > 0 ? entries : [buildDefaultSmartMediaRegistryEntry({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, mode: 'video' })], warnings)
}

function parseComfyUiWorkflow(json: unknown): { graphData: GraphData; warnings: string[] } | null {
  if (!isRecord(json)) return null
  if (!Array.isArray(json.nodes)) return null
  const nodesRaw = json.nodes
  if (nodesRaw.length === 0) return null

  const nodes: GraphNode[] = []
  const warnings: string[] = []

  for (let i = 0; i < nodesRaw.length; i += 1) {
    const n = nodesRaw[i]
    if (!isRecord(n)) continue
    const type = asString(n.type).trim()
    if (!type) continue

    const hasVideoOut = Array.isArray(n.outputs) && n.outputs.some(o => isRecord(o) && asString(o.type).toUpperCase() === 'VIDEO')
    const hasImageIn = Array.isArray(n.inputs) && n.inputs.some(inp => isRecord(inp) && asString(inp.type).toUpperCase() === 'IMAGE')
    if (!hasVideoOut) continue
    if (!hasImageIn) continue

    const id = typeof n.id === 'number' ? String(n.id) : cleanIdPart(n.id)
    const label = type
    nodes.push({
      id: id || `node_${i + 1}`,
      label,
      type: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      properties: {
        model: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
        source_type: type,
      },
    })
  }

  if (nodes.length === 0) return null
  warnings.push('ComfyUI workflow imported as VideoGeneration nodes with a default registry entry.')
  const graphData: GraphData = { type: 'Graph', nodes, edges: [] }
  const entry = buildDefaultSmartMediaRegistryEntry({ nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, mode: 'video' })
  return withRegistryMetadata(graphData, [entry], warnings)
}

export function tryParseWidgetImportGraphData(json: unknown): { graphData: GraphData; warnings: string[] } | null {
  const bundle = parseWidgetBundle(json)
  if (bundle) return bundle

  const aiFlow = parseAiFlowProcessorList(json)
  if (aiFlow) return aiFlow

  const comfy = parseComfyUiWorkflow(json)
  if (comfy) return comfy

  return null
}
