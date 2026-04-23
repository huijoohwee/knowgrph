import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_WIDGET_FORM_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { FLOW_WIDGET_REGISTRY_METADATA_KEY } from '@/lib/config'

export function testFrontmatterFlowWidgetsConnectToRichMediaPanelPorts() {
  const md = [
    '---',
    'flow:',
    '  nodes:',
    '    - id: {key: id, type: string, value: "w-openai-text"}',
    '      type: {key: type, type: string, value: "TextGeneration"}',
    '      label: {key: label, type: string, value: "OpenAI Text Widget"}',
    '      handles: {key: handles, type: object, value: {target: ["prompt_in"], source: ["text_out"]}}',
    '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "textGeneration.openai"}',
    '      chatProvider: {key: chatProvider, type: string, value: "openai"}',
    '      chatModel: {key: chatModel, type: string, value: "gpt-5.4-nano"}',
    '      prompt: {key: prompt, type: string, value: "hello"}',
    '    - id: {key: id, type: string, value: "w-seedream-image"}',
    '      type: {key: type, type: string, value: "ImageGeneration"}',
    '      label: {key: label, type: string, value: "Seedream Image Widget"}',
    '      handles: {key: handles, type: object, value: {target: ["reference_image"], source: ["imageUrl"]}}',
    '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "imageGeneration"}',
    '      model: {key: model, type: string, value: "seedream-5.0-lite"}',
    '      prompt: {key: prompt, type: string, value: "image"}',
    '    - id: {key: id, type: string, value: "w-seedance-video"}',
    '      type: {key: type, type: string, value: "VideoGeneration"}',
    '      label: {key: label, type: string, value: "Seedance Video Widget"}',
    '      handles: {key: handles, type: object, value: {target: ["reference_image"], source: ["videoUrl"]}}',
    '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "videoGeneration"}',
    '      model: {key: model, type: string, value: "seedance-2.0"}',
    '      prompt: {key: prompt, type: string, value: "video"}',
    '    - id: {key: id, type: string, value: "p-rich-media"}',
    '      type: {key: type, type: string, value: "RichMediaPanel"}',
    '      label: {key: label, type: string, value: "Rich Media Panel"}',
    '      handles: {key: handles, type: object, value: {target: ["output","imageUrl","videoUrl"], source: []}}',
    '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "richMediaPanel"}',
    '  edges:',
    '    - { id: e1, source: w-openai-text, sourceHandle: text_out, target: p-rich-media, targetHandle: output, animated: true }',
    '    - { id: e2, source: w-seedream-image, sourceHandle: imageUrl, target: p-rich-media, targetHandle: imageUrl, animated: true }',
    '    - { id: e3, source: w-seedance-video, sourceHandle: videoUrl, target: p-rich-media, targetHandle: videoUrl, animated: true }',
    '---',
    '',
    '# Body',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('rich-media-panel-widget-flow.md', md)
  if (!res) throw new Error('expected parse result')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')

  const nodeById = new Map((g.nodes || []).map(n => [String(n.id || ''), n]))
  const panel = nodeById.get('p-rich-media')
  if (!panel) throw new Error('expected p-rich-media node')
  if (String(panel.type || '') !== 'RichMediaPanel') throw new Error('expected RichMediaPanel type')

  const props = (panel.properties || {}) as Record<string, unknown>
  if (String(props[FLOW_WIDGET_FORM_ID_KEY] || '') !== 'richMediaPanel') throw new Error('expected richMediaPanel form id')

  const edgeById = new Map((g.edges || []).map(e => [String(e.id || ''), e]))
  const e1 = edgeById.get('e1')
  const e2 = edgeById.get('e2')
  const e3 = edgeById.get('e3')
  if (!e1 || !e2 || !e3) throw new Error('expected 3 edges')
  const e1Props = (e1.properties || {}) as Record<string, unknown>
  const e2Props = (e2.properties || {}) as Record<string, unknown>
  const e3Props = (e3.properties || {}) as Record<string, unknown>
  if (String(e1Props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'text_out') throw new Error('expected e1 text_out source')
  if (String(e1Props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'output') throw new Error('expected e1 output target')
  if (String(e2Props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'imageUrl') throw new Error('expected e2 imageUrl source')
  if (String(e2Props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'imageUrl') throw new Error('expected e2 imageUrl target')
  if (String(e3Props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== 'videoUrl') throw new Error('expected e3 videoUrl source')
  if (String(e3Props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== 'videoUrl') throw new Error('expected e3 videoUrl target')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_WIDGET_REGISTRY_METADATA_KEY]
  if (Array.isArray(registry) && registry.some(r => String((r as { formId?: unknown })?.formId || '').includes('textGeneration.openai'))) {
    throw new Error('expected widget seed formIds to come from global registry, not document registry')
  }
}
