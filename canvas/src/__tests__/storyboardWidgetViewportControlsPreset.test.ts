import { useGraphStore } from '@/hooks/useGraphStore'

export function testStoryboardWidgetViewportControlsPresetDoesNotForceDesign() {
  const api = useGraphStore.getState()
  api.setDocumentStructureBaselineLock(false)
  api.setViewportControlsPreset('map')
  api.setCanvas2dRenderer('d3')

  api.setStoryboardWidgetSelectionOnDrag(false)

  api.setCanvas2dRenderer('storyboard')
  const state = useGraphStore.getState()
  if (state.canvas2dRenderer !== 'storyboard') {
    throw new Error(`expected canvas2dRenderer to be storyboard, got ${String(state.canvas2dRenderer)}`)
  }
  if (state.viewportControlsPreset !== 'map') {
    throw new Error(`expected viewportControlsPreset store value to remain map, got ${String(state.viewportControlsPreset)}`)
  }
  if (state.storyboardWidgetSelectionOnDrag !== false) {
    throw new Error(`expected storyboardWidgetSelectionOnDrag to default false, got ${String(state.storyboardWidgetSelectionOnDrag)}`)
  }

  api.setStoryboardWidgetSelectionOnDrag(true)
  const state2 = useGraphStore.getState()
  if (state2.viewportControlsPreset !== 'map') {
    throw new Error(`expected viewportControlsPreset to remain map after enabling selectionOnDrag, got ${String(state2.viewportControlsPreset)}`)
  }
}
