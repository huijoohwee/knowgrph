import { NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'

export function computeDefaultNodeQuickEditorFloatingPos(args: {
  stackIndex?: number
  viewportW: number
  viewportH: number
}): { left: number; top: number } {
  const idx = Number.isFinite(args.stackIndex) ? Math.max(0, Math.floor(args.stackIndex as number)) : 0
  const w = Math.max(1, Math.floor(args.viewportW))
  const h = Math.max(1, Math.floor(args.viewportH))
  const marginX = 12
  const marginTop = 96
  const gapX = 20
  const gapY = 16
  const cardW = NODE_QUICK_EDITOR_BASE_SIZE.width
  const cardH = Math.round(NODE_QUICK_EDITOR_BASE_SIZE.height * 0.72)
  const usableWidth = Math.max(1, w - marginX * 2)
  const cols = Math.max(1, Math.floor((usableWidth + gapX) / (cardW + gapX)))
  const col = idx % cols
  const row = Math.floor(idx / cols)
  const leftRaw = w - marginX - cardW - col * (cardW + gapX)
  const topRaw = marginTop + row * (cardH + gapY)
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  return {
    left: clamp(leftRaw, 8, Math.max(8, w - NODE_QUICK_EDITOR_BASE_SIZE.width - 8)),
    top: clamp(topRaw, 8, Math.max(8, h - NODE_QUICK_EDITOR_BASE_SIZE.height - 8)),
  }
}

export function computeNodeQuickEditorAnchoredStackOffset(stackIndex?: number): { left: number; top: number } {
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

export function computeNodeQuickEditorMaxAnchorShiftPx(viewportW: number, viewportH: number): number {
  const w = Math.max(1, Math.floor(viewportW))
  const h = Math.max(1, Math.floor(viewportH))
  return Math.max(120, Math.min(520, Math.floor(Math.min(w, h) * 0.45)))
}
