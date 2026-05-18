import { isNodeOwnedFrontmatterWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, readWidgetRegistryMetadataEntries } from '@/lib/config.flow-editor'
import { buildNodeZKeyById, compareNodeZKey } from '@/lib/canvas/groupZOrder'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isCanonicalFrontmatterBuiltInWidgetNode } from '@/lib/flowEditor/widgetPlacementAuthority'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function hasFrontmatterDerivedCanonicalCollective(metadata: Record<string, unknown>): boolean {
  const frontmatterMeta = isRecord(metadata.frontmatterMeta) ? metadata.frontmatterMeta : null
  const directorBrief =
    (frontmatterMeta && isRecord(frontmatterMeta.director_brief) ? frontmatterMeta.director_brief : null)
    || (isRecord(metadata.director_brief) ? metadata.director_brief : null)
  const shots = directorBrief && Array.isArray(directorBrief.shots) ? directorBrief.shots : []
  return shots.length > 0
}

export function resolveGraphNodeIdByCanonicalId(graph: GraphData | null | undefined, rawId: unknown): string {
  return String(resolveGraphNodeByCanonicalId(graph, rawId)?.id || '').trim()
}

export function deriveFrontmatterFlowOverlayNodeIds(graphData: GraphData | null | undefined): string[] {
  if (!graphData || !isFrontmatterFlowGraph(graphData)) return []
  const metadata = ((graphData.metadata || {}) as Record<string, unknown>)
  const nodes = Array.isArray(graphData.nodes) ? (graphData.nodes as GraphNode[]) : []
  if (nodes.length === 0) return []

  const eligibleIds = buildFlowWidgetEligibleNodeIdSet(nodes)
  const nodeById = new Map<string, GraphNode>()
  const canonicalBuiltInNodeIds = new Set<string>()
  const nodeZKeyById = buildNodeZKeyById({ nodes, groups: [] })
  const compareNodeIdsByVisualIndex = (aId: string, bId: string): number => {
    if (!aId || !bId) return String(aId || '').localeCompare(String(bId || ''))
    if (aId === bId) return 0
    const aKey = nodeZKeyById.get(aId)
    const bKey = nodeZKeyById.get(bId)
    if (aKey && bKey) return compareNodeZKey(aKey, bKey)
    if (aKey || bKey) return aKey ? -1 : 1
    return aId.localeCompare(bId)
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    nodeById.set(id, n)
  }

  const frontmatterMeta = isRecord(metadata.frontmatterMeta) ? metadata.frontmatterMeta : null
  const widgetBundle = frontmatterMeta && isRecord(frontmatterMeta.widget_bundle) ? frontmatterMeta.widget_bundle : null
  const widgetBundleGraph = widgetBundle && isRecord(widgetBundle.graph) ? widgetBundle.graph : null
  const widgetBundleNodeIds = Array.isArray(widgetBundleGraph?.nodes_ref)
    ? widgetBundleGraph.nodes_ref
        .map(id => pickString(id))
        .filter(Boolean)
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .filter(id => {
          const node = nodeById.get(id)
          if (!node) return false
          if (String(node?.type || '') === 'Section') return false
          return true
        })
    : []
  if (widgetBundleNodeIds.length > 0) {
    if (!hasFrontmatterDerivedCanonicalCollective(metadata)) {
      return widgetBundleNodeIds.sort(compareNodeIdsByVisualIndex)
    }
    const mergedOverlayIds = new Set<string>(widgetBundleNodeIds)
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const id = String(node?.id || '').trim()
      if (!id) continue
      if (!isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
      mergedOverlayIds.add(id)
    }
    return Array.from(mergedOverlayIds).sort(compareNodeIdsByVisualIndex)
  }

  const registry = readWidgetRegistryMetadataEntries(metadata)
  const allowedFlowNodeIds = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id) continue
    if (!isCanonicalFrontmatterBuiltInWidgetNode(n)) continue
    canonicalBuiltInNodeIds.add(id)
    allowedFlowNodeIds.add(id)
  }
  for (let i = 0; i < registry.length; i += 1) {
    const entry = registry[i]
    const formId = typeof entry?.formId === 'string' ? String(entry.formId).trim() : ''
    if (!formId || !formId.startsWith('fm:')) continue
    const nodeId = formId.slice('fm:'.length).trim()
    if (!nodeId) continue
    const node = nodeById.get(nodeId)
    if (!node || !isCanonicalFrontmatterBuiltInWidgetNode(node)) continue
    if (!isNodeOwnedFrontmatterWidgetRegistryEntry({ node, registryEntry: { formId } })) continue
    allowedFlowNodeIds.add(nodeId)
  }
  if (allowedFlowNodeIds.size === 0 && canonicalBuiltInNodeIds.size === 0) {
    for (const id of eligibleIds) allowedFlowNodeIds.add(id)
  }
  if (allowedFlowNodeIds.size === 0) return []

  const next: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = String(n?.id || '').trim()
    if (!id || seen.has(id)) continue
    if (String(n?.type || '') === 'Section') continue
    if (!allowedFlowNodeIds.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next.sort(compareNodeIdsByVisualIndex)
}

export function isFrontmatterRichMediaPanelNode(node: GraphNode | null | undefined): boolean {
  return String(node?.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}
