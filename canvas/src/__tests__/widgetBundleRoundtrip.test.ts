import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildWidgetBundleJsonText, buildWidgetBundleV1, widgetBundleToJsonText } from '@/lib/graph/io/widgetBundle'
import { parseGraph } from '@/lib/graph/io/adapter'
import { CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } from '@/lib/chatEndpoint'
import {
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config'

export function testWidgetBundleRoundtripParsesWithRegistryMetadata() {
  const graph = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'Generate Video', type: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, properties: { model: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } }],
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

export function testWidgetBundleJsonTextHelperUsesSharedSemanticCache() {
  const graph = {
    type: 'application/json',
    nodes: [{ id: 'n1', label: 'Generate Video', type: FLOW_VIDEO_GENERATION_NODE_TYPE_ID, properties: { model: CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT } }],
    edges: [],
  }
  const registry = [
    {
      id: 'e1',
      isEnabled: true,
      nodeTypeId: FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
      widgetTypeId: 'default',
      formId: 'videoGeneration',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
  ]
  const helperText = buildWidgetBundleJsonText({ registryEntries: registry, graphData: graph as never, graphRevision: 7 })
  const baselineText = widgetBundleToJsonText(buildWidgetBundleV1({ registryEntries: registry, graphData: graph as never }))
  if (helperText !== baselineText) {
    throw new Error('expected shared widget bundle JSON helper to preserve bundle output')
  }
  const helperTextFromSemanticKey = buildWidgetBundleJsonText({
    registryEntries: registry,
    graphData: graph as never,
    graphSemanticKey: 'source-layers:abc123',
  })
  if (helperTextFromSemanticKey !== baselineText) {
    throw new Error('expected semantic-key widget bundle helper path to preserve bundle output')
  }

  const p = resolve(process.cwd(), 'src', 'lib', 'graph', 'io', 'widgetBundle.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('widgetBundleJsonTextCache') || !text.includes('buildWidgetBundleJsonText')) {
    throw new Error('expected widget bundle JSON helper to keep a shared semantic cache in the SSOT module')
  }
  if (!text.includes("const graphSemanticKey = buildScopedGraphSemanticKey('widget-bundle-graph', {")) {
    throw new Error('expected widget bundle JSON helper to derive cache reuse from the shared graph semantic-key helper')
  }
  if (!text.includes("if (graphSemanticKey) return hashSignatureParts(['widget-bundle-graph', graphSemanticKey])")) {
    throw new Error('expected widget bundle JSON helper to reuse upstream semantic graph keys before hashing raw graph arrays')
  }
}

export function testWidgetBundleJsonTextHelperPropagatesToExplicitExportPaths() {
  const graphTableInspectorPath = resolve(process.cwd(), 'src', 'features', 'graph-inspector', 'ui', 'GraphRecordInspector.tsx')
  const graphTableInspectorText = readFileSync(graphTableInspectorPath, 'utf8')
  if (!graphTableInspectorText.includes('buildWidgetBundleJsonText({')) {
    throw new Error('expected GraphRecordInspector widget copy path to reuse the shared widget bundle JSON helper')
  }
  if (!graphTableInspectorText.includes('graphRevision: graphDataRevision')) {
    throw new Error('expected GraphRecordInspector widget copy path to pass graph revision metadata into the shared widget bundle JSON helper')
  }
  if (!graphTableInspectorText.includes('effectiveWidgetRegistry: s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY')) {
    throw new Error('expected GraphRecordInspector widget flows to reuse the store effective widget registry SSOT')
  }
  if (graphTableInspectorText.includes('graphLookupSnapshotRef')) {
    throw new Error('expected GraphRecordInspector to rely on the shared graph lookup cache instead of preserving a local graph snapshot ref')
  }
  if (!graphTableInspectorText.includes('preferCurrentGraphDataRefs: true')) {
    throw new Error('expected GraphRecordInspector shared graph lookup to preserve current graph references on cache refresh')
  }

  const flowEditorMappingRegistryIoPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'FlowEditorMappingRegistryIo.ts')
  const flowEditorMappingRegistryIoText = readFileSync(flowEditorMappingRegistryIoPath, 'utf8')
  if (!flowEditorMappingRegistryIoText.includes('const bundleText = buildWidgetBundleJsonText({ registryEntries: entries, graphData: null })')) {
    throw new Error('expected FlowEditorMappingTab JSON export path to reuse the shared widget bundle JSON helper')
  }
  if (!flowEditorMappingRegistryIoText.includes('readValidatedWidgetRegistryMetadataEntries(meta)')) {
    throw new Error('expected FlowEditorMappingTab JSON import path to reuse the shared validated widget-registry metadata reader')
  }
  if (flowEditorMappingRegistryIoText.includes('FLOW_WIDGET_REGISTRY_METADATA_KEY')) {
    throw new Error('expected FlowEditorMappingTab JSON import path to stop parsing the widget registry metadata key inline')
  }

  const graphFilePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'file.ts')
  const graphFileText = readFileSync(graphFilePath, 'utf8')
  if (!graphFileText.includes('const text = buildWidgetBundleJsonText({')) {
    throw new Error('expected graph file export/copy helpers to reuse the shared widget bundle JSON helper')
  }
  if (graphFileText.includes('const bundle = buildWidgetBundleV1({ registryEntries: args.registryEntries, graphData')) {
    throw new Error('expected graph file export/copy helpers to stop rebuilding widget bundles inline')
  }

  const workflowActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorWorkflowActions.ts')
  const workflowActionsText = readFileSync(workflowActionsPath, 'utf8')
  if (!workflowActionsText.includes('graphRevision: readGraphDataRevision(subgraph)')) {
    throw new Error('expected workflow node export path to pass graph revision metadata into shared widget bundle export')
  }
  if (!workflowActionsText.includes('graphRevision: readGraphDataRevision(draft)')) {
    throw new Error('expected workflow bundle export path to pass graph revision metadata into shared widget bundle export')
  }

  const widgetImportPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'io', 'widgetImport.ts')
  const widgetImportText = readFileSync(widgetImportPath, 'utf8')
  if (!widgetImportText.includes('writeWidgetRegistryMetadata(')) {
    throw new Error('expected widget bundle import path to reuse the shared widget-registry metadata writer')
  }
  if (widgetImportText.includes('FLOW_WIDGET_REGISTRY_METADATA_KEY')) {
    throw new Error('expected widget bundle import path to stop attaching widget-registry metadata inline')
  }
}
