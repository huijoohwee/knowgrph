import React from 'react'
import type { RefObject } from 'react'
import BottomPanelCodeTab from '@/components/BottomPanel/BottomPanelCodeTab'
import BottomPanelParserTab from '@/components/BottomPanel/BottomPanelParserTab'
import BottomPanelSchemaTab from '@/components/BottomPanel/BottomPanelSchemaTab'
import BottomPanelStatsTab from '@/components/BottomPanel/BottomPanelStatsTab'
import { useParserBottomPanelState } from '@/features/panels/hooks/useParserBottomPanelState'
import OrchestratorSettingsSection from '@/features/panels/views/OrchestratorSettingsSection'
import OrchestratorTextEditorSection from '@/features/panels/views/OrchestratorTextEditorSection'
import BottomPanelCuratorTab from '@/components/BottomPanel/BottomPanelCuratorTab'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import SchemaUiEditorPane from '@/features/schema/ui/SchemaUiEditorPane'
import HistoryView from '@/features/panels/views/HistoryView'
import { useWorkflowExportActions } from '@/features/panels/hooks/useWorkflowExportActions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { firstWarningText, noParserMatchMessage } from '@/features/parsers/uiUtils'
import BottomPanelCurationToolbar from '@/components/BottomPanel/BottomPanelCurationToolbar'
import BottomPanelSchemaToolbar from '@/components/BottomPanel/BottomPanelSchemaToolbar'
import BottomPanelOrchestratorToolbar from '@/components/BottomPanel/BottomPanelOrchestratorToolbar'
import BottomPanelParserToolbar from '@/components/BottomPanel/BottomPanelParserToolbar'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { CodeAction } from '@/features/code-editor/actions'
import type { BottomTab } from '@/features/bottom-panel/open'
import type { GraphSchema } from '@/lib/graph/schema'
import { SCHEMA_SECTION_IDS, UI_COPY, type SchemaSectionId } from '@/lib/config'
import { useOrchestratorBottomPanelState } from '@/features/panels/hooks/useOrchestratorBottomPanelState'

import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'

type CodeEditorHandlers = {
  onChange: (value: string) => void
  onSelectionChange: (start: number, end: number) => void
  onDoubleClick: (start: number, end: number) => void
  onBlur: () => void
}

type BottomPanelBodyProps = {
  tab: BottomTab
  startTransition: (fn: () => void) => void
  setTabStore: (tab: BottomTab) => void
  codeActions: CodeAction[]
  schemaUiEditorOpen: boolean
  setSchemaUiEditorOpen: (next: boolean) => void
  schema: GraphSchema | null
  schemaError: string
  schemaUiStep31Collapsed: boolean
  schemaUiStep32Collapsed: boolean
  schemaUiStep33Collapsed: boolean
  schemaUiStep332Collapsed: boolean
  handleSchemaUiCollapseAll: () => void
  handleSchemaUiExpandAll: () => void
  setSchemaUiStep31Collapsed: (next: boolean) => void
  setSchemaUiStep32Collapsed: (next: boolean) => void
  setSchemaUiStep33Collapsed: (next: boolean) => void
  setSchemaUiStep332Collapsed: (next: boolean) => void
  codeText: string
  codeError: string
  codeRef: RefObject<MonacoTextEditorHandle | null>
  handlers: CodeEditorHandlers
  sortedNodes: GraphNode[]
  selectedNodeId: string | null
  sortedEdges: GraphEdge[]
  selectedEdgeId: string | null
  parserScriptText: string
  parserError: string
  parserErrorHook: string
  parserUiEditorOpen: boolean
  setParserUiEditorOpen: (next: boolean) => void
  searchQuery: string
  nodes: GraphNode[]
  schemaText: string
  setSchemaText: (v: string) => void
}

