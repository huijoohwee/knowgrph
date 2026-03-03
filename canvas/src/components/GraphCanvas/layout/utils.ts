import {
  estimateLabelCharWidthPx,
  estimateMaxCharsForWidthPx,
  truncateTextWithEllipsis,
  truncateTextWithWordEllipsis,
  wrapTextByMaxChars,
} from '@/lib/ui/text/labelText'
import { aabbOverlaps } from '@/lib/ui/labels/aabb'

export const isRecordType = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export { estimateLabelCharWidthPx, estimateMaxCharsForWidthPx, truncateTextWithEllipsis, truncateTextWithWordEllipsis, wrapTextByMaxChars }

export type AabbRect = { x: number; y: number; halfW: number; halfH: number }

export function pickEdgeLabelPlacement(args: {
  p1: { x: number; y: number }
  p2: { x: number; y: number }
  text: string
  fontSize: number
  srcRect: AabbRect
  tgtRect: AabbRect
  blockerRects: AabbRect[]
  placedLabelRects: AabbRect[]
}): AabbRect | null {
  const { p1, p2, text, srcRect, tgtRect, blockerRects, placedLabelRects } = args
  const fontSize = typeof args.fontSize === 'number' && Number.isFinite(args.fontSize) && args.fontSize > 0 ? args.fontSize : 12
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (!Number.isFinite(len) || len < 1e-6) return null
  const nx = -dy / len
  const ny = dx / len

  const labelText = String(text || '')
  const charW = estimateLabelCharWidthPx(fontSize)
  const halfW = Math.max(2, (labelText.length * charW) / 2)
  const halfH = Math.max(2, fontSize * 0.6)
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2

  const offsets: number[] = []
  for (let attempt = 0; attempt < 8; attempt += 1) offsets.push(fontSize * (0.9 + attempt * 0.9))

  const tryPlace = (x: number, y: number): AabbRect | null => {
    const rect: AabbRect = { x, y, halfW, halfH }
    if (aabbOverlaps(rect, srcRect) || aabbOverlaps(rect, tgtRect)) return null
    for (let i = 0; i < placedLabelRects.length; i += 1) {
      if (aabbOverlaps(rect, placedLabelRects[i])) return null
    }
    for (let i = 0; i < blockerRects.length; i += 1) {
      if (aabbOverlaps(rect, blockerRects[i])) return null
    }
    return rect
  }

  for (let i = 0; i < offsets.length; i += 1) {
    const off = offsets[i]
    const a = tryPlace(mx + nx * off, my + ny * off)
    if (a) return a
    const b = tryPlace(mx - nx * off, my - ny * off)
    if (b) return b
  }

  return null
}
