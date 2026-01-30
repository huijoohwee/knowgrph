import type { FitAllTransformOptions } from '@/components/GraphCanvas/fit'
import type { GraphSchema } from '@/lib/graph/schema'
import { DEFAULT_FIT_PADDING, DEFAULT_STRATIFY_FIT_FILL_RATIO } from '@/lib/graph/layoutDefaults'

export type LayoutMode = NonNullable<NonNullable<GraphSchema['layout']>['mode']>

export const readLayoutMode = (schema: GraphSchema): LayoutMode => {
  const m = schema.layout?.mode
  return m === 'radial' || m === 'stratify' ? m : 'force'
}

export function readFitAllOptions(args: {
  schema: GraphSchema
  mode: LayoutMode
  intent: 'fitToScreen' | 'initialFit'
}): FitAllTransformOptions {
  const { schema, mode } = args
  const padding = schema.layout?.fitPadding
  const useCentroid = schema.layout?.fitUseCentroid
  const detectClusters = schema.layout?.fitDetectClusters
  const targetAspectRatio = schema.layout?.fitTargetAspectRatio
  const enforceAspectRatio = schema.layout?.fitEnforceAspectRatio

  const pad =
    typeof padding === 'number' && Number.isFinite(padding)
      ? Math.max(20, Math.min(160, Math.floor(padding)))
      : DEFAULT_FIT_PADDING

  const stratifyFillRaw = schema.layout?.stratify?.fitFillRatio
  const stratifyFill =
    typeof stratifyFillRaw === 'number' && Number.isFinite(stratifyFillRaw)
      ? Math.max(0.2, Math.min(0.95, stratifyFillRaw))
      : DEFAULT_STRATIFY_FIT_FILL_RATIO

  return {
    pad,
    useCentroidCentering: useCentroid !== false,
    detectClusters: detectClusters !== false,
    targetAspectRatio: typeof targetAspectRatio === 'number' && Number.isFinite(targetAspectRatio) ? targetAspectRatio : 1.777,
    enforceAspectRatio: enforceAspectRatio !== false,
    targetFillRatio: mode === 'stratify' ? stratifyFill : undefined,
    schema,
  }
}
