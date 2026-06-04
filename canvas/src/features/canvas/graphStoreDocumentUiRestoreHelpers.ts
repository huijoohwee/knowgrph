import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyCanvasFrontmatterPreset, resolveCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import type { PerDocumentUiState } from '@/lib/persistence/perDocumentUiState'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildSavedDocumentUiSelectionState,
  buildSavedDocumentUiViewState,
} from '@/features/canvas/graphStoreDocumentUiRestoreState'
import {
  buildSavedDocumentUiPresentationPlan,
} from '@/features/canvas/graphStoreDocumentUiRestorePlan'
import {
  applySavedDocumentUiModeStateWrites,
  applySavedDocumentUiSelectionStateWrites,
  applySavedDocumentUiViewStateWrites,
} from '@/features/canvas/graphStoreDocumentUiRestoreWrites'

type GraphStoreApi = ReturnType<typeof useGraphStore.getState>

export function applySavedDocumentUiPresentationState(api: GraphStoreApi, saved: PerDocumentUiState): void {
  const graphData = api.graphData
  const rawText = String(api.markdownDocumentText || '')
  const presentationPlan = buildSavedDocumentUiPresentationPlan({ graphData, saved })
  if (presentationPlan.shouldPreferFrontmatterFlowLanding) {
    applyFrontmatterFlowImportModes(graphData)
  } else {
    const preset = resolveCanvasFrontmatterPreset({ graphData, rawText })
    if (preset) {
      applyCanvasFrontmatterPreset({ graphData, rawText, preset })
    } else {
      applySavedDocumentUiModeStateWrites(api, presentationPlan.modeState)
    }
  }

  const viewState = buildSavedDocumentUiViewState(saved)
  applySavedDocumentUiViewStateWrites(api, viewState)
}

export function applySavedDocumentUiSelectionState(api: GraphStoreApi, saved: PerDocumentUiState): void {
  const selectionState = buildSavedDocumentUiSelectionState(saved)
  applySavedDocumentUiSelectionStateWrites(api, selectionState)
}
