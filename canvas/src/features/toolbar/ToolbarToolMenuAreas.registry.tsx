import React from 'react'
import type { ToolMenuAction, ToolMenuArea, ToolMenuPayload } from '@/features/toolbar/toolMenu'
import { ToolbarSourceFilesArea } from '@/features/toolbar/ToolbarSourceFilesArea'
import { ToolbarParserArea } from '@/features/toolbar/ToolbarParserArea'
import { ToolbarMarkdownArea } from '@/features/toolbar/ToolbarMarkdownArea'
import { ToolbarHtmlArea } from '@/features/toolbar/ToolbarHtmlArea'
import { ToolbarPdfArea } from '@/features/toolbar/ToolbarPdfArea'
import { ToolbarSchemaConfigArea } from '@/features/toolbar/ToolbarSchemaConfigArea'
import { ToolbarGraphFieldsArea } from '@/features/toolbar/ToolbarGraphFieldsArea'
import { ToolbarOrchestratorArea } from '@/features/toolbar/ToolbarOrchestratorArea'
import { ToolbarRenderArea } from '@/features/toolbar/ToolbarRenderArea'
import { ToolbarSettingsArea } from '@/features/toolbar/ToolbarSettingsArea'
import { ToolbarHistoryArea } from '@/features/toolbar/ToolbarHistoryArea'
import { ToolbarValidationArea } from '@/features/toolbar/ToolbarValidationArea'

export interface ToolbarToolMenuAreasProps {
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
  onToolMenuAction: (
    area: ToolMenuArea,
    action: ToolMenuAction,
    payload?: ToolMenuPayload,
  ) => void
  onOpenWorkflowTab: () => void
  searchQuery?: string
}

export type ToolbarAreaRenderer = (props: ToolbarToolMenuAreasProps) => React.ReactNode

export const TOOLBAR_AREA_RENDERERS: Partial<Record<ToolMenuArea, ToolbarAreaRenderer>> = {
  sourceFiles: (props) => <ToolbarSourceFilesArea {...props} />,
  parser: (props) => (
    <ToolbarParserArea
      parserLoadOk={props.parserLoadOk}
      parserLoadMsg={props.parserLoadMsg}
      parserPreferredLanguage={props.parserPreferredLanguage}
      isExportMenuOpen={props.isParserExportMenuOpen}
    />
  ),
  markdown: (props) => <ToolbarMarkdownArea {...props} />,
  html: (props) => <ToolbarHtmlArea {...props} />,
  pdf: (props) => <ToolbarPdfArea {...props} />,
  schemaConfig: (props) => (
    <ToolbarSchemaConfigArea
      schemaOpOk={props.schemaOpOk}
      schemaOpMsg={props.schemaOpMsg}
      isExportMenuOpen={props.isSchemaExportMenuOpen}
      setIsExportMenuOpen={props.setIsSchemaExportMenuOpen}
      onExportSchemaJson={props.onExportSchemaJson}
      onExportSchemaJsonLd={props.onExportSchemaJsonLd}
      onExportSchemaCsv={props.onExportSchemaCsv}
      onCopySchemaJsonLd={props.onCopySchemaJsonLd}
      onCopySchemaJson={props.onCopySchemaJson}
      onOpenWorkflowTab={props.onOpenWorkflowTab}
    />
  ),
  graphFields: (props) => (
    <ToolbarGraphFieldsArea
      graphFieldsOpOk={props.graphFieldsOpOk}
      graphFieldsOpMsg={props.graphFieldsOpMsg}
      onExportGraphFieldSettingsJsonLd={props.onExportGraphFieldSettingsJsonLd}
      isExportMenuOpen={props.isGraphFieldsExportMenuOpen}
      setIsExportMenuOpen={props.setIsGraphFieldsExportMenuOpen}
    />
  ),
  orchestrator: (props) => (
    <ToolbarOrchestratorArea
      orchestratorOpOk={props.orchestratorOpOk}
      orchestratorOpMsg={props.orchestratorOpMsg}
    />
  ),
  render: (props) => (
    <ToolbarRenderArea
      renderOpOk={props.renderOpOk}
      renderOpMsg={props.renderOpMsg}
    />
  ),
  settings: (props) => (
    <ToolbarSettingsArea
      onExportSettingsJsonLd={props.onExportSettingsJsonLd}
      isExportMenuOpen={props.isSettingsExportMenuOpen}
      setIsExportMenuOpen={props.setIsSettingsExportMenuOpen}
    />
  ),
  history: (props) => (
    <ToolbarHistoryArea
      onExportHistoryJsonLd={props.onExportHistoryJsonLd}
      isExportMenuOpen={props.isHistoryExportMenuOpen}
      setIsExportMenuOpen={props.setIsHistoryExportMenuOpen}
    />
  ),
  validation: (props) => (
    <ToolbarValidationArea
      isExportMenuOpen={props.isValidationExportMenuOpen}
      setIsExportMenuOpen={props.setIsValidationExportMenuOpen}
      hasSelection={props.hasSelection}
      onExportValidationJson={props.onExportValidationJson}
      onExportValidationMarkdown={props.onExportValidationMarkdown}
      onExportSelectionValidationJson={props.onExportSelectionValidationJson}
      onExportSelectionValidationMarkdown={props.onExportSelectionValidationMarkdown}
    />
  ),
}
