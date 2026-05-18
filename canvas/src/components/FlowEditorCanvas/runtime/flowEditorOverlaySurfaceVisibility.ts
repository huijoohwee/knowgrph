import { filterGraphByExcludedNodeIds } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
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
  workspaceEditorOverlayOpen: boolean
}): boolean {
  const {
    overlayVisibilityActive,
    hasOverlayEditors,
    geospatialWidgetPanelMode,
    frontmatterOverlayHideSafety,
    workspaceMutationBlocked,
    workspaceEditorOverlayOpen,
  } = args
  const baseActive = overlayVisibilityActive && (hasOverlayEditors || Boolean(geospatialWidgetPanelMode))
  if (!baseActive) return false
  if (geospatialWidgetPanelMode) return true

  const frontmatterOverlayCoverageReady =
    frontmatterOverlayHideSafety.kind === 'frontmatter-flow'
    && frontmatterOverlayHideSafety.hasFullOverlayCoverageForVisibleNodes

  if (workspaceMutationBlocked) {
    // Frontmatter scenes already route visible nodes through overlays when coverage is complete.
    return frontmatterOverlayCoverageReady
  }
  if (workspaceEditorOverlayOpen) {
    // Keep overlays authoritative so widget/rich-media anchors and overlay-edge routing stay live.
    return frontmatterOverlayCoverageReady
  }
  if (frontmatterOverlayHideSafety.kind === 'frontmatter-flow') return frontmatterOverlayCoverageReady
  return true
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
