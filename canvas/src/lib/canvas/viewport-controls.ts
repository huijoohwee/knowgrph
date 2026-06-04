import type { ViewportControlsPreset } from 'grph-shared/viewport/presets'
import * as controls from 'grph-shared/viewport/controls'

export const coerceViewportControlsPreset = controls.coerceViewportControlsPreset
export const shouldWheelZoomForPreset = controls.shouldWheelZoomForPreset
export const computeWheelPanDeltaPx = controls.computeWheelPanDeltaPx
export const isPanDragButton = controls.isPanDragButton
export const shouldAllowPanDragForPreset = controls.shouldAllowPanDragForPreset
export const shouldStartSelectionDragForPreset = controls.shouldStartSelectionDragForPreset
export const enforceDesignPresetWhenSelectionOnDrag = controls.enforceDesignPresetWhenSelectionOnDrag
export const shouldSuppressContextMenuForPreset = controls.shouldSuppressContextMenuForPreset

export type ShouldAllowPanDragForPointerEventArgs = {
  preset: ViewportControlsPreset
  eventType: string
  button: number
  shiftKey: boolean
  spacePanHeld: boolean
  pointerMode2d?: string | null
}

export function shouldAllowPanDragForPointerEvent(args: ShouldAllowPanDragForPointerEventArgs): boolean {
  const type = typeof args.eventType === 'string' ? args.eventType : ''
  const isDown = type === 'pointerdown' || type === 'mousedown'
  if (String(args.pointerMode2d || '') === 'pan' && isDown && args.button === 0) return true

  const impl = (controls as unknown as { shouldAllowPanDragForPointerEvent?: (a: ShouldAllowPanDragForPointerEventArgs) => boolean })
    .shouldAllowPanDragForPointerEvent
  if (typeof impl === 'function') return impl(args)

  if (args.preset === 'map' && args.shiftKey === true && isDown && args.button === 0) return false

  return controls.shouldAllowPanDragForPreset({
    preset: args.preset,
    eventType: type,
    button: args.button,
    spacePanHeld: args.spacePanHeld,
  })
}
