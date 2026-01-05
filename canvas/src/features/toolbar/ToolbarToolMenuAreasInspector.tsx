import React from 'react'
import { TOOL_MENU_AREAS } from '@/features/toolbar/toolMenu'
import { TOOLBAR_AREA_RENDERERS, type ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { useGraphStore } from '@/hooks/useGraphStore'

export function ToolbarToolMenuAreasInspector() {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )

  const mockedProps: ToolbarToolMenuAreasProps = {
    dataLoadOk: true,
    dataLoadMsg: 'Data loaded',
    parserLoadOk: true,
    parserLoadMsg: 'Parser ready',
    parserPreferredLanguage: 'json',
    schemaOpOk: true,
    schemaOpMsg: 'Schema config ready',
    graphFieldsOpOk: true,
    graphFieldsOpMsg: 'Graph fields ready',
    orchestratorOpOk: true,
    orchestratorOpMsg: 'Orchestrator ready',
    renderOpOk: true,
    renderOpMsg: 'Renderer ready',
    isCuratorExportMenuOpen: false,
    setIsCuratorExportMenuOpen: () => {},
    isParserExportMenuOpen: false,
    setIsParserExportMenuOpen: () => {},
    isMarkdownImportMenuOpen: false,
    setIsMarkdownImportMenuOpen: () => {},
    isSchemaExportMenuOpen: false,
    setIsSchemaExportMenuOpen: () => {},
    isGraphFieldsExportMenuOpen: false,
    setIsGraphFieldsExportMenuOpen: () => {},
    isSettingsExportMenuOpen: false,
    setIsSettingsExportMenuOpen: () => {},
    isHistoryExportMenuOpen: false,
    setIsHistoryExportMenuOpen: () => {},
    isValidationExportMenuOpen: false,
    setIsValidationExportMenuOpen: () => {},
    onExportSchemaJson: () => {},
    onExportSchemaJsonLd: () => {},
    onExportSchemaCsv: () => {},
    onExportGraphJsonLd: () => {},
    onExportGraphJson: () => {},
    onExportGraphCsvCombined: () => {},
    onExportGraphMl: () => {},
    onExportGraphCypher: () => {},
    onCopyGraphJsonLd: () => {},
    onCopyGraphJson: () => {},
    hasSelection: false,
    onExportSelectionJsonLd: () => {},
    onExportSelectionJson: () => {},
    onExportSelectionCsvCombined: () => {},
    onExportSelectionGraphMl: () => {},
    onExportSelectionCypher: () => {},
    onCopySchemaJsonLd: () => {},
    onCopySchemaJson: () => {},
    onExportGraphFieldSettingsJsonLd: () => {},
    onExportSettingsJsonLd: () => {},
    onExportHistoryJsonLd: () => {},
    onExportValidationJson: () => {},
    onExportValidationMarkdown: () => {},
    onExportSelectionValidationJson: () => {},
    onExportSelectionValidationMarkdown: () => {},
    onToolMenuAction: () => {},
    onOpenWorkflowTab: () => {},
    onOpenData: () => {},
    onRunPipeline: () => {},
  }

  return (
    <div className="p-4 space-y-3 bg-gray-50">
      {TOOL_MENU_AREAS.map(area => {
        const renderArea = TOOLBAR_AREA_RENDERERS[area.key]
        return (
          <div
            key={area.key}
            className="border border-gray-200 rounded-md bg-white p-3"
          >
            <div className="text-xs font-semibold text-gray-900 mb-1">
              {area.label}
            </div>
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500 mb-2`}>
              {area.description}
            </div>
            <div>{renderArea ? renderArea(mockedProps) : null}</div>
          </div>
        )
      })}
    </div>
  )
}
