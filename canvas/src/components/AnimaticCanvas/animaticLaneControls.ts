import type { AnimaticTimelineLane, AnimaticTimelineLaneControlState } from '@/components/AnimaticCanvas/animaticTimeline'

export type AnimaticTimelineLanePresentation = AnimaticTimelineLane & {
  hidden: boolean
  muted: boolean
  solo: boolean
  soloFiltered: boolean
  visibleItems: boolean
}

export function resolveAnimaticTimelineLanePresentation(args: {
  lanes: readonly AnimaticTimelineLane[]
  controls?: AnimaticTimelineLaneControlState
}): AnimaticTimelineLanePresentation[] {
  const lanes = Array.isArray(args.lanes) ? args.lanes : []
  const hiddenLaneIds = new Set(args.controls?.hiddenLaneIds || [])
  const mutedLaneIds = new Set(args.controls?.mutedLaneIds || [])
  const soloLaneId = args.controls?.soloLaneId ?? null
  return lanes.map(lane => {
    const hidden = hiddenLaneIds.has(lane.id)
    const muted = mutedLaneIds.has(lane.id)
    const solo = soloLaneId === lane.id
    const soloFiltered = soloLaneId != null && !solo
    const visibleItems = soloLaneId != null ? solo : !hidden
    return {
      ...lane,
      hidden,
      muted,
      solo,
      soloFiltered,
      visibleItems,
    }
  })
}
