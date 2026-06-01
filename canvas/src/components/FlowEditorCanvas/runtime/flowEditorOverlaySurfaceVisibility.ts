import { filterGraphByExcludedNodeIds } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import type { GraphData } from '@/lib/graph/types'

type FrontmatterVisibleSceneDisplay = {
  displayNodes?: Array<{ id?: unknown }> | null
} | null

export type FrontmatterOverlayHideSafety = {
  kind: string
  visibleNodeIds: string[]
  hasFullOverlayCoverageForVisibleNodes: boolean
}

export function buildFrontmatterOverlayHideSafety(args: {
  renderGraphDataOverride: GraphData | null
  frontmatterVisibleSceneDisplay: FrontmatterVisibleSceneDisplay
  frontmatterRichMediaOverlayNodeIdsSnapshot: readonly string[]
  overlayEditorNodeIdsSnapshot: readonly string[]
  renderGraphEligibleNodeIds: ReadonlySet<string>
}): FrontmatterOverlayHideSafety {
  const {
    renderGraphDataOverride,
    frontmatterVisibleSceneDisplay,
    frontmatterRichMediaOverlayNodeIdsSnapshot,
    overlayEditorNodeIdsSnapshot,
    renderGraphEligibleNodeIds,
  } = args
  const kind = String(((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim()
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
  const overlayCoverageIdSet = new Set([
    ...overlayEditorNodeIdsSnapshot,
    ...frontmatterRichMediaOverlayNodeIdsSnapshot,
  ])
  const visibleFlowNodeIds = visibleNodeIds.filter(
    id => renderGraphEligibleNodeIds.size === 0 || renderGraphEligibleNodeIds.has(id),
  )

  return {
    kind,
    visibleNodeIds: visibleFlowNodeIds,
    hasFullOverlayCoverageForVisibleNodes: visibleFlowNodeIds.every(id => overlayCoverageIdSet.has(id)),
  }
}

export function resolveOverlayOnlyActive(args: {
  overlayVisibilityActive: boolean
  hasOverlayEditors: boolean
  geospatialWidgetPanelMode?: boolean
  frontmatterOverlayHideSafety: FrontmatterOverlayHideSafety
  workspaceMutationBlocked: boolean
}): boolean {
  const {
    overlayVisibilityActive,
    hasOverlayEditors,
    geospatialWidgetPanelMode,
    frontmatterOverlayHideSafety,
    workspaceMutationBlocked,
  } = args
  const baseActive = overlayVisibilityActive && (hasOverlayEditors || Boolean(geospatialWidgetPanelMode))
  if (!baseActive) return false
  if (geospatialWidgetPanelMode) return true

  if (frontmatterOverlayHideSafety.kind === 'frontmatter-flow') {
    // Frontmatter-flow Flow Editor scenes are overlay-owned. The FlowCanvas
    // runtime may still provide layout, pan, zoom, and edge geometry, but its
    // native nodes/edges must not become a visual fallback while overlays are
    // hydrating or workspace mutation is temporarily blocked.
    return true
  }
  if (workspaceMutationBlocked) {
    return false
  }
  return true
}

export function shouldSuppressFlowCanvasNativeSurface(args: {
  renderGraphDataOverride: GraphData | null
  overlayOnlyActive: boolean
  flowEditorFrontmatterGraphAvailable?: boolean
}): boolean {
  if (args.overlayOnlyActive) return true
  if (args.flowEditorFrontmatterGraphAvailable === true) return true
  return isFrontmatterFlowGraph(args.renderGraphDataOverride)
}

export function buildFlowCanvasGraphDataOverride(args: {
  renderGraphDataOverride: GraphData | null
  frontmatterOverlayHideSafety: FrontmatterOverlayHideSafety
  renderGraphPlacementContext: { isFrontmatterFlow?: boolean } | null | undefined
  overlayEditorNodeIdsSnapshot: readonly string[]
  overlayOnlyActive: boolean
}): GraphData | null {
  const {
    renderGraphDataOverride,
    frontmatterOverlayHideSafety,
    renderGraphPlacementContext,
    overlayEditorNodeIdsSnapshot,
    overlayOnlyActive,
  } = args
  if (!renderGraphDataOverride) return null

  const isFrontmatterFlow = frontmatterOverlayHideSafety.kind === 'frontmatter-flow'
  if (isFrontmatterFlow) {
    const useVisibleCoverageExclusion =
      renderGraphPlacementContext?.isFrontmatterFlow === true
      && frontmatterOverlayHideSafety.hasFullOverlayCoverageForVisibleNodes
    return filterGraphByExcludedNodeIds({
      graphData: renderGraphDataOverride,
      excludedNodeIds: useVisibleCoverageExclusion
        ? frontmatterOverlayHideSafety.visibleNodeIds
        : overlayEditorNodeIdsSnapshot,
    })
  }

  return filterGraphByExcludedNodeIds({
    graphData: renderGraphDataOverride,
    excludedNodeIds: overlayOnlyActive ? overlayEditorNodeIdsSnapshot : [],
  })
}
