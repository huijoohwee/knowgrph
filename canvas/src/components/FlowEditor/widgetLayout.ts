import { WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'

export function computeDefaultWidgetFloatingPos(args: {
  stackIndex?: number
  viewportW: number
  viewportH: number
}): { left: number; top: number } {
  const idx = Number.isFinite(args.stackIndex) ? Math.max(0, Math.floor(args.stackIndex as number)) : 0
  const w = Math.max(1, Math.floor(args.viewportW))
  const h = Math.max(1, Math.floor(args.viewportH))
  const marginX = 12
  const marginTop = 96
  const gapX = 24
  const gapY = 24
  const cardW = WIDGET_BASE_SIZE.width
  const cardH = WIDGET_BASE_SIZE.height
  const usableWidth = Math.max(1, w - marginX * 2)
  const cols = Math.max(1, Math.floor((usableWidth + gapX) / (cardW + gapX)))
  const col = idx % cols
  const row = Math.floor(idx / cols)
  const leftRaw = w - marginX - cardW - col * (cardW + gapX)
  const topRaw = marginTop + row * (cardH + gapY)
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  return {
    left: clamp(leftRaw, 8, Math.max(8, w - WIDGET_BASE_SIZE.width - 8)),
    top: clamp(topRaw, 8, Math.max(8, h - WIDGET_BASE_SIZE.height - 8)),
  }
}

export function computeWidgetAnchoredStackOffset(stackIndex?: number): { left: number; top: number } {
  const idx = Number.isFinite(stackIndex) ? Math.max(0, Math.floor(stackIndex as number)) : 0
  if (idx <= 0) return { left: 0, top: 0 }
  const cols = 3
  const col = idx % cols
  const row = Math.floor(idx / cols)
  return {
    left: col * 44,
    top: row * 52 + col * 6,
  }
}
