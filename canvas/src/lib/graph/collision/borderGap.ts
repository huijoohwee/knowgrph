import { DEFAULT_COLLISION_BORDER_GAP_PX } from '@/lib/graph/layoutDefaults'

export function computeBorderGapPx(strokeWidthPx: number, minGapPx?: number): number {
  const minGap = typeof minGapPx === 'number' && Number.isFinite(minGapPx) ? Math.max(0, minGapPx) : DEFAULT_COLLISION_BORDER_GAP_PX
  if (typeof strokeWidthPx !== 'number' || !Number.isFinite(strokeWidthPx) || strokeWidthPx <= 0) return minGap
  return Math.max(minGap, Math.ceil(strokeWidthPx))
}
