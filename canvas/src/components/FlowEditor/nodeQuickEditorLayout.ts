import { NODE_QUICK_EDITOR_BASE_SIZE } from '@/components/FlowEditor/nodeQuickEditorZoom'

export function computeDefaultNodeQuickEditorFloatingPos(args: {
  stackIndex?: number
  viewportW: number
  viewportH: number
}): { left: number; top: number } {
  const idx = Number.isFinite(args.stackIndex) ? Math.max(0, Math.floor(args.stackIndex as number)) : 0
  const w = Math.max(1, Math.floor(args.viewportW))
  const h = Math.max(1, Math.floor(args.viewportH))
  const gap = 18
  const cellH = Math.round(NODE_QUICK_EDITOR_BASE_SIZE.height * 0.72) + gap
  const leftRaw = w - NODE_QUICK_EDITOR_BASE_SIZE.width - 16
  const topRaw = 96 + idx * cellH
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  return {
    left: clamp(leftRaw, 8, Math.max(8, w - NODE_QUICK_EDITOR_BASE_SIZE.width - 8)),
    top: clamp(topRaw, 8, Math.max(8, h - NODE_QUICK_EDITOR_BASE_SIZE.height - 8)),
  }
}

export function computeNodeQuickEditorMaxAnchorShiftPx(viewportW: number, viewportH: number): number {
  const w = Math.max(1, Math.floor(viewportW))
  const h = Math.max(1, Math.floor(viewportH))
  return Math.max(120, Math.min(520, Math.floor(Math.min(w, h) * 0.45)))
}
