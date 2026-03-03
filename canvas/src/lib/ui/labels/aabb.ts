export type AabbRect = { x: number; y: number; halfW: number; halfH: number }

export const aabbOverlaps = (a: AabbRect, b: AabbRect): boolean =>
  Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH

export const aabbOverlapsAny = (a: AabbRect, rects: ReadonlyArray<AabbRect>): boolean => {
  for (let i = 0; i < rects.length; i += 1) {
    if (aabbOverlaps(a, rects[i]!)) return true
  }
  return false
}

