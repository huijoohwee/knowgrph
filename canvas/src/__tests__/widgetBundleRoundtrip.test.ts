import { buildWidgetBundleV1, widgetBundleToJsonText } from '@/lib/graph/io/widgetBundle'
import { parseGraph } from '@/lib/graph/io/adapter'
import {
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

export function testWidgetBundleRoundtripParsesWithRegistryMetadata() {
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
      widgetTypeId: 'default',
      formId: 'videoGeneration',
      fields: [{ fieldKey: 'prompt', fieldType: 'textarea', schemaPath: 'properties.prompt' }],
      ports: [{ portKey: 'videoUrl', direction: 'output' }],
      updatedAt: new Date().toISOString(),
    },
  ]

  const bundle = buildWidgetBundleV1({ registryEntries: registry, graphData: graph as never })
  const text = widgetBundleToJsonText(bundle)
  const res = parseGraph('flow.bundle.json', text)
  if (!res?.data) throw new Error('expected parseGraph to return GraphData')
  const meta = res.data.metadata as unknown as Record<string, unknown> | undefined
  if (!meta) throw new Error('expected metadata to exist')
  const raw = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (!Array.isArray(raw)) throw new Error('expected registry metadata array')
  if (raw.length !== 1) throw new Error('expected one registry entry')
  if ((res.data.nodes || []).length !== 1) throw new Error('expected one node')
}

