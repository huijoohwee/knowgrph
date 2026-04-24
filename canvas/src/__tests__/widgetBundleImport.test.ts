import { parseGraph } from '@/lib/graph/io/adapter'
import { applyWidgetRegistryFromMetadata } from '@/hooks/store/graphDataSliceUtils'
import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import {
  FLOW_WIDGET_BUNDLE_KIND,
  FLOW_WIDGET_BUNDLE_VERSION,
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

export function testWidgetBundleParseProducesGraphDataWithRegistryMetadata() {
  const bundle = {
    kind: FLOW_WIDGET_BUNDLE_KIND,
    version: FLOW_WIDGET_BUNDLE_VERSION,
    registry: [
      {
        id: 'e1',
        isEnabled: true,
        nodeTypeId: 'VideoGeneration',
        widgetTypeId: 'default',
        formId: 'videoGeneration',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'videoUrl', direction: 'output' }],
        updatedAt: new Date().toISOString(),
      },
    ],
    graph: {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'Generate Video', type: 'VideoGeneration', properties: { model: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } }],
      edges: [],
    },
  }

  const res = parseGraph('bundle.json', JSON.stringify(bundle))
  if (!res?.data) throw new Error('expected parseGraph to return GraphData')
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
  if ((res.data.nodes || []).length !== 1) throw new Error('expected one node')
}

export function testWidgetRegistryAppliedFromGraphMetadata() {
  let applied: unknown[] | null = null
  const get = () => ({
    documentWidgetRegistry: [],
    setDocumentWidgetRegistry: (entries: unknown[]) => {
      applied = entries
    },
  })

  const metadata = {
    [FLOW_WIDGET_REGISTRY_METADATA_KEY]: [
      {
        id: 'e1',
        isEnabled: true,
        nodeTypeId: 'VideoGeneration',
        widgetTypeId: 'default',
        formId: 'videoGeneration',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'videoUrl', direction: 'output' }],
        updatedAt: new Date().toISOString(),
      },
    ],
  }

  applyWidgetRegistryFromMetadata(get as never, metadata)
  if (!applied) throw new Error('expected registry to be applied')
  if (applied.length !== 1) throw new Error('expected one applied entry')
}

export function testWidgetAiFlowImportBuildsGraphAndRegistry() {
  const aiFlow = [
    {
      processorType: 'ai-flow',
      model: 'generate_video',
      name: 'Generate Video',
      content_json: [{ type: 'text', text: 'Override content' }],
      aspect_ratio: 'landscape',
      duration: 4,
      resolution: '720p',
      generate_audio: true,
      fast: false,
      watermark: true,
      config: {
        nodeName: 'videoGeneration',
        outputType: 'videoUrl',
        fields: [{ name: 'prompt', type: 'textarea', label: 'Prompt', required: true, hasHandle: false }],
      },
    },
  ]
  const res = parseGraph('ai-flow.json', JSON.stringify(aiFlow))
  if (!res?.data) throw new Error('expected parseGraph to return GraphData')
  const nodes = res.data.nodes || []
  if (nodes.length !== 1) throw new Error('expected one node')
  if (nodes[0].type !== FLOW_VIDEO_GENERATION_NODE_TYPE_ID) throw new Error('expected VideoGeneration node type')
  if (String((nodes[0].properties || {}).model || '').trim() !== CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT) {
    throw new Error('expected AI-Flow import to normalize Video Widget model to BytePlus default')
  }
  if (String((nodes[0].properties || {}).content_json || '').trim().length === 0) {
    throw new Error('expected AI-Flow import to preserve BytePlus video content_json override')
  }
  if ((nodes[0].properties || {}).watermark !== true) {
    throw new Error('expected AI-Flow import to preserve BytePlus video watermark flag')
  }
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
}

export function testWidgetComfyUiImportBuildsGraphAndRegistry() {
  const comfy = {
    nodes: [
      {
        id: 1,
        type: 'ComfyVideoGen',
        inputs: [{ name: 'image', type: 'IMAGE' }],
        outputs: [{ name: 'video', type: 'VIDEO' }],
      },
    ],
  }
  const res = parseGraph('comfy.json', JSON.stringify(comfy))
  if (!res?.data) throw new Error('expected parseGraph to return GraphData')
  const nodes = res.data.nodes || []
  if (nodes.length !== 1) throw new Error('expected one node')
  if (nodes[0].type !== FLOW_VIDEO_GENERATION_NODE_TYPE_ID) throw new Error('expected VideoGeneration node type')
  if (String((nodes[0].properties || {}).model || '').trim() !== CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT) {
    throw new Error('expected ComfyUI import to seed BytePlus video model default')
  }
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
}
