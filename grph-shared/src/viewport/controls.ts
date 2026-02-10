import { DEFAULT_VIEWPORT_CONTROLS_PRESET, type ViewportControlsPreset } from './presets.js'
import { normalizeWheelDeltasPx } from './wheel.js'

export function coerceViewportControlsPreset(value: unknown): ViewportControlsPreset {
  const v = typeof value === 'string' ? value : ''
  if (v === 'design' || v === 'map') return v
  return DEFAULT_VIEWPORT_CONTROLS_PRESET
}

export function shouldWheelZoomForPreset(e: Pick<WheelEvent, 'ctrlKey' | 'metaKey'>, preset: ViewportControlsPreset): boolean {
  if (preset === 'design') return e.ctrlKey === true || e.metaKey === true
  return true
}

export function computeWheelPanDeltaPx(e: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>): { dx: number; dy: number } {
  const d = normalizeWheelDeltasPx(e)
  if (e.shiftKey === true && Math.abs(d.dx) < 1e-6) {
    return { dx: d.dy, dy: 0 }
  }
  return d
}

export function isPanDragButton(button: number, preset: ViewportControlsPreset): boolean {
  const b = typeof button === 'number' && Number.isFinite(button) ? button : 0
  if (preset === 'design') return b === 1 || b === 2
  return b === 0
}

export function shouldAllowPanDragForPreset(args: {
  preset: ViewportControlsPreset
  eventType: string
  button: number
  spacePanHeld: boolean
}): boolean {
  const type = typeof args.eventType === 'string' ? args.eventType : ''
  if (type.startsWith('touch')) return true
  if (args.preset === 'design') {
    if (isPanDragButton(args.button, args.preset)) return true
    return args.spacePanHeld === true && args.button === 0
  }
  return isPanDragButton(args.button, args.preset)
}

export function shouldAllowPanDragForPointerEvent(args: {
  preset: ViewportControlsPreset
  eventType: string
  button: number
  shiftKey: boolean
  spacePanHeld: boolean
}): boolean {
  const type = typeof args.eventType === 'string' ? args.eventType : ''
  const isDown = type === 'pointerdown' || type === 'mousedown'
  if (args.preset === 'map' && args.shiftKey === true && isDown && args.button === 0) return false
  return shouldAllowPanDragForPreset({
    preset: args.preset,
    eventType: type,
    button: args.button,
    spacePanHeld: args.spacePanHeld,
  })
}

export function shouldStartSelectionDragForPreset(args: {
  preset: ViewportControlsPreset
  button: number
  shiftKey: boolean
  spacePanHeld: boolean
  selectionOnDrag: boolean
}): boolean {
  if (args.spacePanHeld === true) return false
  if (args.button !== 0) return false
  if (args.preset === 'design') return args.selectionOnDrag === true
  return args.shiftKey === true
}

export function enforceDesignPresetWhenSelectionOnDrag(preset: ViewportControlsPreset, selectionOnDrag: boolean): ViewportControlsPreset {
  if (selectionOnDrag === true) return 'design'
  return preset
}

export function shouldSuppressContextMenuForPreset(preset: ViewportControlsPreset): boolean {
  return preset === 'design'
}
