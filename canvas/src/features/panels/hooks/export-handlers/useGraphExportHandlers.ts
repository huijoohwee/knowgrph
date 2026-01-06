import { useCallback } from 'react'
import { copyGraphJsonToClipboard, copyGraphJsonLdToClipboard } from '@/lib/graph/file'
import type { GraphData } from '@/lib/graph/types'
import { IMPORT_EXPORT_STATUS_COPY } from '@/lib/config.copy'
import type { ParserDataExportHandlers } from '../useWorkflowExportActions.types'
import { useExportUtils, type WorkflowExportStatusDeps } from './useExportUtils'

type UseGraphExportHandlersParams = {
  parserDataExports: ParserDataExportHandlers
  graphData: GraphData | null
} & WorkflowExportStatusDeps

export function useGraphExportHandlers({
  parserDataExports,
  graphData,
  markExported,
  setTransientExportStatus,
}: UseGraphExportHandlersParams) {
  const { runParserExport, runCopyToClipboard } = useExportUtils({ markExported, setTransientExportStatus })

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

  return {
    exportGraphJsonLd,
    exportGraphJson,
    exportGraphCsvCombined,
    exportGraphGraphMl,
    exportGraphCypher,
    copyGraphJsonLd,
    copyGraphJson,
  }
}
