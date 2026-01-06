import { useCallback } from 'react'
import {
  exportValidationSummaryAsJSON,
  exportValidationSummaryAsMarkdown,
  buildSelectionSubgraph,
} from '@/lib/graph/file'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import type { WorkflowExportStatusDeps } from './useExportUtils'

type UseValidationExportHandlersParams = {
  graphData: GraphData | null
  graphSchema: GraphSchema | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
} & WorkflowExportStatusDeps

export function useValidationExportHandlers({
  graphData,
  graphSchema,
  selectedNodeId,
  selectedEdgeId,
  markExported,
  setTransientExportStatus,
}: UseValidationExportHandlersParams) {
  const exportValidation = useCallback(
    (
      fn: (summary: ReturnType<typeof validateGraphDataWithSchema>, suggested?: string) => Promise<void>,
      okMsg: string,
      failedMsg: string,
    ) => {
      if (!graphData || !graphSchema) {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.validationNoGraphSchemaToValidate)
        return
      }
      const summary = validateGraphDataWithSchema(graphData, graphSchema)
      const storage = verifyWorkflowPresetStorage()
      const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
      void (async () => {
        try {
          await fn(summary, suggested)
          markExported()
          setTransientExportStatus(okMsg)
        } catch {
          setTransientExportStatus(failedMsg)
        }
      })()
    },
    [graphData, graphSchema, markExported, setTransientExportStatus],
  )

  const exportSelectionValidation = useCallback(
    (opts: { ext: string; run: (summary: ReturnType<typeof validateGraphDataWithSchema>, suggested?: string) => Promise<void>; okMsg: string; failedMsg: string }) => {
      if (!graphData || !graphSchema) {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.validationNoGraphSchemaToValidate)
        return
      }
      const subgraph = buildSelectionSubgraph(graphData, selectedNodeId || null, selectedEdgeId || null)
      const summary = validateGraphDataWithSchema(subgraph, graphSchema)
      const raw = verifyWorkflowPresetStorage().lastApplied ? String(verifyWorkflowPresetStorage().lastApplied?.datasetFileName || '') : ''
      const source = raw && raw.trim() ? raw.trim() : `graph-validation.${opts.ext}`
      const dot = source.lastIndexOf('.')
      const suggested = dot > 0 ? `${source.slice(0, dot)}-selection${source.slice(dot)}` : `${source}-selection`
      void (async () => {
        try {
          await opts.run(summary, suggested)
          markExported()
          setTransientExportStatus(opts.okMsg)
        } catch {
          setTransientExportStatus(opts.failedMsg)
        }
      })()
    },
    [graphData, graphSchema, markExported, selectedEdgeId, selectedNodeId, setTransientExportStatus],
  )

  const exportValidationJson = useCallback(() => {
    exportValidation(
      exportValidationSummaryAsJSON,
      IMPORT_EXPORT_STATUS_COPY.validationJsonExported,
      IMPORT_EXPORT_STATUS_COPY.validationJsonExportFailed,
    )
  }, [exportValidation])

  const exportValidationMarkdown = useCallback(() => {
    exportValidation(
      exportValidationSummaryAsMarkdown,
      IMPORT_EXPORT_STATUS_COPY.validationMarkdownExported,
      IMPORT_EXPORT_STATUS_COPY.validationMarkdownExportFailed,
    )
  }, [exportValidation])

  const exportSelectionValidationJson = useCallback(() => {
    exportSelectionValidation({
      ext: 'json',
      run: exportValidationSummaryAsJSON,
      okMsg: IMPORT_EXPORT_STATUS_COPY.selectionValidationJsonExported,
      failedMsg: IMPORT_EXPORT_STATUS_COPY.selectionValidationJsonExportFailed,
    })
  }, [exportSelectionValidation])

  const exportSelectionValidationMarkdown = useCallback(() => {
    exportSelectionValidation({
      ext: 'md',
      run: exportValidationSummaryAsMarkdown,
      okMsg: IMPORT_EXPORT_STATUS_COPY.selectionValidationMarkdownExported,
      failedMsg: IMPORT_EXPORT_STATUS_COPY.selectionValidationMarkdownExportFailed,
    })
  }, [exportSelectionValidation])

  return {
    exportValidationJson,
    exportValidationMarkdown,
    exportSelectionValidationJson,
    exportSelectionValidationMarkdown,
  }
}
