import { useCallback } from 'react'
import {
  importSettingsJsonLd as runImportSettingsJsonLd,
  importGraphFieldSettingsJsonLd as runImportGraphFieldSettingsJsonLd,
  importHistoryJsonLd as runImportHistoryJsonLd,
  importGraphRagWorkflowFromText as runImportGraphRagWorkflowFromText,
  importGraphRagWorkflowJsonLd as runImportGraphRagWorkflowJsonLd,
} from '../workflowJsonLdActions'
import { loadSchemaFromFile } from '@/features/schema/io'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { WorkflowExportStatusDeps } from './useExportUtils'

export function useImportHandlers({ markExported, setTransientExportStatus }: WorkflowExportStatusDeps) {
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

  return {
    importSchemaJsonOrJsonLd,
    importGraphRagWorkflowFromText,
    importGraphRagWorkflowJsonLd,
    importSettingsJsonLd,
    importGraphFieldSettingsJsonLd,
    importHistoryJsonLd,
  }
}
