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
  const cellW = NODE_QUICK_EDITOR_BASE_SIZE.width + gap
  const cellH = Math.round(NODE_QUICK_EDITOR_BASE_SIZE.height * 0.72) + gap
  const cols = Math.max(1, Math.min(4, Math.floor(Math.max(1, w - 40) / cellW)))
  const col = idx % cols
  const row = Math.floor(idx / cols)
  const leftRaw = 20 + col * cellW
  const topRaw = 96 + row * cellH
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  return {
    left: clamp(leftRaw, 8, Math.max(8, w - NODE_QUICK_EDITOR_BASE_SIZE.width - 8)),
    top: clamp(topRaw, 8, Math.max(8, h - NODE_QUICK_EDITOR_BASE_SIZE.height - 8)),
  }
}

