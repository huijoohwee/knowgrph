import { useCallback } from 'react'
import type { ToolMenuAction, ToolMenuArea } from '@/features/toolbar/toolMenu'
import { createNewMarkdownSourceFileAndOpenViewer } from '@/features/source-files/createNewMarkdownSourceFile'

export function useToolbarMenuAction(args: {
  closeToolMenu: () => void
  openWorkflowTab: () => void
  onOpenMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'settings') => void
  setIsMarkdownImportMenuOpen: (open: boolean) => void
  setIsHtmlImportMenuOpen: (open: boolean) => void
  setIsPdfImportMenuOpen: (open: boolean) => void
  setIsSchemaExportMenuOpen: (open: boolean) => void
  exportGraphJsonLd: () => void
  exportGraphJson: () => void
  exportGraphFieldSettingsJsonLd: () => void
  exportGraphRagWorkflowJsonLd: () => void
  exportHistoryJsonLd: () => void
  exportSettingsJsonLd: () => void
  importGraphFieldSettingsJsonLd: () => void
  importGraphRagWorkflowJsonLd: () => void
  importHistoryJsonLd: () => void
  importSchemaJsonOrJsonLd: () => void
  importSettingsJsonLd: () => void
}) {
  const {
    closeToolMenu,
    importSchemaJsonOrJsonLd,
    importGraphFieldSettingsJsonLd,
    importSettingsJsonLd,
    importHistoryJsonLd,
  } = args
  return useCallback(
    (area: ToolMenuArea, action: ToolMenuAction) => {
      closeToolMenu()
      if (area === 'sourceFiles') {
        if (action === 'new') {
          createNewMarkdownSourceFileAndOpenViewer()
          return
        }
        return
      }
      if (area === 'schemaConfig') {
        if (action === 'import') {
          try {
            importSchemaJsonOrJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
      if (area === 'graphFields') {
        if (action === 'import') {
          try {
            importGraphFieldSettingsJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
      if (area === 'settings') {
        if (action === 'import') {
          try {
            importSettingsJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
      if (area === 'history') {
        if (action === 'import') {
          try {
            importHistoryJsonLd()
          } catch {
            void 0
          }
          return
        }
      }
    },
    [
      closeToolMenu,
      importSchemaJsonOrJsonLd,
      importGraphFieldSettingsJsonLd,
      importSettingsJsonLd,
      importHistoryJsonLd,
    ]
  )
}
