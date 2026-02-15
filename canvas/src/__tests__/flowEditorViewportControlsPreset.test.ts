import { useGraphStore } from '@/hooks/useGraphStore'

export function testFlowEditorViewportControlsPresetDoesNotForceDesign() {
  const api = useGraphStore.getState()
  api.setDocumentStructureBaselineLock(false)
  api.setViewportControlsPreset('map')
  api.setCanvas2dRenderer('d3')

  api.setFlowEditorSelectionOnDrag(false)

  api.setCanvas2dRenderer('flowEditor')
  const state = useGraphStore.getState()
  if (state.canvas2dRenderer !== 'flowEditor') {
    throw new Error(`expected canvas2dRenderer to be flowEditor, got ${String(state.canvas2dRenderer)}`)
  }
  if (state.viewportControlsPreset !== 'map') {
    throw new Error(`expected viewportControlsPreset store value to remain map, got ${String(state.viewportControlsPreset)}`)
  }
  if (state.flowEditorSelectionOnDrag !== false) {
    throw new Error(`expected flowEditorSelectionOnDrag to default false, got ${String(state.flowEditorSelectionOnDrag)}`)
  }

  api.setFlowEditorSelectionOnDrag(true)
  const state2 = useGraphStore.getState()
  if (state2.viewportControlsPreset !== 'map') {
    throw new Error(`expected viewportControlsPreset to remain map after enabling selectionOnDrag, got ${String(state2.viewportControlsPreset)}`)
  }
}
