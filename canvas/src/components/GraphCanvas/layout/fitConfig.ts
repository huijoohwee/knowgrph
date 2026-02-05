import type { FitAllTransformOptions } from '@/components/GraphCanvas/fit'
import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_FIT_PADDING,
  DEFAULT_FIT_TO_SCREEN_FILL_RATIO,
  DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
  DEFAULT_ZOOM_MIN_SCALE_HARD_CAP,
  readZoomScaleExtent,
} from '@/lib/graph/layoutDefaults'

import { readLayoutMode2d, type LayoutMode2d } from '@/lib/graph/layoutMode'

import { ZOOM_VIEWPORT_PRESET_16_9 } from 'grph-shared/zoom/presets'

export type LayoutMode = LayoutMode2d

export const readLayoutMode = (schema: GraphSchema): LayoutMode => {
  return readLayoutMode2d(schema)
}

export function readFitAllOptions(args: {
  schema: GraphSchema
  mode: LayoutMode
  intent: 'fitToScreen' | 'initialFit' | 'fitToView' | 'fitSelection'
}): FitAllTransformOptions {
  const { schema, mode } = args
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
  const targetFillRatio = DEFAULT_FIT_TO_SCREEN_FILL_RATIO
  const minScaleEffective = args.intent === 'fitToView' ? Math.min(minScale, DEFAULT_ZOOM_MIN_SCALE_HARD_CAP) : minScale

  return {
    pad,
    useCentroidCentering: true,
    detectClusters: detectClustersEffective,
    targetAspectRatio: typeof targetAspectRatio === 'number' && Number.isFinite(targetAspectRatio) ? targetAspectRatio : ZOOM_VIEWPORT_PRESET_16_9.aspectRatio,
    enforceAspectRatio: enforceAspectRatio !== false,
    targetFillRatio,
    minScale: minScaleEffective,
    maxScale,
    maxScaleHardCap: DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
    schema,
  }
}
