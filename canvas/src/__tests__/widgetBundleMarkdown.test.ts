import { tryBuildWidgetBundleMarkdownFromJsonText } from '@/lib/graph/io/widgetBundle'
import { FLOW_WIDGET_BUNDLE_KIND, FLOW_WIDGET_BUNDLE_VERSION } from '@/lib/config'

export function testWidgetBundleMarkdownIncludesRegistryAndGraphTables() {
  const text = JSON.stringify({
    kind: FLOW_WIDGET_BUNDLE_KIND,
    version: FLOW_WIDGET_BUNDLE_VERSION,
    registry: [
      { id: 'qer1', nodeTypeId: 'ImageGeneration', widgetTypeId: 'default', formId: 'imageGeneration', isEnabled: true },
      { id: 'qer2', nodeTypeId: 'VideoGeneration', widgetTypeId: 'default', formId: 'videoGeneration', isEnabled: true },
    ],
    graph: {
      type: 'application/json',
      nodes: [
        { id: 'n1', label: 'Image Widget 1', type: 'ImageGeneration', x: 10, y: 20 },
        { id: 'n6', label: 'Video Widget 3', type: 'VideoGeneration', x: 60, y: 70 },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n6', label: 'linksTo', type: 'Edge' },
      ],
    },
  })
  const markdown = tryBuildWidgetBundleMarkdownFromJsonText(text)
  if (!markdown) throw new Error('expected widget bundle markdown to be generated')
  if (!markdown.includes('## Registry')) throw new Error('expected widget bundle markdown to include registry section')
  if (!markdown.includes('| qer1 | ImageGeneration | default | imageGeneration | true |')) {
    throw new Error('expected widget bundle markdown registry table to include qer1 row')
  }
  if (!markdown.includes('## Graph Nodes')) throw new Error('expected widget bundle markdown to include graph nodes section')
  if (!markdown.includes('| n1 | Image Widget 1 | ImageGeneration | 10 | 20 |')) {
    throw new Error('expected widget bundle markdown graph nodes table to include n1 row')
  }
  if (!markdown.includes('| n6 | Video Widget 3 | VideoGeneration | 60 | 70 |')) {
    throw new Error('expected widget bundle markdown graph nodes table to include n6 row')
  }
  if (!markdown.includes('## Graph Edges')) throw new Error('expected widget bundle markdown to include graph edges section')
  if (!markdown.includes('| e1 | n1 | n6 | linksTo | Edge |')) {
    throw new Error('expected widget bundle markdown graph edges table to include e1 row')
  }
}
