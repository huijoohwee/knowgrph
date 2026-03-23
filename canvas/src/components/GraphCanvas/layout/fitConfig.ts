import type { FitAllTransformOptions } from '@/components/GraphCanvas/fit'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_FIT_PADDING,
  DEFAULT_FIT_TO_SCREEN_FILL_RATIO,
  DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
  DEFAULT_ZOOM_MIN_SCALE_HARD_CAP,
  readZoomScaleExtent,
} from '@/lib/graph/layoutDefaults'

import { clampFillRatio } from 'grph-shared/zoom/presets'

import { readLayoutMode2d, type LayoutMode2d } from '@/lib/graph/layoutMode'

export type LayoutMode = LayoutMode2d

export const readLayoutMode = (schema: GraphSchema): LayoutMode => {
  return readLayoutMode2d(schema)
}

export function readFitAllOptions(args: {
  schema: GraphSchema
  mode: LayoutMode
  intent: 'fitToScreen' | 'initialFit' | 'fitToView' | 'fitSelection'
  targetFillRatioOverride?: number
}): FitAllTransformOptions {
  const { schema } = args
  const padding = schema.layout?.fitPadding
  const detectClusters = schema.layout?.fitDetectClusters
  const targetAspectRatio = schema.layout?.fitTargetAspectRatio
  const enforceAspectRatio = schema.layout?.fitEnforceAspectRatio

  const pad =
    typeof padding === 'number' && Number.isFinite(padding)
      ? Math.max(20, Math.min(160, Math.floor(padding)))
      : DEFAULT_FIT_PADDING

  const [minScale, maxScale] = readZoomScaleExtent(schema)
  const detectClustersEffective =
    args.intent === 'fitToScreen' || args.intent === 'initialFit' ? detectClusters !== false : false
  const targetFillRatio =
    typeof args.targetFillRatioOverride === 'number' && Number.isFinite(args.targetFillRatioOverride)
      ? clampFillRatio(args.targetFillRatioOverride)
      : DEFAULT_FIT_TO_SCREEN_FILL_RATIO
  const minScaleEffective = args.intent === 'fitToView' ? Math.min(minScale, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP) : minScale
  const nodePadding = (schema.layout as unknown as { nodePadding?: number })?.nodePadding
  const nodePaddingEffective = typeof nodePadding === 'number' && Number.isFinite(nodePadding) ? Math.max(0, nodePadding) : 12

  return {
    pad,
    centerMode: args.intent === 'fitToScreen' ? 'bbox' : 'centroid',
    detectClusters: detectClustersEffective,
    targetAspectRatio: typeof targetAspectRatio === 'number' && Number.isFinite(targetAspectRatio) ? targetAspectRatio : undefined,
    enforceAspectRatio: enforceAspectRatio !== false,
    targetFillRatio,
    minScale: minScaleEffective,
    maxScale,
    maxScaleHardCap: DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
    schema,
    nodePadding: nodePaddingEffective,
    includeGroupsBounds: true,
  }
}
