import type { GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { parseMarkdownSigil } from '@/features/markdown/ui/markdownSigil'
import {
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  getFlowEditorSmartWidgetLabel,
} from '@/lib/config.flow-editor'
import { getTextGenerationWidgetLabel, getWidgetRegistryEntryLabel } from '@/features/flow-editor-manager/registryTemplates'
import { isGrabMapsDiscoveryWidgetEntry } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import {
  resolveNodeWidgetIdentity,
} from '@/features/flow-editor-manager/resolveWidgetRegistry'

const normalizeWidgetLabelText = (raw: unknown): string => {
  const source = String(raw || '').trim()
  if (!source) return ''
  const sigil = parseMarkdownSigil(source)
  if (sigil && String(sigil.text || '').trim()) return String(sigil.text || '').trim()
  const unwrapped = source.startsWith('`') && source.endsWith('`') ? source.slice(1, -1).trim() : source
  return unwrapped
}

const readNodeData = (node: GraphNode): Record<string, unknown> => {
  const properties = (node.properties || null) as Record<string, unknown> | null
  const raw = properties && typeof properties.data === 'object' && properties.data !== null && !Array.isArray(properties.data)
    ? (properties.data as Record<string, unknown>)
    : null
  return raw || {}
}

function resolveSpecificWidgetTitle(args: {
  node: GraphNode
  registryEntry?: WidgetRegistryEntry | null
}): string | null {
  const properties = (args.node.properties || {}) as Record<string, unknown>
  const registryEntry = args.registryEntry || null
  const widgetIdentity = resolveNodeWidgetIdentity({ node: args.node, registryEntry })
  const nodeTypeId = String(registryEntry?.nodeTypeId || args.node.type || '').trim()
  if (registryEntry && isGrabMapsDiscoveryWidgetEntry(registryEntry)) {
    const registryLabel = getWidgetRegistryEntryLabel({
      nodeTypeId: registryEntry.nodeTypeId,
      widgetTypeId: registryEntry.widgetTypeId,
      formId: registryEntry.formId,
    })
    if (registryLabel) return registryLabel
  }
  if (nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
    return getTextGenerationWidgetLabel({
      provider: properties.chatProvider,
      widgetTypeId: widgetIdentity.widgetTypeId,
      formId: widgetIdentity.formId,
    })
  }
  if (nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
    return getFlowEditorSmartWidgetLabel({
      mode: 'image',
      model: properties.model,
    })
  }
  if (nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
    return getFlowEditorSmartWidgetLabel({
      mode: 'video',
      model: properties.model,
    })
  }
  if (nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
    return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
  }
  return null
}

export function resolveWidgetNodeTitle(args: {
  node: GraphNode
  graphMetaKind?: string | null
  registryEntry?: WidgetRegistryEntry | null
}): string {
  const node = args.node
  const fallback = normalizeWidgetLabelText(node.label) || String(node.id || '').trim() || 'Node'
  const specificTitle = resolveSpecificWidgetTitle(args)
  const genericFallbacks = new Set([
    '',
    String(node.id || '').trim(),
    FLOW_TEXT_GENERATION_NODE_LABEL,
    FLOW_IMAGE_GENERATION_NODE_LABEL,
    FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
    FLOW_VIDEO_GENERATION_NODE_LABEL,
  ])
  if (String(args.graphMetaKind || '').trim() !== 'frontmatter-flow') {
    return specificTitle && genericFallbacks.has(fallback) ? specificTitle : fallback
  }
  const data = readNodeData(node)
  const type = String(node.type || '').trim().toLowerCase()
  if (type === 'input') {
    const dataLabel = String(data.label || '').trim().toUpperCase()
    if (dataLabel === 'R') return 'Red'
    if (dataLabel === 'G') return 'Green'
    if (dataLabel === 'B') return 'Blue'
    if (dataLabel) return dataLabel
    return fallback
  }
  if (type === 'default') {
    if (/colorpreview/i.test(fallback)) return 'RGB'
    if (/lightness/i.test(fallback)) return 'LightDark'
    return fallback
  }
  if (type === 'output') {
    const reads = String(data.reads || '').trim().toLowerCase()
    if (reads.includes('.light')) return 'Light'
    if (reads.includes('.dark')) return 'Dark'
    if (/\blight\b/i.test(fallback)) return 'Light'
    if (/\bdark\b/i.test(fallback)) return 'Dark'
    return fallback
  }
  return fallback
}
