import type { MutableRefObject } from 'react'

import {
  type FrontmatterOverlayHideSafety,
  buildFrontmatterOverlayHideSafety,
} from '@/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceVisibility'
import { hashScopedStringArraySignature, hashSignatureParts } from '@/lib/hash/signature'
import type { GraphData } from '@/lib/graph/types'

type FrontmatterVisibleSceneDisplay = Parameters<typeof buildFrontmatterOverlayHideSafety>[0]['frontmatterVisibleSceneDisplay']

export type FrontmatterOverlayOnlyCoverageCache = {
  graphKey: string
  key: string
  value: FrontmatterOverlayHideSafety
}

export function resolveFrontmatterOverlayHideSafetyWithStableCoverage(args: {
  frontmatterOverlayOnlyCoverageRef: MutableRefObject<FrontmatterOverlayOnlyCoverageCache | null>
  renderGraphDataOverride: GraphData | null
  frontmatterVisibleSceneDisplay: FrontmatterVisibleSceneDisplay
  frontmatterRichMediaOverlayNodeIdsSnapshot: readonly string[]
  overlayEditorNodeIdsSnapshot: readonly string[]
  renderGraphEligibleNodeIds: ReadonlySet<string>
  renderGraphSemanticKey: string
  workspaceMutationBlocked: boolean
}): FrontmatterOverlayHideSafety {
  const current = buildFrontmatterOverlayHideSafety({
    renderGraphDataOverride: args.renderGraphDataOverride,
    frontmatterVisibleSceneDisplay: args.frontmatterVisibleSceneDisplay,
    frontmatterRichMediaOverlayNodeIdsSnapshot: args.frontmatterRichMediaOverlayNodeIdsSnapshot,
    overlayEditorNodeIdsSnapshot: args.overlayEditorNodeIdsSnapshot,
    renderGraphEligibleNodeIds: args.renderGraphEligibleNodeIds,
  })
  if (current.kind !== 'frontmatter-flow') {
    args.frontmatterOverlayOnlyCoverageRef.current = null
    return current
  }

  const visibleFlowNodeIds = current.visibleNodeIds
  const key = hashSignatureParts([
    'frontmatter-overlay-only-coverage',
    args.renderGraphSemanticKey,
    hashScopedStringArraySignature('visible-flow-nodes', visibleFlowNodeIds),
    hashScopedStringArraySignature('overlay-editor-nodes', args.overlayEditorNodeIdsSnapshot),
    hashScopedStringArraySignature('rich-media-overlay-nodes', args.frontmatterRichMediaOverlayNodeIdsSnapshot),
  ])
  if (current.hasFullOverlayCoverageForVisibleNodes && visibleFlowNodeIds.length > 0) {
    args.frontmatterOverlayOnlyCoverageRef.current = { graphKey: args.renderGraphSemanticKey, key, value: current }
    return current
  }

  const lastFullCoverage = args.frontmatterOverlayOnlyCoverageRef.current
  if (
    args.workspaceMutationBlocked
    && lastFullCoverage?.graphKey === args.renderGraphSemanticKey
    && lastFullCoverage.value.hasFullOverlayCoverageForVisibleNodes
  ) {
    return lastFullCoverage.value
  }
  return current
}
