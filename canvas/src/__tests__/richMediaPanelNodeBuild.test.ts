import { buildRichMediaPanelNode } from '@/lib/render/richMediaPanelNode'
import { FLOW_RICH_MEDIA_PANEL_NODE_LABEL, FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/storyboardWidget/richMediaPanelConfig'

export const testBuildRichMediaPanelNodeUsesDefaults = () => {
  const node = buildRichMediaPanelNode({ id: 'p-test' })
  if (node.id !== 'p-test') throw new Error('expected id to be preserved')
  if (String(node.type || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) throw new Error('expected RichMediaPanel node type')
  if (String(node.label || '').trim() !== FLOW_RICH_MEDIA_PANEL_NODE_LABEL) throw new Error('expected default Rich Media Panel label')
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error('expected finite node coordinates')
  if (node.x !== 520) throw new Error(`expected default x to be 520, got ${String(node.x)}`)
  if (node.y !== 0) throw new Error(`expected default y to be 0, got ${String(node.y)}`)
  const props = (node.properties || {}) as Record<string, unknown>
  if (props.media_interactive !== true) throw new Error('expected media_interactive=true')
}

export const testBuildRichMediaPanelNodeOffsetsFromAnchor = () => {
  const node = buildRichMediaPanelNode({ id: 'p-test', anchor: { id: 'a', type: 'Any', label: 'A', x: 10, y: 20, properties: {} } })
  if (node.x !== 530) throw new Error(`expected x to offset anchor by 520, got ${String(node.x)}`)
  if (node.y !== 20) throw new Error(`expected y to match anchor, got ${String(node.y)}`)
}

