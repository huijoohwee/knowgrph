export const CANVAS_TOUCH_DRAG_SLOP_PX = 8
export const CANVAS_PEN_DRAG_SLOP_PX = 4

export function readCanvasDragIntentThresholdPx(pointerType: unknown): number {
  if (pointerType === 'touch') return CANVAS_TOUCH_DRAG_SLOP_PX
  if (pointerType === 'pen') return CANVAS_PEN_DRAG_SLOP_PX
  return 0
}
