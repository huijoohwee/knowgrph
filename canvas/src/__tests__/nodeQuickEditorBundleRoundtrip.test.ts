import { buildNodeQuickEditorBundleV1, nodeQuickEditorBundleToJsonText } from '@/lib/graph/io/nodeQuickEditorBundle'
import { parseGraph } from '@/lib/graph/io/adapter'
import {
  FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

export function testNodeQuickEditorBundleRoundtripParsesWithRegistryMetadata() {
  const graph = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'Generate Video', type: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, properties: { model: 'generate_video' } }],
    edges: [],
  }

  const registry = [
    {
      id: 'e1',
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      quickEditorTypeId: 'default',
      formId: 'videoGeneration',
      fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
      ports: [{ portKey: 'videoUrl', direction: 'output' }],
      updatedAt: new Date().toISOString(),
    },
  ]

  const bundle = buildNodeQuickEditorBundleV1({ registryEntries: registry, graphData: graph as never })
  const text = nodeQuickEditorBundleToJsonText(bundle)
  const res = parseGraph('flow.bundle.json', text)
  if (!res?.data) throw new Error('expected parseGraph to return GraphData')
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
  if ((res.data.nodes || []).length !== 1) throw new Error('expected one node')
}

