import { useGraphStore } from '@/hooks/useGraphStore'
import { enforceDesignPresetWhenSelectionOnDrag } from '@/lib/canvas/viewport-controls'

export function testFlowEditorForcesDesignViewportControlsPreset() {
  const api = useGraphStore.getState()
  api.setDocumentStructureBaselineLock(false)
  api.setViewportControlsPreset('map')
  api.setCanvas2dRenderer('d3')

  api.setCanvas2dRenderer('flowEditor')
  const state = useGraphStore.getState()
  if (state.canvas2dRenderer !== 'flowEditor') {
    throw new Error(`expected canvas2dRenderer to be flowEditor, got ${String(state.canvas2dRenderer)}`)
  }
  if (state.viewportControlsPreset !== 'map') {
    throw new Error(`expected viewportControlsPreset store value to remain map, got ${String(state.viewportControlsPreset)}`)
  }
  const effective = enforceDesignPresetWhenSelectionOnDrag(state.viewportControlsPreset, true)
  if (effective !== 'design') {
    throw new Error(`expected effective preset to be design when selectionOnDrag=true, got ${String(effective)}`)
  }
}
