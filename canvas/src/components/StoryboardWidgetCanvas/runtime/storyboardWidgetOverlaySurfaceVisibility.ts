import { filterGraphByExcludedNodeIds } from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import { getCanvas2dSurfaceId, isStoryboardCanvas2dRenderer, resolveCanvas2dRendererId } from '@/lib/config.render'
import { buildCanonicalNodeIdSet, canonicalNodeIdSetHas } from '@/lib/graph/canonicalNodeIds'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import type { GraphData } from '@/lib/graph/types'

type FrontmatterVisibleSceneDisplay = {
  displayNodes?: Array<{ id?: unknown }> | null
} | null

export type FrontmatterOverlayVisualIsolation = {
  kind: string
  visibleNodeIds: string[]
  hasFullOverlayCoverageForVisibleNodes: boolean
}

export function buildFrontmatterOverlayVisualIsolation(args: {
  renderGraphDataOverride: GraphData | null
  frontmatterVisibleSceneDisplay: FrontmatterVisibleSceneDisplay
  frontmatterRichMediaOverlayNodeIdsSnapshot: readonly string[]
  overlayEditorNodeIdsSnapshot: readonly string[]
  renderGraphEligibleNodeIds: ReadonlySet<string>
}): FrontmatterOverlayVisualIsolation {
  const {
    renderGraphDataOverride,
    frontmatterVisibleSceneDisplay,
    frontmatterRichMediaOverlayNodeIdsSnapshot,
    overlayEditorNodeIdsSnapshot,
    renderGraphEligibleNodeIds,
  } = args
  const kind = isFrontmatterFlowGraph(renderGraphDataOverride)
    ? 'frontmatter-flow'
    : String(((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim()
  if (kind !== 'frontmatter-flow') {
    return {
      kind,
      visibleNodeIds: [],
      hasFullOverlayCoverageForVisibleNodes: true,
    }
  }

  const visibleNodeIds = Array.isArray(frontmatterVisibleSceneDisplay?.displayNodes)
    ? frontmatterVisibleSceneDisplay.displayNodes.map(node => String(node?.id || '').trim()).filter(Boolean)
    : []
  const overlayCoverageIdSet = buildCanonicalNodeIdSet([
    ...overlayEditorNodeIdsSnapshot,
    ...frontmatterRichMediaOverlayNodeIdsSnapshot,
  ])
  const visibleFlowNodeIds = visibleNodeIds.filter(
    id => renderGraphEligibleNodeIds.size === 0 || canonicalNodeIdSetHas(renderGraphEligibleNodeIds, id),
  )

  return {
    kind,
    visibleNodeIds: visibleFlowNodeIds,
    hasFullOverlayCoverageForVisibleNodes: visibleFlowNodeIds.every(id => canonicalNodeIdSetHas(overlayCoverageIdSet, id)),
  }
}

export function resolveOverlayOnlyActive(args: {
  overlayVisibilityActive: boolean
  hasOverlayEditors: boolean
  geospatialWidgetPanelMode?: boolean
  frontmatterOverlayVisualIsolation: FrontmatterOverlayVisualIsolation
  workspaceMutationBlocked: boolean
}): boolean {
  const {
    overlayVisibilityActive,
    hasOverlayEditors,
    geospatialWidgetPanelMode,
    frontmatterOverlayVisualIsolation,
    workspaceMutationBlocked,
  } = args
  const baseActive = overlayVisibilityActive && (hasOverlayEditors || Boolean(geospatialWidgetPanelMode))
  if (!baseActive) return false
  if (geospatialWidgetPanelMode) return true

  if (frontmatterOverlayVisualIsolation.kind === 'frontmatter-flow') {
    // Frontmatter-flow Storyboard Widget scenes are partitioned before FlowCanvas
    // receives a graph, so native nodes/edges cannot become a sibling visual
    // fallback while overlays are hydrating or workspace mutation is blocked.
    return true
  }
  if (workspaceMutationBlocked) {
    return false
  }
  return true
}

function listFrontmatterFlowOwnedRenderNodeIds(graphData: GraphData | null | undefined): string[] {
  if (!Array.isArray(graphData?.nodes)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const id = String(graphData.nodes[i]?.id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readDeclaredCanvas2dRenderer(graphData: GraphData | null | undefined): ReturnType<typeof resolveCanvas2dRendererId> {
  const metadata = readRecord(graphData?.metadata)
  const frontmatterMeta = readRecord(metadata?.frontmatterMeta)
  return (
    resolveCanvas2dRendererId(frontmatterMeta?.kgCanvas2dRenderer)
    || resolveCanvas2dRendererId(metadata?.kgCanvas2dRenderer)
  )
}

function shouldPartitionForeignRendererGraphFromFlowCanvas(graphData: GraphData | null | undefined): boolean {
  if (!graphData || isFrontmatterFlowGraph(graphData)) return false
  const renderer = readDeclaredCanvas2dRenderer(graphData)
  if (!renderer) return false
  if (isStoryboardCanvas2dRenderer(renderer)) return false
  const surface = getCanvas2dSurfaceId(renderer)
  return surface !== 'flow'
}

export function buildFlowCanvasGraphDataOverride(args: {
  renderGraphDataOverride: GraphData | null
  frontmatterOverlayVisualIsolation: FrontmatterOverlayVisualIsolation
  overlayEditorNodeIdsSnapshot: readonly string[]
  overlayOnlyActive: boolean
}): GraphData | null {
  const {
    renderGraphDataOverride,
    frontmatterOverlayVisualIsolation,
    overlayEditorNodeIdsSnapshot,
    overlayOnlyActive,
  } = args
  if (!renderGraphDataOverride) return null

  const isFrontmatterFlow = frontmatterOverlayVisualIsolation.kind === 'frontmatter-flow'
  if (isFrontmatterFlow) {
    const renderGraphNodeIds = listFrontmatterFlowOwnedRenderNodeIds(renderGraphDataOverride)
    const frontmatterFlowOwnedNodeIds = renderGraphNodeIds.length > 0
      ? renderGraphNodeIds
      : overlayEditorNodeIdsSnapshot
    return filterGraphByExcludedNodeIds({
      graphData: renderGraphDataOverride,
      excludedNodeIds: frontmatterFlowOwnedNodeIds,
    })
  }
  if (shouldPartitionForeignRendererGraphFromFlowCanvas(renderGraphDataOverride)) {
    return filterGraphByExcludedNodeIds({
      graphData: renderGraphDataOverride,
      excludedNodeIds: listFrontmatterFlowOwnedRenderNodeIds(renderGraphDataOverride),
    })
  }

  return filterGraphByExcludedNodeIds({
    graphData: renderGraphDataOverride,
    excludedNodeIds: overlayOnlyActive ? overlayEditorNodeIdsSnapshot : [],
  })
}
