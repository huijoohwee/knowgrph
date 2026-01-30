import type { GraphSchema } from '@/lib/graph/schema'

export type BboxCollideConfig = {
  enabled: boolean
  padding: number
  strength: number
  iterations: number
}

export type GroupBboxCollideConfig = {
  enabled: boolean
  padding: number
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
    bboxCollideIterations?: number
    groupBboxCollide?: boolean
    groupBboxCollideStrength?: number
    groupBboxCollidePadding?: number
    groupBboxCollideIterations?: number
  }

  const nodeBboxEnabled = forces.bboxCollide !== false
  const nodeBboxPadding = clampNonNegative(forces.bboxCollidePadding, 10)
  const nodeBboxStrength = clampNonNegative(forces.bboxCollideStrength, 0.7)
  const nodeBboxIterations = clampPositiveInt(forces.bboxCollideIterations, 2)

  const groupsEnabled = schema.layout?.groups?.enabled !== false
  const groupBboxEnabled = groupsEnabled
  const groupBboxPadding = clampNonNegative(forces.groupBboxCollidePadding, nodeBboxPadding)
  const groupBboxStrengthRaw = clampNonNegative(forces.groupBboxCollideStrength, nodeBboxStrength * 0.55)
  const groupBboxStrength = groupBboxEnabled ? Math.max(0.05, groupBboxStrengthRaw) : 0
  const groupBboxIterations = clampPositiveInt(forces.groupBboxCollideIterations, nodeBboxIterations)

  return {
    nodeBbox: {
      enabled: nodeBboxEnabled,
      padding: nodeBboxPadding,
      strength: nodeBboxStrength,
      iterations: nodeBboxIterations,
    },
    groupBbox: {
      enabled: groupBboxEnabled,
      padding: groupBboxPadding,
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
