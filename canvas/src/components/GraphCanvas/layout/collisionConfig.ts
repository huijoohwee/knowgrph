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
  zEnabled: boolean
  padding: number
  paddingX: number
  paddingY: number
  paddingZ: number
  borderGapPx: number
  touchEpsilonPx: number
  touchEpsilonXPx: number
  touchEpsilonYPx: number
  touchEpsilonZPx: number
  strength: number
  iterations: number
}

export type GroupBboxCollideConfig = {
  enabled: boolean
  zEnabled: boolean
  padding: number
  paddingX: number
  paddingY: number
  paddingZ: number
  borderGapPx: number
  extraGapPx: number
  extraGapZPx: number
  touchEpsilonPx: number
  touchEpsilonXPx: number
  touchEpsilonYPx: number
  touchEpsilonZPx: number
  nestedTouchEpsilonPx: number
  nestedTouchEpsilonXPx: number
  nestedTouchEpsilonYPx: number
  nestedTouchEpsilonZPx: number
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
    bboxCollidePaddingZ?: number
    bboxCollideBorderGapPx?: number
    bboxCollideTouchEpsilonPx?: number
    bboxCollideTouchEpsilonXPx?: number
    bboxCollideTouchEpsilonYPx?: number
    bboxCollideTouchEpsilonZPx?: number
    bboxCollideZEnabled?: boolean
    bboxCollideIterations?: number
    groupBboxCollide?: boolean
    groupBboxCollideStrength?: number
    groupBboxCollidePadding?: number
    groupBboxCollidePaddingX?: number
    groupBboxCollidePaddingY?: number
    groupBboxCollidePaddingZ?: number
    groupBboxCollideBorderGapPx?: number
    groupBboxCollideExtraGapPx?: number
    groupBboxCollideExtraGapZPx?: number
    groupBboxCollideTouchEpsilonPx?: number
    groupBboxCollideTouchEpsilonXPx?: number
    groupBboxCollideTouchEpsilonYPx?: number
    groupBboxCollideTouchEpsilonZPx?: number
    groupBboxCollideNestedTouchEpsilonPx?: number
    groupBboxCollideNestedTouchEpsilonXPx?: number
    groupBboxCollideNestedTouchEpsilonYPx?: number
    groupBboxCollideNestedTouchEpsilonZPx?: number
    groupBboxCollideZEnabled?: boolean
    groupBboxCollideIterations?: number
  }

  const nodeBboxEnabled = forces.bboxCollide !== false
  const nodeBboxZEnabled = forces.bboxCollideZEnabled === true
  const nodeBboxPadding = clampNonNegative(forces.bboxCollidePadding, DEFAULT_BBOX_COLLIDE_PADDING)
  const nodeBboxPaddingX = clampNonNegative(forces.bboxCollidePaddingX, nodeBboxPadding)
  const nodeBboxPaddingY = clampNonNegative(forces.bboxCollidePaddingY, nodeBboxPadding)
  const nodeBboxPaddingZ = clampNonNegative(forces.bboxCollidePaddingZ, nodeBboxPadding)
  const nodeBboxBorderGapPx = clampNonNegative(forces.bboxCollideBorderGapPx, DEFAULT_NODE_COLLISION_BORDER_GAP_PX)
  const nodeBboxTouchEpsilonPx = clampNonNegative(
    forces.bboxCollideTouchEpsilonPx,
    DEFAULT_NODE_COLLISION_TOUCH_EPSILON_PX,
  )
  const nodeBboxTouchEpsilonXPx = clampNonNegative(forces.bboxCollideTouchEpsilonXPx, nodeBboxTouchEpsilonPx)
  const nodeBboxTouchEpsilonYPx = clampNonNegative(forces.bboxCollideTouchEpsilonYPx, nodeBboxTouchEpsilonPx)
  const nodeBboxTouchEpsilonZPx = clampNonNegative(
    forces.bboxCollideTouchEpsilonZPx,
    nodeBboxTouchEpsilonPx,
  )
  const nodeBboxStrength = clampNonNegative(forces.bboxCollideStrength, DEFAULT_BBOX_COLLIDE_STRENGTH)
  const nodeBboxIterations = clampPositiveInt(forces.bboxCollideIterations, DEFAULT_BBOX_COLLIDE_ITERATIONS)

  const groupsEnabled = schema.layout?.groups?.enabled !== false
  const groupBboxEnabled = groupsEnabled && forces.groupBboxCollide !== false
  const groupBboxZEnabled = forces.groupBboxCollideZEnabled === true
  const groupBboxPadding = clampNonNegative(forces.groupBboxCollidePadding, DEFAULT_GROUP_BBOX_COLLIDE_PADDING)
  const groupBboxPaddingX = clampNonNegative(forces.groupBboxCollidePaddingX, groupBboxPadding)
  const groupBboxPaddingY = clampNonNegative(forces.groupBboxCollidePaddingY, groupBboxPadding)
  const groupBboxPaddingZ = clampNonNegative(forces.groupBboxCollidePaddingZ, groupBboxPadding)
  const groupBboxBorderGapPx = Math.max(
    1,
    clampNonNegative(forces.groupBboxCollideBorderGapPx, DEFAULT_GROUP_COLLISION_BORDER_GAP_PX),
  )
  const groupBboxExtraGapPx = readGroupBboxCollideExtraGapPx({
    schema,
    collidePaddingPx: groupBboxPadding,
    borderGapMinPx: groupBboxBorderGapPx,
  })
  const groupBboxExtraGapZPx = clampNonNegative(forces.groupBboxCollideExtraGapZPx, groupBboxExtraGapPx)
  const groupBboxTouchEpsilonPx = clampNonNegative(
    forces.groupBboxCollideTouchEpsilonPx,
    DEFAULT_GROUP_COLLISION_TOUCH_EPSILON_PX,
  )
  const groupBboxTouchEpsilonXPx = clampNonNegative(forces.groupBboxCollideTouchEpsilonXPx, groupBboxTouchEpsilonPx)
  const groupBboxTouchEpsilonYPx = clampNonNegative(forces.groupBboxCollideTouchEpsilonYPx, groupBboxTouchEpsilonPx)
  const groupBboxTouchEpsilonZPx = clampNonNegative(
    forces.groupBboxCollideTouchEpsilonZPx,
    groupBboxTouchEpsilonPx,
  )

  const groupBboxNestedTouchEpsilonPx = clampNonNegative(
    forces.groupBboxCollideNestedTouchEpsilonPx,
    groupBboxTouchEpsilonPx,
  )
  const groupBboxNestedTouchEpsilonXPx = clampNonNegative(
    forces.groupBboxCollideNestedTouchEpsilonXPx,
    groupBboxNestedTouchEpsilonPx,
  )
  const groupBboxNestedTouchEpsilonYPx = clampNonNegative(
    forces.groupBboxCollideNestedTouchEpsilonYPx,
    groupBboxNestedTouchEpsilonPx,
  )
  const groupBboxNestedTouchEpsilonZPx = clampNonNegative(
    forces.groupBboxCollideNestedTouchEpsilonZPx,
    groupBboxNestedTouchEpsilonPx,
  )
  const groupBboxStrengthRaw = clampNonNegative(forces.groupBboxCollideStrength, DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH)
  const groupBboxStrength = groupBboxEnabled ? Math.max(0.05, groupBboxStrengthRaw) : 0
  const groupBboxIterations = clampPositiveInt(forces.groupBboxCollideIterations, DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS)

  return {
    nodeBbox: {
      enabled: nodeBboxEnabled,
      zEnabled: nodeBboxZEnabled,
      padding: nodeBboxPadding,
      paddingX: nodeBboxPaddingX,
      paddingY: nodeBboxPaddingY,
      paddingZ: nodeBboxPaddingZ,
      borderGapPx: nodeBboxBorderGapPx,
      touchEpsilonPx: nodeBboxTouchEpsilonPx,
      touchEpsilonXPx: nodeBboxTouchEpsilonXPx,
      touchEpsilonYPx: nodeBboxTouchEpsilonYPx,
      touchEpsilonZPx: nodeBboxTouchEpsilonZPx,
      strength: nodeBboxStrength,
      iterations: nodeBboxIterations,
    },
    groupBbox: {
      enabled: groupBboxEnabled,
      zEnabled: groupBboxZEnabled,
      padding: groupBboxPadding,
      paddingX: groupBboxPaddingX,
      paddingY: groupBboxPaddingY,
      paddingZ: groupBboxPaddingZ,
      borderGapPx: groupBboxBorderGapPx,
      extraGapPx: groupBboxExtraGapPx,
      extraGapZPx: groupBboxExtraGapZPx,
      touchEpsilonPx: groupBboxTouchEpsilonPx,
      touchEpsilonXPx: groupBboxTouchEpsilonXPx,
      touchEpsilonYPx: groupBboxTouchEpsilonYPx,
      touchEpsilonZPx: groupBboxTouchEpsilonZPx,
      nestedTouchEpsilonPx: groupBboxNestedTouchEpsilonPx,
      nestedTouchEpsilonXPx: groupBboxNestedTouchEpsilonXPx,
      nestedTouchEpsilonYPx: groupBboxNestedTouchEpsilonYPx,
      nestedTouchEpsilonZPx: groupBboxNestedTouchEpsilonZPx,
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
