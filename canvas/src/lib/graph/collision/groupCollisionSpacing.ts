import type { GraphSchema } from '@/lib/graph/schema'
import { DEFAULT_GROUP_PADDING } from '@/lib/graph/layoutDefaults'

const clampNonNegative = (v: unknown, fallback: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(0, v)
}

export function readGroupBasePaddingPx(schema: GraphSchema): number {
  return clampNonNegative(schema.layout?.groups?.padding, DEFAULT_GROUP_PADDING)
}

export function computeDefaultGroupBboxExtraGapPx(args: {
  groupBasePaddingPx: number
  collidePaddingPx: number
  borderGapMinPx: number
}): number {
  const groupBasePaddingPx = Math.max(0, args.groupBasePaddingPx)
  const collidePaddingPx = Math.max(0, args.collidePaddingPx)
  const borderGapMinPx = Math.max(0, args.borderGapMinPx)

  const derived = Math.floor(groupBasePaddingPx * 0.95 + collidePaddingPx * 0.75 + borderGapMinPx * 0.5 + 10)
  return Math.max(18, Math.min(160, derived))
}

export function readGroupBboxCollideExtraGapPx(args: {
  schema: GraphSchema
  collidePaddingPx: number
  borderGapMinPx: number
}): number {
  const forces = (args.schema.layout?.forces || {}) as GraphSchema['layout']['forces'] & {
    groupBboxCollideExtraGapPx?: number
  }
  const raw = forces.groupBboxCollideExtraGapPx
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(240, raw))
  return computeDefaultGroupBboxExtraGapPx({
    groupBasePaddingPx: readGroupBasePaddingPx(args.schema),
    collidePaddingPx: args.collidePaddingPx,
    borderGapMinPx: args.borderGapMinPx,
  })
}

