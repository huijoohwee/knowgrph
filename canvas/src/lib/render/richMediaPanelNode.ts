import type { GraphData, GraphNode } from '@/lib/graph/types'
import { FLOW_RICH_MEDIA_PANEL_NODE_LABEL, FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/flowEditor/richMediaPanelConfig'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'

export function isRichMediaPanelNode(node: GraphNode | null | undefined): boolean {
  return String(node?.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}

export function resolvePreferredRichMediaPanelNodeId(args: {
  graphData: GraphData | null | undefined
  selectedNodeId?: string | null
  selectedNodeIds?: readonly string[]
  openWidgetNodeIds?: readonly string[]
  flowEditorOpenWidgetNodeIds?: readonly string[]
  nodeById?: ReadonlyMap<string, GraphNode> | null | undefined
}): string {
  const graphData = args.graphData
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  if (nodes.length === 0) return ''
  const nodeById = args.nodeById || new Map(nodes.map(node => [String(node?.id || '').trim(), node] as const))

  const pickFromIds = (ids: readonly string[] | null | undefined): string => {
    if (!Array.isArray(ids) || ids.length === 0) return ''
    for (let i = 0; i < ids.length; i += 1) {
      const id = String(resolveGraphNodeByCanonicalId(graphData, ids[i])?.id || ids[i] || '').trim()
      if (!id) continue
      if (isRichMediaPanelNode(nodeById.get(id))) return id
    }
    return ''
  }

  const selectedPrimary = String(resolveGraphNodeByCanonicalId(graphData, args.selectedNodeId)?.id || args.selectedNodeId || '').trim()
  if (selectedPrimary && isRichMediaPanelNode(nodeById.get(selectedPrimary))) return selectedPrimary

  const selectedMulti = pickFromIds(args.selectedNodeIds)
  if (selectedMulti) return selectedMulti

  const flowEditorOpenWidget = pickFromIds(args.flowEditorOpenWidgetNodeIds)
  if (flowEditorOpenWidget) return flowEditorOpenWidget

  const openWidget = pickFromIds(args.openWidgetNodeIds)
  if (openWidget) return openWidget

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isRichMediaPanelNode(node)) continue
    const id = String(node?.id || '').trim()
    if (id) return id
  }
  return ''
}

export function getRichMediaPanelNodeLabel(): string {
  return FLOW_RICH_MEDIA_PANEL_NODE_LABEL
}
