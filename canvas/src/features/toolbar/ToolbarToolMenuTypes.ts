import React from 'react'
import { ToolMenuAction, ToolMenuArea, ToolMenuPayload } from '@/features/toolbar/toolMenu'

export interface ToolbarToolMenuProps {
  dataLoadOk: boolean | null
  dataLoadMsg: string
  parserLoadOk: boolean | null
  parserLoadMsg: string
  parserPreferredLanguage: 'json' | 'text' | 'yaml'
  schemaOpOk: boolean | null
  schemaOpMsg: string | null
  graphFieldsOpOk: boolean | null
  graphFieldsOpMsg: string | null
  orchestratorOpOk: boolean | null
  orchestratorOpMsg: string | null
  renderOpOk: boolean | null
  renderOpMsg: string | null
  pipelineStatus: string | null
  exportStatus: string | null
  isSourceFilesImportMenuOpen: boolean
  setIsSourceFilesImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSourceFilesExportMenuOpen: boolean
  setIsSourceFilesExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isParserExportMenuOpen: boolean
  setIsParserExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMarkdownImportMenuOpen: boolean
  setIsMarkdownImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isHtmlImportMenuOpen: boolean
  setIsHtmlImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isPdfImportMenuOpen: boolean
  setIsPdfImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isYouTubeImportMenuOpen: boolean
  setIsYouTubeImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isJsonImportMenuOpen: boolean
  setIsJsonImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isJsonLdImportMenuOpen: boolean
  setIsJsonLdImportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSchemaExportMenuOpen: boolean
  setIsSchemaExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isGraphFieldsExportMenuOpen: boolean
  setIsGraphFieldsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isSettingsExportMenuOpen: boolean
  setIsSettingsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isHistoryExportMenuOpen: boolean
  setIsHistoryExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  isValidationExportMenuOpen: boolean
  setIsValidationExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  onExportSchemaJson: () => void
  onExportSchemaJsonLd: () => void
  onExportSchemaCsv: () => void
  onExportGraphJsonLd: () => void
  onExportGraphJson: () => void
  onExportGraphCsvCombined: () => void
  onExportGraphMl: () => void
  onExportGraphCypher: () => void
  onCopyGraphJsonLd?: () => void
  onCopyGraphJson?: () => void
  hasSelection: boolean
  onExportSelectionJsonLd?: () => void
  onExportSelectionJson?: () => void
  onExportSelectionCsvCombined?: () => void
  onExportSelectionGraphMl?: () => void
  onExportSelectionCypher?: () => void
  onCopySchemaJsonLd?: () => void
  onCopySchemaJson?: () => void
  onExportGraphFieldSettingsJsonLd: () => void
  onExportSettingsJsonLd: () => void
  onExportHistoryJsonLd: () => void
  onExportValidationJson: () => void
  onExportValidationMarkdown: () => void
  onExportSelectionValidationJson?: () => void
  onExportSelectionValidationMarkdown?: () => void
  toolMenuCardRef: React.RefObject<HTMLDivElement>
  toolMenuCardStyle: React.CSSProperties
  onHeaderPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  requestedFloatingPanelView?: 'workspaceActions' | 'propsPanel' | 'renderer' | 'graphTraversal'
  requestedFloatingPanelViewSeq?: number
  onOpenData: () => void
  onRunPipeline: () => void
  onRunDemo?: () => void
  onClose: () => void
  onToolMenuAction: (
    area: ToolMenuArea,
    action: ToolMenuAction,
    payload?: ToolMenuPayload,
  ) => void
  onOpenWorkflowTab: () => void
}