export default function BottomPanelBody({
  tab,
  startTransition,
  setTabStore,
  codeActions,
  schemaUiEditorOpen,
  setSchemaUiEditorOpen,
  schema,
  schemaError,
  schemaUiStep31Collapsed,
  schemaUiStep32Collapsed,
  schemaUiStep33Collapsed,
  schemaUiStep332Collapsed,
  handleSchemaUiCollapseAll,
  handleSchemaUiExpandAll,
  setSchemaUiStep31Collapsed,
  setSchemaUiStep32Collapsed,
  setSchemaUiStep33Collapsed,
  setSchemaUiStep332Collapsed,
  codeText,
  codeError,
  codeRef,
  handlers,
  sortedNodes,
  selectedNodeId,
  sortedEdges,
  selectedEdgeId,
  parserScriptText,
  parserError,
  parserErrorHook,
  parserUiEditorOpen,
  setParserUiEditorOpen,
  searchQuery,
  nodes,
  schemaText,
  setSchemaText,
}: BottomPanelBodyProps) {
  const {
    parserSelectionProps,
    parserDataProps,
    areAllSectionsCollapsed: areAllParserSectionsCollapsed,
    setAllSectionsCollapsed: setAllParserSectionsCollapsed,
  } = useParserBottomPanelState()
  const graphData = useGraphStore(s => s.graphData)
  const graphSchema = useGraphStore(s => s.schema)
  const captureCanvasPngSnapshot = useGraphStore(s => s.captureCanvasPngSnapshot)
  const captureCanvasSvgSnapshot = useGraphStore(s => s.captureCanvasSvgSnapshot)
  const bottomPanelCurationView = useGraphStore(s => s.bottomPanelCurationView)
  const setBottomPanelCurationView = useGraphStore(s => s.setBottomPanelCurationView)
  const {
    view: orchestratorView,
    setView: setOrchestratorView,
    sections: orchestratorSections,
    areAllSectionsCollapsed: areAllOrchestratorSectionsCollapsed,
    setAllSectionsCollapsed: setAllOrchestratorSectionsCollapsed,
  } = useOrchestratorBottomPanelState()
  const orchestratorSectionCollapsedById = orchestratorSections.byId
  const orchestratorSectionSetters = orchestratorSections.setters

  const orchestratorGraphRagCollapsed = orchestratorSectionCollapsedById.graphRag
  const orchestratorPresetsCollapsed = orchestratorSectionCollapsedById.presets
  const orchestratorEditorCollapsed = orchestratorSectionCollapsedById.editor
  const orchestratorContextCollapsed = orchestratorSectionCollapsedById.context
  const orchestratorWorkflowIndexingCollapsed = orchestratorSectionCollapsedById.workflowIndexing
  const orchestratorWorkflowTracingCollapsed = orchestratorSectionCollapsedById.workflowTracing

  const setOrchestratorGraphRagCollapsed = orchestratorSectionSetters.graphRag
  const setOrchestratorPresetsCollapsed = orchestratorSectionSetters.presets
  const setOrchestratorEditorCollapsed = orchestratorSectionSetters.editor
  const setOrchestratorContextCollapsed = orchestratorSectionSetters.context
  const setOrchestratorWorkflowIndexingCollapsed = orchestratorSectionSetters.workflowIndexing
  const setOrchestratorWorkflowTracingCollapsed = orchestratorSectionSetters.workflowTracing
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const schemaSectionCollapsedById: Record<SchemaSectionId, boolean> = {
    schemaApplyPresets: schemaUiStep31Collapsed,
    schemaTuneRules: schemaUiStep32Collapsed,
    schemaCustomizeUi: schemaUiStep33Collapsed,
    schemaValidationRules: schemaUiStep332Collapsed,
  }

  const allSchemaSectionsCollapsed = SCHEMA_SECTION_IDS.every(id => schemaSectionCollapsedById[id])

  const toggleButtonClassName = React.useCallback(
    (isActive: boolean) =>
      `App-toolbar__btn text-xs ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`,
    [],
  )

  const openPanelTab = React.useCallback(
    (nextTab: BottomTab) => {
      startTransition(() => setTabStore(nextTab))
    },
    [setTabStore, startTransition],
  )
  const isGraphJsonView = tab === 'curation' && bottomPanelCurationView === 'json'


  const validateGraph = React.useCallback(() => {
    try {
      parserDataProps.onValidateGraph()
    } catch {
      void 0
    }
  }, [parserDataProps])

  const { importHistoryJsonLd } = useWorkflowExportActions({
    parserDataExports: parserDataProps,
    graphData,
    graphSchema,
    selectedNodeId,
    selectedEdgeId,
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
  })

  const parserMessage = noParserMatchMessage(
    parserSelectionProps.detection.attemptedAutoDetect,
    parserSelectionProps.detection.inputText,
  )
  const warningText = firstWarningText(parserSelectionProps.detection.warnings)

  const hasMermaidFrontmatterInCode = React.useMemo(() => {
    if (!codeText) return false
    // Simple check for markdown frontmatter mermaid block or JSON mermaid field
    if (codeText.includes('mermaid:') && codeText.includes('graph ')) return true
    if (codeText.includes('"mermaid":')) return true
    return false
  }, [codeText])

  const mermaidHint = hasMermaidFrontmatterInCode ? (
    <div className="flex items-center gap-2 mb-1">
      <div className={`text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100`}>
        Info: Frontmatter Mermaid diagram is available.
      </div>
    </div>
  ) : null

  return (
    <>
      {(tab === 'curation' || tab === 'nodes' || tab === 'edges' || tab === 'code') && (
        <BottomPanelCurationToolbar
          tab={tab}
          bottomPanelCurationView={bottomPanelCurationView}
          isGraphJsonView={isGraphJsonView}
          codeActions={codeActions}
          toggleButtonClassName={toggleButtonClassName}
          openPanelTab={openPanelTab}
          setBottomPanelCurationView={setBottomPanelCurationView}
          onValidateGraph={validateGraph}
        />
      )}

      {tab === 'schema' && (
        <BottomPanelSchemaToolbar
          schemaUiEditorOpen={schemaUiEditorOpen}
          toggleButtonClassName={toggleButtonClassName}
          setSchemaUiEditorOpen={setSchemaUiEditorOpen}
          allSchemaSectionsCollapsed={allSchemaSectionsCollapsed}
          handleSchemaUiCollapseAll={handleSchemaUiCollapseAll}
          handleSchemaUiExpandAll={handleSchemaUiExpandAll}
        />
      )}

      {tab === 'orchestrator' && (
        <BottomPanelOrchestratorToolbar
          orchestratorView={orchestratorView}
          setOrchestratorView={setOrchestratorView}
          areAllOrchestratorSectionsCollapsed={areAllOrchestratorSectionsCollapsed}
          setAllOrchestratorSectionsCollapsed={setAllOrchestratorSectionsCollapsed}
          toggleButtonClassName={toggleButtonClassName}
        />
      )}

      {tab === 'parser' && (
        <BottomPanelParserToolbar
          parserUiEditorOpen={parserUiEditorOpen}
          setParserUiEditorOpen={setParserUiEditorOpen}
          toggleButtonClassName={toggleButtonClassName}
          parserMessage={parserMessage}
          warningText={warningText}
          hasSelectedSpec={parserSelectionProps.detection.hasSelectedSpec}
          areAllParserSectionsCollapsed={areAllParserSectionsCollapsed}
          setAllParserSectionsCollapsed={setAllParserSectionsCollapsed}
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-1">
        {tab === 'code' ? (
          <BottomPanelCodeTab
            codeText={codeText}
            codeError={codeError}
            codeRef={codeRef}
            handlers={handlers}
            readOnly={false}
            header={
              <div className="flex flex-col gap-1">
                <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>{UI_COPY.bottomPanelViewingGraphJsonLabel}</div>
                {mermaidHint}
              </div>
            }
          />
        ) : tab === 'curation' || tab === 'nodes' || tab === 'edges' ? (
          bottomPanelCurationView === 'json' ? (
            <BottomPanelCodeTab
              codeText={codeText}
              codeError={codeError}
              codeRef={codeRef}
              handlers={handlers}
              readOnly={false}
              header={mermaidHint}
            />
          ) : bottomPanelCurationView === 'markdown' ? (
            <BottomPanelMarkdownSection />
          ) : (
            <BottomPanelCuratorTab
              nodes={sortedNodes}
              edges={sortedEdges}
            />
          )
        ) : tab === 'stats' ? (
          <BottomPanelStatsTab />
        ) : tab === 'parser' ? (
          <BottomPanelParserTab
            parserScriptText={parserScriptText}
            parserError={parserError}
            parserErrorHook={parserErrorHook}
            parserUiEditorOpen={parserUiEditorOpen}
            parserSelectionProps={parserSelectionProps}
            parserDataProps={parserDataProps}
          />
        ) : tab === 'orchestrator' ? (
          <div className="h-full min-h-0 flex flex-col overflow-auto">
            {orchestratorView === 'ui' ? (
              <OrchestratorSettingsSection
                variant="bottomPanel"
                graphRagCollapsed={orchestratorGraphRagCollapsed}
                presetsCollapsed={orchestratorPresetsCollapsed}
                editorCollapsed={orchestratorEditorCollapsed}
                contextCollapsed={orchestratorContextCollapsed}
                setGraphRagCollapsed={setOrchestratorGraphRagCollapsed}
                setPresetsCollapsed={setOrchestratorPresetsCollapsed}
                setEditorCollapsed={setOrchestratorEditorCollapsed}
                setContextCollapsed={setOrchestratorContextCollapsed}
                indexingCollapsed={orchestratorWorkflowIndexingCollapsed}
                setIndexingCollapsed={setOrchestratorWorkflowIndexingCollapsed}
                tracingCollapsed={orchestratorWorkflowTracingCollapsed}
                setTracingCollapsed={setOrchestratorWorkflowTracingCollapsed}
              />
            ) : (
              <OrchestratorTextEditorSection />
            )}
          </div>
        ) : tab === 'render' ? (
          <BottomPanelCodeTab codeText={codeText} codeError={codeError} codeRef={codeRef} handlers={handlers} />
        ) : tab === 'history' ? (
          <div className="h-full min-h-0 flex flex-col overflow-auto">
            <div className="px-3 py-2 border-b border-gray-200">
              <button
                type="button"
                className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
                onClick={importHistoryJsonLd}
              >
                {UI_COPY.bottomPanelImportHistoryJsonLdAgenticRagButtonLabel}
              </button>
            </div>
            <HistoryView searchQuery={searchQuery} />
          </div>
        ) : tab === 'schema' && schemaUiEditorOpen && schema ? (
          <SchemaUiEditorPane
            schemaError={schemaError}
            schemaUiStep31Collapsed={schemaUiStep31Collapsed}
            schemaUiStep32Collapsed={schemaUiStep32Collapsed}
            schemaUiStep33Collapsed={schemaUiStep33Collapsed}
            schemaUiStep332Collapsed={schemaUiStep332Collapsed}
            onToggleStep31={next => setSchemaUiStep31Collapsed(next)}
            onToggleStep32={next => setSchemaUiStep32Collapsed(next)}
            onToggleStep33={next => setSchemaUiStep33Collapsed(next)}
            onToggleStep332={next => setSchemaUiStep332Collapsed(next)}
          />
        ) : (
          <BottomPanelSchemaTab schemaText={schemaText} schemaError={schemaError} onSchemaTextChange={setSchemaText} />
        )}
        <datalist id="node-ids">
          {nodes.map(n => (
            <option key={n.id} value={n.id} />
          ))}
        </datalist>
      </div>
    </>
  )
}
