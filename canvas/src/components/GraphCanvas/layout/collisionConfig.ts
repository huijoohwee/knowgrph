import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_BBOX_COLLIDE_PADDING,
  DEFAULT_BBOX_COLLIDE_STRENGTH,
  DEFAULT_GROUP_COLLISION_BORDER_GAP_PX,
  DEFAULT_GROUP_COLLISION_TOUCH_EPSILON_PX,
  DEFAULT_NODE_COLLISION_BORDER_GAP_PX,
  DEFAULT_NODE_COLLISION_TOUCH_EPSILON_PX,
  DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS,
  DEFAULT_GROUP_BBOX_COLLIDE_PADDING,
  DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH,
} from '@/lib/graph/layoutDefaults'
import { readGroupBboxCollideExtraGapPx } from '@/lib/graph/collision/groupCollisionSpacing'

export type BboxCollideConfig = {
  enabled: boolean
  padding: number
  paddingX: number
  paddingY: number
  borderGapPx: number
  touchEpsilonPx: number
  strength: number
  iterations: number
}

export type GroupBboxCollideConfig = {
  enabled: boolean
  padding: number
  paddingX: number
  paddingY: number
  borderGapPx: number
  extraGapPx: number
  touchEpsilonPx: number
  strength: number
  iterations: number
}

export type CollisionConfig = {
  nodeBbox: BboxCollideConfig
  groupBbox: GroupBboxCollideConfig
}

const clampNonNegative = (v: unknown, fallback: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(0, v)
}

const clampPositiveInt = (v: unknown, fallback: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(1, Math.floor(v))
}

export function readCollisionConfig(schema: GraphSchema): CollisionConfig {
  const forces = (schema.layout?.forces || {}) as GraphSchema['layout']['forces'] & {
    bboxCollide?: boolean
    bboxCollideStrength?: number
    bboxCollidePadding?: number
    bboxCollidePaddingX?: number
    bboxCollidePaddingY?: number
    bboxCollideBorderGapPx?: number
    bboxCollideTouchEpsilonPx?: number
    bboxCollideIterations?: number
    groupBboxCollide?: boolean
    groupBboxCollideStrength?: number
    groupBboxCollidePadding?: number
    groupBboxCollidePaddingX?: number
    groupBboxCollidePaddingY?: number
    groupBboxCollideBorderGapPx?: number
    groupBboxCollideExtraGapPx?: number
    groupBboxCollideTouchEpsilonPx?: number
    groupBboxCollideIterations?: number
  }

  const nodeBboxEnabled = forces.bboxCollide !== false
  const nodeBboxPadding = clampNonNegative(forces.bboxCollidePadding, DEFAULT_BBOX_COLLIDE_PADDING)
  const nodeBboxPaddingX = clampNonNegative(forces.bboxCollidePaddingX, nodeBboxPadding)
  const nodeBboxPaddingY = clampNonNegative(forces.bboxCollidePaddingY, nodeBboxPadding)
  const nodeBboxBorderGapPx = clampNonNegative(forces.bboxCollideBorderGapPx, DEFAULT_NODE_COLLISION_BORDER_GAP_PX)
  const nodeBboxTouchEpsilonPx = clampNonNegative(
    forces.bboxCollideTouchEpsilonPx,
    DEFAULT_NODE_COLLISION_TOUCH_EPSILON_PX,
  )
  const nodeBboxStrength = clampNonNegative(forces.bboxCollideStrength, DEFAULT_BBOX_COLLIDE_STRENGTH)
  const nodeBboxIterations = clampPositiveInt(forces.bboxCollideIterations, DEFAULT_BBOX_COLLIDE_ITERATIONS)

  const groupsEnabled = schema.layout?.groups?.enabled !== false
  const groupBboxEnabled = groupsEnabled && forces.groupBboxCollide !== false
  const groupBboxPadding = clampNonNegative(forces.groupBboxCollidePadding, DEFAULT_GROUP_BBOX_COLLIDE_PADDING)
  const groupBboxPaddingX = clampNonNegative(forces.groupBboxCollidePaddingX, groupBboxPadding)
  const groupBboxPaddingY = clampNonNegative(forces.groupBboxCollidePaddingY, groupBboxPadding)
  const groupBboxBorderGapPx = Math.max(
    1,
    clampNonNegative(forces.groupBboxCollideBorderGapPx, DEFAULT_GROUP_COLLISION_BORDER_GAP_PX),
  )
  const groupBboxExtraGapPx = readGroupBboxCollideExtraGapPx({
    schema,
    collidePaddingPx: groupBboxPadding,
    borderGapMinPx: groupBboxBorderGapPx,
  })
  const groupBboxTouchEpsilonPx = clampNonNegative(
    forces.groupBboxCollideTouchEpsilonPx,
    DEFAULT_GROUP_COLLISION_TOUCH_EPSILON_PX,
  )
  const groupBboxStrengthRaw = clampNonNegative(forces.groupBboxCollideStrength, DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH)
  const groupBboxStrength = groupBboxEnabled ? Math.max(0.05, groupBboxStrengthRaw) : 0
  const groupBboxIterations = clampPositiveInt(forces.groupBboxCollideIterations, DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS)

  return {
    nodeBbox: {
      enabled: nodeBboxEnabled,
      padding: nodeBboxPadding,
      paddingX: nodeBboxPaddingX,
      paddingY: nodeBboxPaddingY,
      borderGapPx: nodeBboxBorderGapPx,
      touchEpsilonPx: nodeBboxTouchEpsilonPx,
      strength: nodeBboxStrength,
      iterations: nodeBboxIterations,
    },
    groupBbox: {
      enabled: groupBboxEnabled,
      padding: groupBboxPadding,
      paddingX: groupBboxPaddingX,
      paddingY: groupBboxPaddingY,
      borderGapPx: groupBboxBorderGapPx,
      extraGapPx: groupBboxExtraGapPx,
      touchEpsilonPx: groupBboxTouchEpsilonPx,
      strength: groupBboxStrength,
      iterations: groupBboxIterations,
    },
  }
}

export function readStructuredRelaxSteps(schema: GraphSchema, fallback: number): number {
  const forces = (schema.layout?.forces || {}) as GraphSchema['layout']['forces'] & { structuredRelaxSteps?: number }
  const v = forces.structuredRelaxSteps
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(40, Math.floor(v)))
}

export function readGroupLabelTopExtra(schema: GraphSchema): number {
  const labelPaddingRaw = schema.layout?.groups?.labelPadding
  const labelPadding = typeof labelPaddingRaw === 'number' && Number.isFinite(labelPaddingRaw) ? Math.max(0, labelPaddingRaw) : 10
  const baseFontSizeRaw = schema.labelStyles?.fontSize
  const baseFontSize = typeof baseFontSizeRaw === 'number' && Number.isFinite(baseFontSizeRaw) ? baseFontSizeRaw : 12
  const fontSize = Math.max(12, Math.min(24, baseFontSize + 10))
  return labelPadding + fontSize * 1.25
}
