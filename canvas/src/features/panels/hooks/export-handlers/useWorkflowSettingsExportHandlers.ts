import { useCallback } from 'react'
import {
  exportSettingsJsonLd as runExportSettingsJsonLd,
  exportGraphFieldSettingsJsonLd as runExportGraphFieldSettingsJsonLd,
  exportGraphRagWorkflowJsonLd as runExportGraphRagWorkflowJsonLd,
  exportHistoryJsonLd as runExportHistoryJsonLd,
} from '../workflowJsonLdActions'
import type { WorkflowExportStatusDeps } from './useExportUtils'

export function useWorkflowSettingsExportHandlers({ markExported, setTransientExportStatus }: WorkflowExportStatusDeps) {
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

  return {
    exportSettingsJsonLd,
    exportGraphFieldSettingsJsonLd,
    exportGraphRagWorkflowJsonLd,
    exportHistoryJsonLd,
  }
}
