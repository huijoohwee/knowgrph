import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useParserUIState } from '@/features/parsers/uiState'
import { useParserWorkflowState } from '@/features/parsers/useParserWorkflowState'
import { useWorkflowExportActions } from '@/features/panels/hooks/useWorkflowExportActions'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useToolbarMenuAction } from '@/features/toolbar/useToolbarMenuAction'
import type { ToolbarToolMenuAreasProps } from '@/features/toolbar/ToolbarToolMenuAreas.registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useWorkspaceActionsMenuState } from '@/features/workspace-actions/useWorkspaceActionsMenuState'

export function useWorkspaceActionsModel(args?: { searchQuery?: string }) {
  const { searchQuery } = args || {}
  const menu = useWorkspaceActionsMenuState()

  const parserPreferredLanguage = useParserUIState(s => s.preferredLanguage)
  const parserLoadOk = useParserUIState(s => s.parserLoadOk)
  const parserLoadMsg = useParserUIState(s => s.parserLoadMsg)
  const dataLoadOk = useParserUIState(s => s.dataLoadOk)
  const dataLoadMsg = useParserUIState(s => s.dataLoadMsg)

  const {
    graphData,
    graphSchema,
    selectedNodeId,
    selectedEdgeId,
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphSchema: s.schema,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      captureCanvasSvgSnapshot: s.captureCanvasSvgSnapshot,
      captureCanvasPngSnapshot: s.captureCanvasPngSnapshot,
    })),
  )

  const { parserDataProps } = useParserWorkflowState()

  const {
    hasSelection,
    exportGraphJsonLd,
    exportGraphJson,
    exportGraphCsvCombined,
    exportGraphGraphMl,
    exportGraphCypher,
    exportGraphRagWorkflowJsonLd,
    exportSettingsJsonLd,
    exportHistoryJsonLd,
    exportGraphFieldSettingsJsonLd,
    exportValidationJson,
    exportValidationMarkdown,
    exportSelectionValidationJson,
    exportSelectionValidationMarkdown,
    copyGraphJsonLd,
    copyGraphJson,
    exportSchemaJson,
    exportSchemaJsonLd,
    exportSchemaCsv,
    copySchemaJsonLd,
    copySchemaJson,
    exportSelectionJsonLd,
    exportSelectionJson,
    exportSelectionCsvCombined,
    exportSelectionGraphMl,
    exportSelectionCypher,
    importSchemaJsonOrJsonLd,
    importGraphRagWorkflowJsonLd,
    importSettingsJsonLd,
    importHistoryJsonLd,
    importGraphFieldSettingsJsonLd,
  } = useWorkflowExportActions({
    parserDataExports: parserDataProps,
    graphData,
    graphSchema,
    selectedNodeId,
    selectedEdgeId,
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
  })

  const schemaOpOk = useGraphStore(s => s.schemaOpOk)
  const schemaOpMsg = useGraphStore(s => s.schemaOpMsg)
  const graphFieldsOpOk = useGraphStore(s => s.graphFieldsOpOk)
  const graphFieldsOpMsg = useGraphStore(s => s.graphFieldsOpMsg)
  const orchestratorOpOk = useGraphStore(s => s.orchestratorOpOk)
  const orchestratorOpMsg = useGraphStore(s => s.orchestratorOpMsg)
  const renderOpOk = useGraphStore(s => s.renderOpOk)
  const renderOpMsg = useGraphStore(s => s.renderOpMsg)

  const openWorkflowTab = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'workflow' } }))
      }
    } catch {
      void 0
    }
  }, [])

  const closeWorkspaceActionsMenus = useCallback(() => {
    menu.closeAllMenus()
  }, [menu])

  const handleToolMenuAction = useToolbarMenuAction({
    closeToolMenu: closeWorkspaceActionsMenus,
    openWorkflowTab,
    onOpenMainPanel: () => {},
    setIsMarkdownImportMenuOpen: menu.setIsMarkdownImportMenuOpen,
    setIsHtmlImportMenuOpen: menu.setIsHtmlImportMenuOpen,
    setIsPdfImportMenuOpen: menu.setIsPdfImportMenuOpen,
    setIsSchemaExportMenuOpen: menu.setIsSchemaExportMenuOpen,
    exportGraphJsonLd,
    exportGraphJson,
    exportGraphFieldSettingsJsonLd,
    exportGraphRagWorkflowJsonLd,
    exportHistoryJsonLd,
    exportSettingsJsonLd,
    importGraphFieldSettingsJsonLd,
    importGraphRagWorkflowJsonLd,
    importHistoryJsonLd,
    importSchemaJsonOrJsonLd,
    importSettingsJsonLd,
  })

  const panelProps: ToolbarToolMenuAreasProps = {
    dataLoadOk,
    dataLoadMsg,
    parserLoadOk,
    parserLoadMsg,
    parserPreferredLanguage,
    schemaOpOk,
    schemaOpMsg,
    graphFieldsOpOk,
    graphFieldsOpMsg,
    orchestratorOpOk,
    orchestratorOpMsg,
    renderOpOk,
    renderOpMsg,
    isParserExportMenuOpen: menu.isParserExportMenuOpen,
    setIsParserExportMenuOpen: menu.setIsParserExportMenuOpen,
    isMarkdownImportMenuOpen: menu.isMarkdownImportMenuOpen,
    setIsMarkdownImportMenuOpen: menu.setIsMarkdownImportMenuOpen,
    isHtmlImportMenuOpen: menu.isHtmlImportMenuOpen,
    setIsHtmlImportMenuOpen: menu.setIsHtmlImportMenuOpen,
    isPdfImportMenuOpen: menu.isPdfImportMenuOpen,
    setIsPdfImportMenuOpen: menu.setIsPdfImportMenuOpen,
    isYouTubeImportMenuOpen: menu.isYouTubeImportMenuOpen,
    setIsYouTubeImportMenuOpen: menu.setIsYouTubeImportMenuOpen,
    isJsonImportMenuOpen: menu.isJsonImportMenuOpen,
    setIsJsonImportMenuOpen: menu.setIsJsonImportMenuOpen,
    isJsonLdImportMenuOpen: menu.isJsonLdImportMenuOpen,
    setIsJsonLdImportMenuOpen: menu.setIsJsonLdImportMenuOpen,
    isSchemaExportMenuOpen: menu.isSchemaExportMenuOpen,
    setIsSchemaExportMenuOpen: menu.setIsSchemaExportMenuOpen,
    isGraphFieldsExportMenuOpen: menu.isGraphFieldsExportMenuOpen,
    setIsGraphFieldsExportMenuOpen: menu.setIsGraphFieldsExportMenuOpen,
    isSettingsExportMenuOpen: menu.isSettingsExportMenuOpen,
    setIsSettingsExportMenuOpen: menu.setIsSettingsExportMenuOpen,
    isHistoryExportMenuOpen: menu.isHistoryExportMenuOpen,
    setIsHistoryExportMenuOpen: menu.setIsHistoryExportMenuOpen,
    isValidationExportMenuOpen: menu.isValidationExportMenuOpen,
    setIsValidationExportMenuOpen: menu.setIsValidationExportMenuOpen,
    onExportSchemaJson: exportSchemaJson,
    onExportSchemaJsonLd: exportSchemaJsonLd,
    onExportSchemaCsv: exportSchemaCsv,
    onExportGraphJsonLd: exportGraphJsonLd,
    onExportGraphJson: exportGraphJson,
    onExportGraphCsvCombined: exportGraphCsvCombined,
    onExportGraphMl: exportGraphGraphMl,
    onExportGraphCypher: exportGraphCypher,
    onCopyGraphJsonLd: copyGraphJsonLd,
    onCopyGraphJson: copyGraphJson,
    hasSelection,
    onExportSelectionJsonLd: hasSelection ? exportSelectionJsonLd : undefined,
    onExportSelectionJson: hasSelection ? exportSelectionJson : undefined,
    onExportSelectionCsvCombined: hasSelection ? exportSelectionCsvCombined : undefined,
    onExportSelectionGraphMl: hasSelection ? exportSelectionGraphMl : undefined,
    onExportSelectionCypher: hasSelection ? exportSelectionCypher : undefined,
    onCopySchemaJsonLd: copySchemaJsonLd,
    onCopySchemaJson: copySchemaJson,
    onExportGraphFieldSettingsJsonLd: exportGraphFieldSettingsJsonLd,
    onExportSettingsJsonLd: exportSettingsJsonLd,
    onExportHistoryJsonLd: exportHistoryJsonLd,
    onExportValidationJson: exportValidationJson,
    onExportValidationMarkdown: exportValidationMarkdown,
    onExportSelectionValidationJson: hasSelection ? exportSelectionValidationJson : undefined,
    onExportSelectionValidationMarkdown: hasSelection ? exportSelectionValidationMarkdown : undefined,
    onToolMenuAction: handleToolMenuAction,
    onOpenWorkflowTab: openWorkflowTab,
    searchQuery: searchQuery || '',
  }

  return {
    panelProps,
    handleToolMenuAction,
    closeAllMenus: menu.closeAllMenus,
  }
}
