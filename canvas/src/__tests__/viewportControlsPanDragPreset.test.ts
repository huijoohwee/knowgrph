import {
  shouldAllowPanDragForPointerEvent,
  shouldAllowPanDragForPreset,
} from '@/lib/canvas/viewport-controls'

export const testViewportControlsPanDragPreset = () => {
  const mapArgs = { preset: 'map' as const, eventType: 'mousedown', spacePanHeld: false }
  if (!shouldAllowPanDragForPreset({ ...mapArgs, button: 0 })) throw new Error('expected map preset to allow left-button pan drag')
  if (shouldAllowPanDragForPreset({ ...mapArgs, button: 1 })) throw new Error('expected map preset to disallow middle-button pan drag')
  if (shouldAllowPanDragForPreset({ ...mapArgs, button: 2 })) throw new Error('expected map preset to disallow right-button pan drag')

  const designArgs = { preset: 'design' as const, eventType: 'mousedown' }
  if (shouldAllowPanDragForPreset({ ...designArgs, button: 0, spacePanHeld: false })) {
    throw new Error('expected design preset to disallow left-button pan drag when space is not held')
  }
  if (!shouldAllowPanDragForPreset({ ...designArgs, button: 1, spacePanHeld: false })) {
    throw new Error('expected design preset to allow middle-button pan drag')
  }
  if (!shouldAllowPanDragForPreset({ ...designArgs, button: 2, spacePanHeld: false })) {
    throw new Error('expected design preset to allow right-button pan drag')
  }
  if (!shouldAllowPanDragForPreset({ ...designArgs, button: 0, spacePanHeld: true })) {
    throw new Error('expected design preset to allow space+left-button pan drag')
  }

  if (!shouldAllowPanDragForPreset({ preset: 'design', eventType: 'touchstart', button: 0, spacePanHeld: false })) {
    throw new Error('expected touch pan drag to be allowed')
  }
}

export const testViewportControlsPanToolAllowsLeftDragInDesignPreset = () => {
  if (!shouldAllowPanDragForPointerEvent({
    preset: 'design',
    eventType: 'pointerdown',
    button: 0,
    shiftKey: false,
    spacePanHeld: false,
    pointerMode2d: 'pan',
  })) {
    throw new Error('expected explicit pan tool to allow left-button pan drag in design preset')
  }

  if (shouldAllowPanDragForPointerEvent({
    preset: 'map',
    eventType: 'pointerdown',
    button: 0,
    shiftKey: true,
    spacePanHeld: false,
    pointerMode2d: 'select',
  })) {
    throw new Error('expected map preset shift-left selection gate to remain active outside the pan tool')
  }
}
