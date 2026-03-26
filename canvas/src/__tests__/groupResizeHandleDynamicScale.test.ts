import { computeDynamicGroupResizeHandlePx } from '@/lib/canvas/groupResizeHandleConfig'

export const testGroupResizeHandleDynamicScaleShrinksForSmallGroups = () => {
  const large = computeDynamicGroupResizeHandlePx({
    dotRadiusPx: 6,
    hitRadiusPx: 14,
    strokeWidthPx: 1.25,
    groupWidth: 500,
    groupHeight: 400,
  })
  const small = computeDynamicGroupResizeHandlePx({
    dotRadiusPx: 6,
    hitRadiusPx: 14,
    strokeWidthPx: 1.25,
    groupWidth: 120,
    groupHeight: 100,
  })
  if (!(small.dotRadiusPx < large.dotRadiusPx)) throw new Error('expected smaller groups to use smaller resize dots')
  if (!(small.hitRadiusPx < large.hitRadiusPx)) throw new Error('expected smaller groups to use smaller resize hit radius')
}

