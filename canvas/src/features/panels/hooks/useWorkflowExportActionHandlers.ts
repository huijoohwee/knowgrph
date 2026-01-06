import { useCallback } from 'react'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import {
  exportSchemaAsJSON,
  exportSchemaAsJsonLd,
  exportSchemaAsCsv,
} from '@/features/schema/io'
import type { SchemaConfigPath } from '@/lib/graph/file'
import {
  exportValidationSummaryAsJSON,
  exportValidationSummaryAsMarkdown,
} from '@/lib/graph/file'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { useGraphStore } from '@/hooks/useGraphStore'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import type { ParserDataExportHandlers } from './useWorkflowExportActions.types'
import type { WorkflowExportStatusDeps } from './export-handlers/useExportUtils'
import { useGraphExportHandlers } from './export-handlers/useGraphExportHandlers'
import { useSelectionExportHandlers } from './export-handlers/useSelectionExportHandlers'
import { useSchemaExportHandlers } from './export-handlers/useSchemaExportHandlers'
import { useValidationExportHandlers } from './export-handlers/useValidationExportHandlers'
import { useSnapshotExportHandlers } from './export-handlers/useSnapshotExportHandlers'
import { useWorkflowSettingsExportHandlers } from './export-handlers/useWorkflowSettingsExportHandlers'
import { useImportHandlers } from './export-handlers/useImportHandlers'

// Export WorkflowExportStatusDeps so other files can use it if needed
export type { WorkflowExportStatusDeps }

type UseWorkflowExportActionHandlersParams = {
  parserDataExports: ParserDataExportHandlers
  graphData: GraphData | null
  graphSchema: GraphSchema | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  captureCanvasSvgSnapshot: () => Promise<string | null>
  captureCanvasPngSnapshot: () => Promise<Blob | null>
} & WorkflowExportStatusDeps

export function useWorkflowExportActionHandlers({
  parserDataExports,
  graphData,
  graphSchema,
  selectedNodeId,
  selectedEdgeId,
  captureCanvasSvgSnapshot,
  captureCanvasPngSnapshot,
  markExported,
  setTransientExportStatus,
}: UseWorkflowExportActionHandlersParams) {
  const statusDeps = { markExported, setTransientExportStatus }

  const graphExportHandlers = useGraphExportHandlers({
    parserDataExports,
    graphData,
    ...statusDeps,
  })

  const selectionExportHandlers = useSelectionExportHandlers({
    graphData,
    selectedNodeId,
    selectedEdgeId,
    ...statusDeps,
  })

  const schemaExportHandlers = useSchemaExportHandlers({
    graphSchema,
    ...statusDeps,
  })

  const validationExportHandlers = useValidationExportHandlers({
    graphData,
    graphSchema,
    selectedNodeId,
    selectedEdgeId,
    ...statusDeps,
  })

  const snapshotExportHandlers = useSnapshotExportHandlers({
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
    ...statusDeps,
  })

  const workflowSettingsExportHandlers = useWorkflowSettingsExportHandlers(statusDeps)

  const importHandlers = useImportHandlers(statusDeps)

  const exportAll = useCallback(() => {
    try {
      if (parserDataExports.onExportJsonLd) parserDataExports.onExportJsonLd()
      if (parserDataExports.onExportJson) parserDataExports.onExportJson()
      if (parserDataExports.onExportCsvCombined) parserDataExports.onExportCsvCombined()
      if (parserDataExports.onExportGraphMl) parserDataExports.onExportGraphMl()
      if (parserDataExports.onExportCypher) parserDataExports.onExportCypher()

      try {
        if (graphSchema) {
          const suggested = verifyWorkflowPresetStorage().lastApplied?.schemaFileName as SchemaConfigPath | undefined
          void exportSchemaAsJSON(graphSchema, suggested)
          void exportSchemaAsJsonLd(graphSchema, suggested)
          void exportSchemaAsCsv(graphSchema, suggested)
          try {
            useGraphStore.getState().setSchemaLastExportSnapshot(graphSchema)
          } catch {
            void 0
          }
        }
      } catch {
        void 0
      }

      try {
        if (graphData && graphSchema) {
          const summary = validateGraphDataWithSchema(graphData, graphSchema)
          const storage = verifyWorkflowPresetStorage()
          const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
          const run = async () => {
            await exportValidationSummaryAsJSON(summary, suggested)
            await exportValidationSummaryAsMarkdown(summary, suggested)
          }
          void run()
        }
      } catch {
        void 0
      }

      markExported()
      setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.exportAllOk)
    } catch {
      setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.exportAllFailed)
    }
  }, [graphData, graphSchema, markExported, parserDataExports, setTransientExportStatus])

  return {
    exportAll,
    ...graphExportHandlers,
    ...selectionExportHandlers,
    ...schemaExportHandlers,
    ...validationExportHandlers,
    ...snapshotExportHandlers,
    ...workflowSettingsExportHandlers,
    ...importHandlers,
  }
}
