import { useCallback } from 'react'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import {
  exportSchemaAsJSON,
  exportSchemaAsJsonLd,
  exportSchemaAsCsv,
  copySchemaJsonToClipboard,
  copySchemaJsonLdToClipboard,
  loadSchemaFromFile,
} from '@/features/schema/io'
import type { DatasetPath, SchemaConfigPath } from '@/lib/graph/file'
import {
  exportSelectionAsJsonLd,
  exportSelectionAsJSON,
  exportSelectionAsCombinedCSV,
  exportSelectionAsGraphML,
  exportSelectionAsCypher,
  exportSvgSnapshot,
  exportPngSnapshot,
  exportValidationSummaryAsJSON,
  exportValidationSummaryAsMarkdown,
  copyGraphJsonToClipboard,
  copyGraphJsonLdToClipboard,
  buildSelectionSubgraph,
} from '@/lib/graph/file'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { validateGraphDataWithSchema } from '@/lib/graph/validation'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  exportSettingsJsonLd as runExportSettingsJsonLd,
  exportGraphFieldSettingsJsonLd as runExportGraphFieldSettingsJsonLd,
  exportGraphRagWorkflowJsonLd as runExportGraphRagWorkflowJsonLd,
  exportHistoryJsonLd as runExportHistoryJsonLd,
  importSettingsJsonLd as runImportSettingsJsonLd,
  importGraphFieldSettingsJsonLd as runImportGraphFieldSettingsJsonLd,
  importHistoryJsonLd as runImportHistoryJsonLd,
  importGraphRagWorkflowFromText as runImportGraphRagWorkflowFromText,
  importGraphRagWorkflowJsonLd as runImportGraphRagWorkflowJsonLd,
} from './workflowJsonLdActions'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import type { ParserDataExportHandlers } from './useWorkflowExportActions.types'

