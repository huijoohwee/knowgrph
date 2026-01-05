import { useWorkflowExportActionHandlers } from './useWorkflowExportActionHandlers'
import { useWorkflowExportStatus } from './useWorkflowExportStatus'
import { useWorkflowSelectionSummary } from './useWorkflowSelectionSummary'
import type { UseWorkflowExportActionsParams } from './useWorkflowExportActions.types'

export type { UseWorkflowExportActionsParams, ParserDataExportHandlers } from './useWorkflowExportActions.types'

export function useWorkflowExportActions({
  parserDataExports,
  graphData,
  graphSchema,
  selectedNodeId,
  selectedEdgeId,
  captureCanvasSvgSnapshot,
  captureCanvasPngSnapshot,
}: UseWorkflowExportActionsParams) {
  const { exportedThisSession, exportedAt, exportStatus, markExported, setTransientExportStatus } = useWorkflowExportStatus()
  const { hasSelection, selectionSummary } = useWorkflowSelectionSummary(graphData, selectedNodeId, selectedEdgeId)
  const actions = useWorkflowExportActionHandlers({
    parserDataExports,
    graphData,
    graphSchema,
    selectedNodeId,
    selectedEdgeId,
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
    markExported,
    setTransientExportStatus,
  })

  return {
    exportedThisSession,
    exportedAt,
    exportStatus,
    hasSelection,
    selectionSummary,
    ...actions,
  }
}
