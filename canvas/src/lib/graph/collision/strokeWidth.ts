import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { computeGroupDepthStyle } from '@/lib/graph/groupDepthStyle'
import { DEFAULT_GROUP_FILL_OPACITY, DEFAULT_GROUP_STROKE_WIDTH } from '@/lib/graph/layoutDefaults'

export const readNodeStrokeWidthPx = (schema: GraphSchema, node: GraphNode): number => {
  const w = schema.nodeStroke?.[node.type]?.width
  if (typeof w === 'number' && Number.isFinite(w) && w >= 0) return w
  return 1.5
}

export const readGroupStrokeWidthPx = (schema: GraphSchema, depth: number, maxDepth: number): number => {
  const baseStrokeWidthRaw = schema.layout?.groups?.strokeWidth
  const baseStrokeWidth =
    typeof baseStrokeWidthRaw === 'number' && Number.isFinite(baseStrokeWidthRaw) ? Math.max(0, baseStrokeWidthRaw) : DEFAULT_GROUP_STROKE_WIDTH
  const baseFillOpacityRaw = schema.layout?.groups?.fillOpacity
  const baseFillOpacity =
    typeof baseFillOpacityRaw === 'number' && Number.isFinite(baseFillOpacityRaw)
      ? Math.max(0, Math.min(0.35, baseFillOpacityRaw))
      : DEFAULT_GROUP_FILL_OPACITY
  const depthCfg = schema.layout?.groups?.depthStyle || null
  return computeGroupDepthStyle({
    depth,
    maxDepth,
    baseStrokeWidthPx: baseStrokeWidth,
    baseFillOpacity,
    config: depthCfg,
  }).strokeWidthPx
}

