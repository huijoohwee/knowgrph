import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphEdge } from '@/lib/graph/types'

import {
  DEFAULT_FIT_PADDING as SHARED_DEFAULT_FIT_PADDING,
  DEFAULT_FIT_TO_SCREEN_FILL_RATIO as SHARED_DEFAULT_FIT_TO_SCREEN_FILL_RATIO,
  DEFAULT_ZOOM_MAX_SCALE as SHARED_DEFAULT_ZOOM_MAX_SCALE,
  DEFAULT_ZOOM_MAX_SCALE_HARD_CAP as SHARED_DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
  DEFAULT_ZOOM_MIN_SCALE as SHARED_DEFAULT_ZOOM_MIN_SCALE,
} from 'grph-shared/zoom/presets'

export const DEFAULT_FIT_PADDING = SHARED_DEFAULT_FIT_PADDING
export const DEFAULT_FIT_TO_SCREEN_FILL_RATIO = SHARED_DEFAULT_FIT_TO_SCREEN_FILL_RATIO
export const DEFAULT_ZOOM_MIN_SCALE = SHARED_DEFAULT_ZOOM_MIN_SCALE
export const DEFAULT_ZOOM_MAX_SCALE = SHARED_DEFAULT_ZOOM_MAX_SCALE
export const DEFAULT_ZOOM_MAX_SCALE_HARD_CAP = SHARED_DEFAULT_ZOOM_MAX_SCALE_HARD_CAP
export const DEFAULT_LINK_DISTANCE = 120
export const DEFAULT_CHARGE = -450
export const DEFAULT_CENTER_STRENGTH = 1
export const DEFAULT_ALPHA_DECAY = 0.02

export const DEFAULT_BBOX_COLLIDE_PADDING = 10
export const DEFAULT_BBOX_COLLIDE_STRENGTH = 0.7
export const DEFAULT_BBOX_COLLIDE_ITERATIONS = 2

export const DEFAULT_GROUP_BBOX_COLLIDE_PADDING = DEFAULT_BBOX_COLLIDE_PADDING
export const DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH = DEFAULT_BBOX_COLLIDE_STRENGTH * 0.55
export const DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS = 3

export const DEFAULT_GROUPS_ENABLED = true
export const DEFAULT_GROUP_SHAPE: NonNullable<NonNullable<GraphSchema['layout']>['groups']>['shape'] = 'rect'
export const DEFAULT_GROUP_PADDING = 24
export const DEFAULT_GROUP_CORNER_RADIUS = 12
export const DEFAULT_GROUP_LABEL_PADDING = 10
export const DEFAULT_GROUP_STROKE_WIDTH = 1.5
export const DEFAULT_GROUP_FILL_OPACITY = 0.08

export const DEFAULT_STRATIFY_REUSE_SEED_STRENGTH = 0.75
export const DEFAULT_STRATIFY_FIT_FILL_RATIO = 0.8
export const DEFAULT_STRATIFY_SEPARATION = 1

export const readForceLinkDistance = (schema: GraphSchema, edge: Pick<GraphEdge, 'label'>): number => {
  const byLabel = schema.layout?.forces?.linkDistanceByLabel || null
  const label = typeof edge.label === 'string' ? edge.label : String(edge.label || '')
  const v = byLabel && label ? (byLabel as Record<string, unknown>)[label] : null
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_LINK_DISTANCE
}

export const readForceCharge = (schema: GraphSchema): number => {
  const v = schema.layout?.forces?.charge
  return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_CHARGE
}

export const readFitPadding = (schema: GraphSchema): number => {
  const padding = schema.layout?.fitPadding
  return typeof padding === 'number' && Number.isFinite(padding)
    ? Math.max(20, Math.min(160, Math.floor(padding)))
    : DEFAULT_FIT_PADDING
}

export const readZoomScaleExtent = (schema: GraphSchema): [number, number] => {
  const rawMin = schema.performance?.zoom?.minScale
  const rawMax = schema.performance?.zoom?.maxScale
  const min = typeof rawMin === 'number' && Number.isFinite(rawMin) && rawMin > 0 ? rawMin : DEFAULT_ZOOM_MIN_SCALE
  const max = typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax > 0 ? rawMax : DEFAULT_ZOOM_MAX_SCALE
  if (min <= max) return [min, max]
  return [max, min]
}
