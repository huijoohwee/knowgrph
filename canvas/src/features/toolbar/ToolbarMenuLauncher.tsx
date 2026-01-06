import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Upload, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { useParserUIState } from '@/features/parsers/uiState'
import { useParserWorkflowState } from '@/features/parsers/useParserWorkflowState'
import { useWorkflowExportActions } from '@/features/panels/hooks/useWorkflowExportActions'
import { useToolMenuShortcuts } from '@/features/toolbar/useToolMenuShortcuts'
import { useToolMenuState } from '@/features/toolbar/useToolMenuState'
import { ToolbarToolMenu } from '@/features/toolbar/ToolbarToolMenu'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import {
  PROPS_PANEL_OPEN_EVENT,
  RENDERER_FLOATING_PANEL_OPEN_EVENT,
  RENDERER_PANEL_OPEN_EVENT,
  type PropsPanelOpenEventDetail,
} from '@/features/canvas/utils'
import { IMPORT_EXPORT_STATUS_COPY, LS_KEYS, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { lsBool } from '@/lib/persistence'
import { useToolbarMenuAction } from '@/features/toolbar/useToolbarMenuAction'
import { runAgenticRagDemo } from '@/__tests__/demo/runner'

type ToolbarMenuLauncherProps = {
  onOpenMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'settings') => void
}

