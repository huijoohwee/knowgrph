import { useCallback } from 'react'
import {
  exportSelectionAsJsonLd,
  exportSelectionAsJSON,
  exportSelectionAsCombinedCSV,
  exportSelectionAsGraphML,
  exportSelectionAsCypher,
} from '@/lib/graph/file'
import type { DatasetPath } from '@/lib/graph/file'
import type { GraphData } from '@/lib/graph/types'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import type { WorkflowExportStatusDeps } from './useExportUtils'

type UseSelectionExportHandlersParams = {
  graphData: GraphData | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
} & WorkflowExportStatusDeps

export function useSelectionExportHandlers({
  graphData,
  selectedNodeId,
  selectedEdgeId,
  markExported,
  setTransientExportStatus,
}: UseSelectionExportHandlersParams) {
  const exportSelection = useCallback(
    (
      fn: (data: GraphData, nodeId: string | null, edgeId: string | null, suggested?: DatasetPath) => Promise<void>,
      okMsg: string,
      failedMsg: string,
    ) => {
      if (!graphData) {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.selectionNoGraphData)
        return
      }
      const { lastApplied } = verifyWorkflowPresetStorage()
      const suggested = lastApplied ? (lastApplied.datasetFileName as DatasetPath) : undefined
      void (async () => {
        try {
          await fn(graphData, selectedNodeId, selectedEdgeId, suggested)
          markExported()
          setTransientExportStatus(okMsg)
        } catch {
          setTransientExportStatus(failedMsg)
        }
      })()
    },
    [graphData, markExported, selectedEdgeId, selectedNodeId, setTransientExportStatus],
  )

  const exportSelectionJsonLd = useCallback(() => {
    exportSelection(
      exportSelectionAsJsonLd,
      IMPORT_EXPORT_STATUS_COPY.selectionJsonLdExported,
      IMPORT_EXPORT_STATUS_COPY.selectionJsonLdExportFailed,
    )
  }, [exportSelection])

  const exportSelectionJson = useCallback(() => {
    exportSelection(
      exportSelectionAsJSON,
      IMPORT_EXPORT_STATUS_COPY.selectionJsonExported,
      IMPORT_EXPORT_STATUS_COPY.selectionJsonExportFailed,
    )
  }, [exportSelection])

  const exportSelectionCsvCombined = useCallback(() => {
    exportSelection(
      exportSelectionAsCombinedCSV,
      IMPORT_EXPORT_STATUS_COPY.selectionCsvExported,
      IMPORT_EXPORT_STATUS_COPY.selectionCsvExportFailed,
    )
  }, [exportSelection])

  const exportSelectionGraphMl = useCallback(() => {
    exportSelection(
      exportSelectionAsGraphML,
      IMPORT_EXPORT_STATUS_COPY.selectionGraphMlExported,
      IMPORT_EXPORT_STATUS_COPY.selectionGraphMlExportFailed,
    )
  }, [exportSelection])

  const exportSelectionCypher = useCallback(() => {
    exportSelection(
      exportSelectionAsCypher,
      IMPORT_EXPORT_STATUS_COPY.selectionCypherExported,
      IMPORT_EXPORT_STATUS_COPY.selectionCypherExportFailed,
    )
  }, [exportSelection])

  return {
    exportSelectionJsonLd,
    exportSelectionJson,
    exportSelectionCsvCombined,
    exportSelectionGraphMl,
    exportSelectionCypher,
  }
}
