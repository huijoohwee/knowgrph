import { parseGraph } from '@/lib/graph/io/adapter'
import { applyNodeQuickEditorRegistryFromMetadata } from '@/hooks/store/graphDataSliceUtils'
import {
  FLOW_NODE_QUICK_EDITOR_BUNDLE_KIND,
  FLOW_NODE_QUICK_EDITOR_BUNDLE_VERSION,
  FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

export function testQuickEditorBundleParseProducesGraphDataWithRegistryMetadata() {
  const bundle = {
    kind: FLOW_NODE_QUICK_EDITOR_BUNDLE_KIND,
    version: FLOW_NODE_QUICK_EDITOR_BUNDLE_VERSION,
    registry: [
      {
        id: 'e1',
        isEnabled: true,
        nodeTypeId: 'VideoGeneration',
        quickEditorTypeId: 'default',
        formId: 'videoGeneration',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'videoUrl', direction: 'output' }],
        updatedAt: new Date().toISOString(),
      },
    ],
    graph: {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'Generate Video', type: 'VideoGeneration', properties: { model: 'generate_video' } }],
      edges: [],
    },
  }

  const res = parseGraph('bundle.json', JSON.stringify(bundle))
  if (!res?.data) throw new Error('expected parseGraph to return GraphData')
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
  if ((res.data.nodes || []).length !== 1) throw new Error('expected one node')
}

export function testQuickEditorRegistryAppliedFromGraphMetadata() {
  let applied: unknown[] | null = null
  const get = () => ({
    documentNodeQuickEditorRegistry: [],
    setDocumentNodeQuickEditorRegistry: (entries: unknown[]) => {
      applied = entries
    },
  })

  const metadata = {
    [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: [
      {
        id: 'e1',
        isEnabled: true,
        nodeTypeId: 'VideoGeneration',
        quickEditorTypeId: 'default',
        formId: 'videoGeneration',
        fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
        ports: [{ portKey: 'videoUrl', direction: 'output' }],
        updatedAt: new Date().toISOString(),
      },
    ],
  }

  applyNodeQuickEditorRegistryFromMetadata(get as never, metadata)
  if (!applied) throw new Error('expected registry to be applied')
  if (applied.length !== 1) throw new Error('expected one applied entry')
}

export function testQuickEditorAiFlowImportBuildsGraphAndRegistry() {
  const aiFlow = [
    {
      processorType: 'ai-flow',
      model: 'generate_video',
      name: 'Generate Video',
      aspect_ratio: 'landscape',
      duration: 4,
      resolution: '720p',
      generate_audio: true,
      fast: false,
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
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
}

export function testQuickEditorComfyUiImportBuildsGraphAndRegistry() {
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
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
}
