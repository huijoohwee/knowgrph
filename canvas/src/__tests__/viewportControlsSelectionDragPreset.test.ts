import { shouldStartSelectionDragForPreset } from '@/lib/canvas/viewport-controls'

export const testViewportControlsSelectionDragPreset = () => {
  if (shouldStartSelectionDragForPreset({ preset: 'map', button: 0, shiftKey: false, spacePanHeld: false, selectionOnDrag: false })) {
    throw new Error('expected map preset to require shift for selection drag')
  }
  if (!shouldStartSelectionDragForPreset({ preset: 'map', button: 0, shiftKey: true, spacePanHeld: false, selectionOnDrag: false })) {
    throw new Error('expected map preset to allow shift+drag selection')
  }
  if (shouldStartSelectionDragForPreset({ preset: 'map', button: 1, shiftKey: true, spacePanHeld: false, selectionOnDrag: false })) {
    throw new Error('expected non-left button to disallow selection drag')
  }
  if (shouldStartSelectionDragForPreset({ preset: 'map', button: 0, shiftKey: true, spacePanHeld: true, selectionOnDrag: false })) {
    throw new Error('expected space-pan to disable selection drag')
  }

  if (shouldStartSelectionDragForPreset({ preset: 'design', button: 0, shiftKey: false, spacePanHeld: false, selectionOnDrag: false })) {
    throw new Error('expected design preset to require selectionOnDrag=true')
  }
  if (!shouldStartSelectionDragForPreset({ preset: 'design', button: 0, shiftKey: false, spacePanHeld: false, selectionOnDrag: true })) {
    throw new Error('expected design preset to allow selection drag when selectionOnDrag=true')
  }
}

