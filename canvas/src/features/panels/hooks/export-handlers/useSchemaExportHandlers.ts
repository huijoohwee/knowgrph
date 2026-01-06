import { useCallback } from 'react'
import {
  exportSchemaAsJSON,
  exportSchemaAsJsonLd,
  exportSchemaAsCsv,
  copySchemaJsonToClipboard,
  copySchemaJsonLdToClipboard,
} from '@/features/schema/io'
import type { SchemaConfigPath } from '@/lib/graph/file'
import type { GraphSchema } from '@/lib/graph/schema'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import { verifyWorkflowPresetStorage } from '@/features/parsers/workflowPresets'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useExportUtils, type WorkflowExportStatusDeps } from './useExportUtils'

type UseSchemaExportHandlersParams = {
  graphSchema: GraphSchema | null
} & WorkflowExportStatusDeps

export function useSchemaExportHandlers({
  graphSchema,
  markExported,
  setTransientExportStatus,
}: UseSchemaExportHandlersParams) {
  const { runCopyToClipboard } = useExportUtils({ markExported, setTransientExportStatus })

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

  return {
    exportSchemaJson,
    exportSchemaJsonLd,
    exportSchemaCsv,
    copySchemaJsonLd,
    copySchemaJson,
  }
}
