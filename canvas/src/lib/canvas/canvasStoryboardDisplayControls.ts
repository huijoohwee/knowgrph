import type { Canvas2dRendererId } from '@/lib/config'

export const CANVAS_STORYBOARD_CARD_DISPLAY_CONTROL_ID = 'control:storyboardCard' as const
export const CANVAS_STORYBOARD_WIDGET_DISPLAY_CONTROL_ID = 'control:storyboardWidget' as const

export type CanvasStoryboardDisplayControlId =
  | typeof CANVAS_STORYBOARD_CARD_DISPLAY_CONTROL_ID
  | typeof CANVAS_STORYBOARD_WIDGET_DISPLAY_CONTROL_ID

export type CanvasStoryboardDisplayMode = 'card' | 'widget'

export const CANVAS_STORYBOARD_DISPLAY_MODE_DEFAULT: CanvasStoryboardDisplayMode = 'card'

export const readCanvasStoryboardDisplayMode = (raw: unknown): CanvasStoryboardDisplayMode => {
  return raw === 'widget' ? 'widget' : CANVAS_STORYBOARD_DISPLAY_MODE_DEFAULT
}

export const readCanvasStoryboardDisplayControlTitle = (mode: CanvasStoryboardDisplayMode): string => {
  return mode === 'widget' ? 'Storyboard Display: Widget' : 'Storyboard Display: Card (Default)'
}

export const readCanvasStoryboardDisplayControlActive = (
  canvas2dRenderer: Canvas2dRendererId | null | undefined,
  storyboardDisplayMode: CanvasStoryboardDisplayMode | null | undefined,
  mode: CanvasStoryboardDisplayMode,
): boolean => {
  if (canvas2dRenderer !== 'storyboard') return false
  return readCanvasStoryboardDisplayMode(storyboardDisplayMode) === mode
}

export const getCanvasStoryboardDisplayRenderer = (mode: CanvasStoryboardDisplayMode): Canvas2dRendererId => {
  void mode
  return 'storyboard'
}