export type WorkflowExportStatusDeps = {
  markExported: () => void
  setTransientExportStatus: (msg: string) => void
}

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
  const runParserExport = useCallback(
    (handler: (() => void) | undefined, meta: { missing: string; ok: string; failed: string }) => {
      try {
        if (!handler) {
          setTransientExportStatus(meta.missing)
          return
        }
        handler()
        markExported()
        setTransientExportStatus(meta.ok)
      } catch {
        setTransientExportStatus(meta.failed)
      }
    },
    [markExported, setTransientExportStatus],
  )

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

  const exportGraphJsonLd = useCallback(() => {
    runParserExport(parserDataExports.onExportJsonLd, {
      missing: IMPORT_EXPORT_STATUS_COPY.graphJsonLdExportNotAvailable,
      ok: IMPORT_EXPORT_STATUS_COPY.graphJsonLdExported,
      failed: IMPORT_EXPORT_STATUS_COPY.graphJsonLdExportFailed,
    })
  }, [parserDataExports.onExportJsonLd, runParserExport])

  const exportGraphJson = useCallback(() => {
    runParserExport(parserDataExports.onExportJson, {
      missing: IMPORT_EXPORT_STATUS_COPY.graphJsonExportNotAvailable,
      ok: IMPORT_EXPORT_STATUS_COPY.graphJsonExported,
      failed: IMPORT_EXPORT_STATUS_COPY.graphJsonExportFailed,
    })
  }, [parserDataExports.onExportJson, runParserExport])

  const exportGraphCsvCombined = useCallback(() => {
    runParserExport(parserDataExports.onExportCsvCombined, {
      missing: IMPORT_EXPORT_STATUS_COPY.graphCsvExportNotAvailable,
      ok: IMPORT_EXPORT_STATUS_COPY.graphCsvExported,
      failed: IMPORT_EXPORT_STATUS_COPY.graphCsvExportFailed,
    })
  }, [parserDataExports.onExportCsvCombined, runParserExport])

  const exportGraphGraphMl = useCallback(() => {
    runParserExport(parserDataExports.onExportGraphMl, {
      missing: IMPORT_EXPORT_STATUS_COPY.graphGraphMlExportNotAvailable,
      ok: IMPORT_EXPORT_STATUS_COPY.graphGraphMlExported,
      failed: IMPORT_EXPORT_STATUS_COPY.graphGraphMlExportFailed,
    })
  }, [parserDataExports.onExportGraphMl, runParserExport])

  const exportGraphCypher = useCallback(() => {
    runParserExport(parserDataExports.onExportCypher, {
      missing: IMPORT_EXPORT_STATUS_COPY.graphCypherExportNotAvailable,
      ok: IMPORT_EXPORT_STATUS_COPY.graphCypherExported,
      failed: IMPORT_EXPORT_STATUS_COPY.graphCypherExportFailed,
    })
  }, [parserDataExports.onExportCypher, runParserExport])

  const exportSettingsJsonLd = useCallback(() => {
    void runExportSettingsJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const exportGraphFieldSettingsJsonLd = useCallback(() => {
    void runExportGraphFieldSettingsJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const exportGraphRagWorkflowJsonLd = useCallback(() => {
    void runExportGraphRagWorkflowJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const exportHistoryJsonLd = useCallback(() => {
    void runExportHistoryJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const importSchemaJsonOrJsonLd = useCallback(() => {
    void (async () => {
      try {
        const loaded = await loadSchemaFromFile()
        const state = useGraphStore.getState()
        if (loaded.ok) {
          const label = loaded.label || ''
          try {
            state.clearSchemaLintSummary()
          } catch {
            void 0
          }
          try {
            state.setSchema(loaded.schema)
          } catch {
            void 0
          }
          try {
            state.setSchemaImportLabel(label)
          } catch {
            void 0
          }
          try {
            state.setSchemaLastExportSnapshot(null)
          } catch {
            void 0
          }
          const msg = IMPORT_EXPORT_STATUS_COPY.schemaImported(label)
          setTransientExportStatus(msg)
          try {
            state.setSchemaOpStatus(true, msg)
          } catch {
            void 0
          }
          return
        }
        const reason = (loaded as { ok: false; reason: 'cancel' | 'invalid' | 'error' }).reason
        const msg =
          reason === 'cancel'
            ? IMPORT_EXPORT_STATUS_COPY.importCancelled
            : reason === 'invalid'
              ? IMPORT_EXPORT_STATUS_COPY.schemaImportInvalidJson
              : IMPORT_EXPORT_STATUS_COPY.schemaImportFailed
        setTransientExportStatus(msg)
        try {
          state.setSchemaOpStatus(reason === 'cancel' ? null : false, msg)
        } catch {
          void 0
        }
      } catch {
        const msg = IMPORT_EXPORT_STATUS_COPY.schemaImportFailed
        setTransientExportStatus(msg)
        try {
          const state = useGraphStore.getState()
          state.setSchemaOpStatus(false, msg)
        } catch {
          void 0
        }
      }
    })()
  }, [setTransientExportStatus])

  const importGraphRagWorkflowFromText = useCallback(
    (nameRaw: string | null | undefined, textRaw: string | null | undefined) => {
      runImportGraphRagWorkflowFromText(
        {
          markExported,
          setTransientExportStatus,
        },
        nameRaw,
        textRaw,
      )
    },
    [markExported, setTransientExportStatus],
  )

  const importGraphRagWorkflowJsonLd = useCallback(() => {
    void runImportGraphRagWorkflowJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const importSettingsJsonLd = useCallback(() => {
    void runImportSettingsJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const importGraphFieldSettingsJsonLd = useCallback(() => {
    void runImportGraphFieldSettingsJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const importHistoryJsonLd = useCallback(() => {
    void runImportHistoryJsonLd({
      markExported,
      setTransientExportStatus,
    })
  }, [markExported, setTransientExportStatus])

  const exportSvgSnapshotAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const svg = await captureCanvasSvgSnapshot()
        const trimmed = String(svg || '').trim()
        if (!trimmed) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotNoSnapshotAvailable)
          return
        }
        await exportSvgSnapshot(trimmed, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.svgSnapshotExportFailed)
      }
    })()
  }, [captureCanvasSvgSnapshot, markExported, setTransientExportStatus])

  const exportPngSnapshotAction = useCallback(() => {
    void (async () => {
      try {
        const storage = verifyWorkflowPresetStorage()
        const suggested = storage.lastApplied ? String(storage.lastApplied.datasetFileName || '') : undefined
        const pngBlob = await captureCanvasPngSnapshot()
        if (!pngBlob) {
          setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotNoSnapshotAvailable)
          return
        }
        await exportPngSnapshot(pngBlob, suggested)
        markExported()
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotExported)
      } catch {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.pngSnapshotExportFailed)
      }
    })()
  }, [captureCanvasPngSnapshot, markExported, setTransientExportStatus])

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

  const exportSchema = useCallback(
    (fn: (schema: GraphSchema, suggested?: SchemaConfigPath) => Promise<boolean>, okMsg: string, failedMsg: string) => {
      if (!graphSchema) {
        setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.schemaNoSchemaToExport)
        return
      }
      const suggested = verifyWorkflowPresetStorage().lastApplied?.schemaFileName as SchemaConfigPath | undefined
      void (async () => {
        try {
          const ok = await fn(graphSchema, suggested)
          if (!ok) {
            setTransientExportStatus(IMPORT_EXPORT_STATUS_COPY.saveCancelled)
            return
          }
          try {
            useGraphStore.getState().setSchemaLastExportSnapshot(graphSchema)
          } catch {
            void 0
          }
          markExported()
          setTransientExportStatus(okMsg)
        } catch {
          setTransientExportStatus(failedMsg)
        }
      })()
    },
    [graphSchema, markExported, setTransientExportStatus],
  )

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

  const runCopyToClipboard = useCallback(
    <T,>(data: T | null, run: (value: T) => Promise<boolean>, meta: { missing: string; ok: string; failed: string }) => {
      if (!data) {
        setTransientExportStatus(meta.missing)
        return
      }
      void (async () => {
        try {
          const ok = await run(data)
          setTransientExportStatus(ok ? meta.ok : meta.failed)
        } catch {
          setTransientExportStatus(meta.failed)
        }
      })()
    },
    [setTransientExportStatus],
  )

  const copyGraphJsonLd = useCallback(() => {
    runCopyToClipboard(graphData, copyGraphJsonLdToClipboard, {
      missing: IMPORT_EXPORT_STATUS_COPY.copyNoGraphToCopy,
      ok: IMPORT_EXPORT_STATUS_COPY.graphJsonLdCopiedToClipboard,
      failed: IMPORT_EXPORT_STATUS_COPY.graphJsonLdCopyFailed,
    })
  }, [graphData, runCopyToClipboard])

  const copyGraphJson = useCallback(() => {
    runCopyToClipboard(graphData, copyGraphJsonToClipboard, {
      missing: IMPORT_EXPORT_STATUS_COPY.copyNoGraphToCopy,
      ok: IMPORT_EXPORT_STATUS_COPY.graphJsonCopiedToClipboard,
      failed: IMPORT_EXPORT_STATUS_COPY.graphJsonCopyFailed,
    })
  }, [graphData, runCopyToClipboard])

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

  const exportSchemaJson = useCallback(() => {
    exportSchema(exportSchemaAsJSON, IMPORT_EXPORT_STATUS_COPY.schemaJsonExported, IMPORT_EXPORT_STATUS_COPY.schemaJsonExportFailed)
  }, [exportSchema])

  const exportSchemaJsonLd = useCallback(() => {
    exportSchema(
      exportSchemaAsJsonLd,
      IMPORT_EXPORT_STATUS_COPY.schemaJsonLdExportedGeneric,
      IMPORT_EXPORT_STATUS_COPY.schemaJsonLdExportFailedGeneric,
    )
  }, [exportSchema])

  const exportSchemaCsv = useCallback(() => {
    exportSchema(exportSchemaAsCsv, IMPORT_EXPORT_STATUS_COPY.schemaCsvExported, IMPORT_EXPORT_STATUS_COPY.schemaCsvExportFailed)
  }, [exportSchema])

  const copySchemaJsonLd = useCallback(() => {
    runCopyToClipboard(graphSchema, copySchemaJsonLdToClipboard, {
      missing: IMPORT_EXPORT_STATUS_COPY.copyNoSchemaToCopy,
      ok: IMPORT_EXPORT_STATUS_COPY.schemaJsonLdCopiedToClipboard,
      failed: IMPORT_EXPORT_STATUS_COPY.schemaJsonLdCopyFailed,
    })
  }, [graphSchema, runCopyToClipboard])

  const copySchemaJson = useCallback(() => {
    runCopyToClipboard(graphSchema, copySchemaJsonToClipboard, {
      missing: IMPORT_EXPORT_STATUS_COPY.copyNoSchemaToCopy,
      ok: IMPORT_EXPORT_STATUS_COPY.schemaJsonCopiedToClipboard,
      failed: IMPORT_EXPORT_STATUS_COPY.schemaJsonCopyFailed,
    })
  }, [graphSchema, runCopyToClipboard])

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
    exportAll,
    exportGraphJsonLd,
    exportGraphJson,
    exportGraphCsvCombined,
    exportGraphGraphMl,
    exportGraphCypher,
    exportSvgSnapshotAction,
    exportPngSnapshotAction,
    copyGraphJsonLd,
    copyGraphJson,
    exportSettingsJsonLd,
    exportHistoryJsonLd,
    exportGraphFieldSettingsJsonLd,
    exportGraphRagWorkflowJsonLd,
    importGraphRagWorkflowFromText,
    importGraphRagWorkflowJsonLd,
    importSettingsJsonLd,
    importHistoryJsonLd,
    importGraphFieldSettingsJsonLd,
    exportValidationJson,
    exportValidationMarkdown,
    exportSelectionValidationJson,
    exportSelectionValidationMarkdown,
    exportSchemaJson,
    exportSchemaJsonLd,
    exportSchemaCsv,
    importSchemaJsonOrJsonLd,
    copySchemaJsonLd,
    copySchemaJson,
    exportSelectionJsonLd,
    exportSelectionJson,
    exportSelectionCsvCombined,
    exportSelectionGraphMl,
    exportSelectionCypher,
  }
}