export function ToolbarMenuLauncher({ onOpenMainPanel }: ToolbarMenuLauncherProps) {
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

  const parserPreferredLanguage = useParserUIState(s => s.preferredLanguage)
  const parserLoadOk = useParserUIState(s => s.parserLoadOk)
  const parserLoadMsg = useParserUIState(s => s.parserLoadMsg)
  const dataLoadOk = useParserUIState(s => s.dataLoadOk)
  const dataLoadMsg = useParserUIState(s => s.dataLoadMsg)

  const { parserDataProps } = useParserWorkflowState()

  const floatingPanelRequestSeqRef = useRef(0)
  const [floatingPanelRequestedView, setFloatingPanelRequestedView] = useState<
    { view: 'workspaceActions' | 'propsPanel' | 'renderer' | 'graphTraversal'; seq: number } | null
  >(null)

  const {
    isToolMenuOpen,
    setIsToolMenuOpen,
    isCuratorExportMenuOpen,
    setIsCuratorExportMenuOpen,
    isParserExportMenuOpen,
    setIsParserExportMenuOpen,
    isMarkdownImportMenuOpen,
    setIsMarkdownImportMenuOpen,
    isHtmlImportMenuOpen,
    setIsHtmlImportMenuOpen,
    isSchemaExportMenuOpen,
    setIsSchemaExportMenuOpen,
    isGraphFieldsExportMenuOpen,
    setIsGraphFieldsExportMenuOpen,
    isSettingsExportMenuOpen,
    setIsSettingsExportMenuOpen,
    isHistoryExportMenuOpen,
    setIsHistoryExportMenuOpen,
    isValidationExportMenuOpen,
    setIsValidationExportMenuOpen,
    pipelineStatus,
    setPipelineStatus,
    toolMenuButtonRef,
    toolMenuCardRef,
    toolMenuCardStyle,
    setToolMenuDragPos,
    handleToolMenuCardPointerDown,
    handleRunCodebaseIndexPipeline,
    closeToolMenu,
    toggleToolMenu,
  } = useToolMenuState()

  const handleRunDemo = useCallback(async () => {
    await runAgenticRagDemo(setPipelineStatus)
  }, [setPipelineStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOpenPropsPanel = (event: Event) => {
      floatingPanelRequestSeqRef.current += 1
        setFloatingPanelRequestedView({
          view: 'propsPanel',
          seq: floatingPanelRequestSeqRef.current,
        })
        try {
          const isPinned = lsBool(LS_KEYS.floatingPanelPinned, false)
          const custom = event as CustomEvent<PropsPanelOpenEventDetail>
          const detail = custom.detail
          const clientX = detail && typeof detail.clientX === 'number' ? detail.clientX : null
          const clientY = detail && typeof detail.clientY === 'number' ? detail.clientY : null
        if (!isPinned && clientX !== null && clientY !== null && Number.isFinite(clientX) && Number.isFinite(clientY)) {
          const padding = 8
          const estimatedWidth = 320
          const estimatedHeight = 420
          const maxLeft = Math.max(padding, window.innerWidth - estimatedWidth - padding)
          const maxTop = Math.max(padding, window.innerHeight - estimatedHeight - padding)
          setToolMenuDragPos({
            top: Math.min(Math.max(padding, clientY), maxTop),
            left: Math.min(Math.max(padding, clientX), maxLeft),
          })
        }
      } catch {
        void 0
      }
      setIsToolMenuOpen(true)
    }
    const handleOpenRenderer = () => {
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view: 'renderer',
        seq: floatingPanelRequestSeqRef.current,
      })
      setIsToolMenuOpen(true)
    }
    window.addEventListener(PROPS_PANEL_OPEN_EVENT, handleOpenPropsPanel)
    window.addEventListener(RENDERER_PANEL_OPEN_EVENT, handleOpenRenderer)
    window.addEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, handleOpenRenderer)
    return () => {
      window.removeEventListener(PROPS_PANEL_OPEN_EVENT, handleOpenPropsPanel)
      window.removeEventListener(RENDERER_PANEL_OPEN_EVENT, handleOpenRenderer)
      window.removeEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, handleOpenRenderer)
    }
  }, [setIsToolMenuOpen, setToolMenuDragPos])

  const orchestratorImportInputRef = useRef<HTMLInputElement | null>(null)

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
    importGraphRagWorkflowFromText,
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

  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const handleImportGraphRagConfigToolbar: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    event => {
      const fileList = event.target.files
      const file = fileList && fileList[0]
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        const text = typeof result === 'string' ? result : ''
        importGraphRagWorkflowFromText(file.name, text)
      }
      reader.onerror = () => {
        try {
          const state = useGraphStore.getState()
          state.setOrchestratorOpStatus(false, IMPORT_EXPORT_STATUS_COPY.importReadFileFailed)
          try {
            state.setRenderOpStatus(false, IMPORT_EXPORT_STATUS_COPY.importReadFileFailed)
          } catch {
            void 0
          }
        } catch {
          void 0
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [importGraphRagWorkflowFromText],
  )

  const openWorkflowTab = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'workflow' } }))
      }
    } catch {
      void 0
    }
  }, [])

  const handleToolMenuAction = useToolbarMenuAction({
    closeToolMenu,
    openWorkflowTab,
    onOpenMainPanel,
    orchestratorImportInputRef,
    setIsMarkdownImportMenuOpen,
    setIsHtmlImportMenuOpen,
    setIsSchemaExportMenuOpen,
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

  useToolMenuShortcuts(handleToolMenuAction)

  return (
    <>
      <IconButton
        ref={toolMenuButtonRef}
        className={`App-toolbar__btn ${dataLoadOk === true ? 'text-green-600' : dataLoadOk === false ? 'text-red-600' : 'text-gray-600'}`}
        title={dataLoadOk === true ? UI_LABELS.openData : UI_LABELS.loadStatus}
        onClick={toggleToolMenu}
      >
        {dataLoadOk === true ? (
          <div className="flex items-center gap-1">
            <CheckCircle className={iconSizeClass} />
            <span className="text-xs max-w-20 truncate">{dataLoadMsg}</span>
            <ChevronDown className={iconSizeClass} />
          </div>
        ) : dataLoadOk === false ? (
          <div className="flex items-center gap-1">
            <XCircle className={iconSizeClass} />
            <span className="text-xs max-w-20 truncate">{dataLoadMsg}</span>
            <ChevronDown className={iconSizeClass} />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Upload className={iconSizeClass} />
            <span className="text-xs max-w-20 truncate">{UI_LABELS.floatingPanel}</span>
            <ChevronDown className={iconSizeClass} />
          </div>
        )}
      </IconButton>
      <input
        ref={orchestratorImportInputRef}
        type="file"
        accept=".json,.jsonld,.json-ld,.yaml,.yml"
        className="hidden"
        onChange={handleImportGraphRagConfigToolbar}
      />
      {isToolMenuOpen && (
        <ToolbarToolMenu
          dataLoadOk={dataLoadOk}
          dataLoadMsg={dataLoadMsg}
          parserLoadOk={parserLoadOk}
          parserLoadMsg={parserLoadMsg}
          parserPreferredLanguage={parserPreferredLanguage}
          schemaOpOk={schemaOpOk}
          schemaOpMsg={schemaOpMsg}
          graphFieldsOpOk={graphFieldsOpOk}
          graphFieldsOpMsg={graphFieldsOpMsg}
          orchestratorOpOk={orchestratorOpOk}
          orchestratorOpMsg={orchestratorOpMsg}
          renderOpOk={renderOpOk}
          renderOpMsg={renderOpMsg}
          pipelineStatus={pipelineStatus}
          isCuratorExportMenuOpen={isCuratorExportMenuOpen}
          setIsCuratorExportMenuOpen={setIsCuratorExportMenuOpen}
          isParserExportMenuOpen={isParserExportMenuOpen}
          setIsParserExportMenuOpen={setIsParserExportMenuOpen}
          isMarkdownImportMenuOpen={isMarkdownImportMenuOpen}
          setIsMarkdownImportMenuOpen={setIsMarkdownImportMenuOpen}
          isHtmlImportMenuOpen={isHtmlImportMenuOpen}
          setIsHtmlImportMenuOpen={setIsHtmlImportMenuOpen}
          isSchemaExportMenuOpen={isSchemaExportMenuOpen}
          setIsSchemaExportMenuOpen={setIsSchemaExportMenuOpen}
          isGraphFieldsExportMenuOpen={isGraphFieldsExportMenuOpen}
          setIsGraphFieldsExportMenuOpen={setIsGraphFieldsExportMenuOpen}
          isSettingsExportMenuOpen={isSettingsExportMenuOpen}
          setIsSettingsExportMenuOpen={setIsSettingsExportMenuOpen}
          isHistoryExportMenuOpen={isHistoryExportMenuOpen}
          setIsHistoryExportMenuOpen={setIsHistoryExportMenuOpen}
          isValidationExportMenuOpen={isValidationExportMenuOpen}
          setIsValidationExportMenuOpen={setIsValidationExportMenuOpen}
          onExportSchemaJson={exportSchemaJson}
          onExportSchemaJsonLd={exportSchemaJsonLd}
          onExportSchemaCsv={exportSchemaCsv}
          onExportGraphJsonLd={exportGraphJsonLd}
          onExportGraphJson={exportGraphJson}
          onExportGraphCsvCombined={exportGraphCsvCombined}
          onExportGraphMl={exportGraphGraphMl}
          onExportGraphCypher={exportGraphCypher}
          hasSelection={hasSelection}
          onExportSelectionJsonLd={hasSelection ? exportSelectionJsonLd : undefined}
          onExportSelectionJson={hasSelection ? exportSelectionJson : undefined}
          onExportSelectionCsvCombined={hasSelection ? exportSelectionCsvCombined : undefined}
          onExportSelectionGraphMl={hasSelection ? exportSelectionGraphMl : undefined}
          onExportSelectionCypher={hasSelection ? exportSelectionCypher : undefined}
          onCopySchemaJsonLd={copySchemaJsonLd}
          onCopySchemaJson={copySchemaJson}
          onCopyGraphJsonLd={copyGraphJsonLd}
          onCopyGraphJson={copyGraphJson}
          onExportGraphFieldSettingsJsonLd={exportGraphFieldSettingsJsonLd}
          onExportSettingsJsonLd={exportSettingsJsonLd}
          onExportHistoryJsonLd={exportHistoryJsonLd}
          onExportValidationJson={exportValidationJson}
          onExportValidationMarkdown={exportValidationMarkdown}
          onExportSelectionValidationJson={hasSelection ? exportSelectionValidationJson : undefined}
          onExportSelectionValidationMarkdown={hasSelection ? exportSelectionValidationMarkdown : undefined}
          toolMenuCardRef={toolMenuCardRef}
          toolMenuCardStyle={toolMenuCardStyle}
          onHeaderPointerDown={handleToolMenuCardPointerDown}
          requestedFloatingPanelView={floatingPanelRequestedView?.view}
          requestedFloatingPanelViewSeq={floatingPanelRequestedView?.seq}
          onOpenData={() => {
            if (dataLoadOk === true) {
              openBottomPanel('data')
            }
            closeToolMenu()
          }}
          onRunPipeline={handleRunCodebaseIndexPipeline}
          onRunDemo={handleRunDemo}
          onClose={closeToolMenu}
          onToolMenuAction={handleToolMenuAction}
          onOpenWorkflowTab={openWorkflowTab}
        />
      )}
    </>
  )
}
