import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import {
  UI_COPY,
  UI_LABELS,
  AGENTIC_REASONING_LABELS_TOOLTIP,
  AGENTIC_GRAPHRAG_PIPELINE_DESCRIPTION,
  TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP,
  TRAVERSAL_PRESETS_SECTION_TOOLTIP,
} from '@/lib/config'
import { getOrchestratorSectionListLabel } from '@/features/panels/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphRagWorkflowJsonLd, DuckDbQueryConfig } from '@/features/panels/utils/graphragConfig'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
import { GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { GraphRagWorkflowSection } from '@/features/panels/views/GraphRagWorkflowSection'
import {
  OrchestratorTraversalPresetsSection,
  OrchestratorTraversalAndLayersSection,
} from '@/features/panels/views/OrchestratorTraversalPanels'
import type { GraphRagPathHelper } from '@/features/panels/views/OrchestratorTraversalPanelsModel'
import type { OrchestratorTraversalSectionViewModel } from '@/features/panels/views/OrchestratorTraversalSectionModel'
import type {
  AgenticRagContextComparison,
  AgenticRagIgnoreFiltersSummary,
} from '@/lib/graph/jsonld/index'

interface OrchestratorTraversalWorkflowProps {
  workflowDoc: GraphRagWorkflowJsonLd
  workflowSource: 'loaded' | 'generated' | 'invalid' | 'parse-error'
  workflowError: string | null
  workflowValidationErrors: string[]
  traversalDelayMs: number
  onChangeTraversalDelayMs: (value: number) => void
  lastTraversal: TraversalSummary | null
  onUpdateWorkflow: (updater: (current: GraphRagWorkflowJsonLd) => GraphRagWorkflowJsonLd) => void
  indexingCollapsed: boolean
  onToggleIndexingCollapsed: (next: boolean) => void
  tracingCollapsed: boolean
  onToggleTracingCollapsed: (next: boolean) => void
  agenticContext: AgenticRagContextComparison | null
  ignoreFilters: AgenticRagIgnoreFiltersSummary | null
  onChangeAgenticContextUrl: (value: string) => void
  onChangeIgnoreCodebasePaths: (value: string) => void
}

interface OrchestratorTraversalPresetsProps {
  runGraphRagTraversal: () => void
  traversalStartNodeId: string
  setTraversalStartNodeId: (value: string) => void
  traversalMaxDepth: number
  setTraversalMaxDepth: (value: number) => void
  traversalLabelFilter: string
  setTraversalLabelFilter: (value: string) => void
  runGenericTraversalQuery: () => void
  selectedNodeId: string | null
  graphRagPathHelper: GraphRagPathHelper | null
  graphNodesById: Record<string, { label: string }>
  selectNode: (id: string | null) => void
  duckdbQueriesFromConfig?: DuckDbQueryConfig[]
}

interface OrchestratorTraversalEditorProps {
  traversalViewModel: OrchestratorTraversalSectionViewModel
  schema: GraphSchema
  setSchema: (schema: GraphSchema) => void
  setThreeConfig: (config: Partial<GraphSchema['three']>) => void
  setCharge: (value: number) => void
  setCollisionByType: (type: string, radius: number) => void
  traversalDelayMs: number
  onChangeTraversalDelayMs: (value: number) => void
}

interface OrchestratorTraversalSectionProps {
  variant: 'floatingPanel' | 'bottomPanel'
  graphRagCollapsed: boolean
  presetsCollapsed: boolean
  editorCollapsed: boolean
  showPresetsAndEditor: boolean
  setGraphRagCollapsed: (next: boolean) => void
  setPresetsCollapsed: (next: boolean) => void
  setEditorCollapsed: (next: boolean) => void
  workflowProps: OrchestratorTraversalWorkflowProps
  presetsProps: OrchestratorTraversalPresetsProps
  editorProps: OrchestratorTraversalEditorProps
}

export function OrchestratorTraversalSection({
  variant,
  graphRagCollapsed,
  presetsCollapsed,
  editorCollapsed,
  showPresetsAndEditor,
  setGraphRagCollapsed,
  setPresetsCollapsed,
  setEditorCollapsed,
  workflowProps,
  presetsProps,
  editorProps,
}: OrchestratorTraversalSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  return (
    <>
      <CollapsibleSection
        title={(
          <Tooltip
            content={AGENTIC_GRAPHRAG_PIPELINE_DESCRIPTION}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <span
              className={[
                'inline-flex items-center gap-1',
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
              ].join(' ')}
            >
              <span className="break-words">
                {UI_LABELS.ragGraphRAGWorkflow}
              </span>
            </span>
          </Tooltip>
        )}
        headerClassName="z-20"
        collapsed={graphRagCollapsed}
        onToggle={setGraphRagCollapsed}
      >
        {variant === 'floatingPanel' && (
          <GraphRagWorkflowSection
            mode="floatingPanel"
            workflowDoc={workflowProps.workflowDoc}
            workflowSource={workflowProps.workflowSource}
            workflowError={workflowProps.workflowError}
            workflowValidationErrors={workflowProps.workflowValidationErrors}
            traversalDelayMs={workflowProps.traversalDelayMs}
            onChangeTraversalDelayMs={workflowProps.onChangeTraversalDelayMs}
            lastTraversal={workflowProps.lastTraversal}
            onUpdateWorkflow={workflowProps.onUpdateWorkflow}
            indexingCollapsed={workflowProps.indexingCollapsed}
            onToggleIndexingCollapsed={workflowProps.onToggleIndexingCollapsed}
            tracingCollapsed={workflowProps.tracingCollapsed}
            onToggleTracingCollapsed={workflowProps.onToggleTracingCollapsed}
            agenticContext={workflowProps.agenticContext}
            ignoreFilters={workflowProps.ignoreFilters}
            onChangeAgenticContextUrl={workflowProps.onChangeAgenticContextUrl}
            onChangeIgnoreCodebasePaths={workflowProps.onChangeIgnoreCodebasePaths}
          />
        )}
        {variant === 'bottomPanel' && (
          <div
            className={[
              'mt-1 mb-1 flex flex-col gap-2 text-gray-600',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
          >
            <div className="flex flex-col gap-1">
              <div
                className={[
                  'font-semibold uppercase tracking-wide text-gray-500',
                  uiPanelKeyValueTextSizeClass,
                  uiPanelTextFontClass,
                ].join(' ')}
              >
                {UI_COPY.orchestratorTraversalFlowLabel}
              </div>
              <div>
                {UI_COPY.orchestratorTraversalLiveTogetherSentence(
                  UI_LABELS.ragGraphRAGWorkflow,
                  getOrchestratorSectionListLabel(),
                  UI_LABELS.graphTraversal,
                )}
              </div>
              <div className="flex items-center justify-start">
                <button
                  type="button"
                  className={[
                    'App-toolbar__btn bg-gray-50 text-gray-700',
                    uiPanelKeyValueTextSizeClass,
                    uiPanelTextFontClass,
                  ].join(' ')}
                  onClick={() => {
                    try {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT))
                      }
                    } catch {
                      void 0
                    }
                  }}
                >
                  {UI_COPY.orchestratorTraversalOpenFloatingPanelButtonLabel}
                </button>
              </div>
            </div>
            <GraphRagWorkflowSection
              mode="bottomPanel"
              workflowDoc={workflowProps.workflowDoc}
              workflowSource={workflowProps.workflowSource}
              workflowError={workflowProps.workflowError}
              workflowValidationErrors={workflowProps.workflowValidationErrors}
              traversalDelayMs={workflowProps.traversalDelayMs}
              onChangeTraversalDelayMs={workflowProps.onChangeTraversalDelayMs}
              lastTraversal={workflowProps.lastTraversal}
              onUpdateWorkflow={workflowProps.onUpdateWorkflow}
              indexingCollapsed={workflowProps.indexingCollapsed}
              onToggleIndexingCollapsed={workflowProps.onToggleIndexingCollapsed}
              tracingCollapsed={workflowProps.tracingCollapsed}
              onToggleTracingCollapsed={workflowProps.onToggleTracingCollapsed}
              agenticContext={workflowProps.agenticContext}
              ignoreFilters={workflowProps.ignoreFilters}
              onChangeAgenticContextUrl={workflowProps.onChangeAgenticContextUrl}
              onChangeIgnoreCodebasePaths={workflowProps.onChangeIgnoreCodebasePaths}
            />
          </div>
        )}
      </CollapsibleSection>
      {showPresetsAndEditor && (
        <CollapsibleSection
          title={(
          <Tooltip
            content={TRAVERSAL_PRESETS_SECTION_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
              <span className="inline-flex items-center gap-1">
                <span>{UI_COPY.orchestratorTraversalPresetsSectionTitle}</span>
              </span>
            </Tooltip>
          )}
          collapsed={presetsCollapsed}
          onToggle={setPresetsCollapsed}
        >
          <div className="mb-1 text-gray-600">
            {UI_COPY.orchestratorTraversalPresetsIntro(getOrchestratorSectionListLabel())}
          </div>
          <Tooltip
            content={AGENTIC_REASONING_LABELS_TOOLTIP}
            maxWidthPx={260}
            contentClassName="bg-gray-800/90"
          >
            <div className="mb-2 flex items-center gap-1 text-gray-700">
              <div>
                {UI_COPY.orchestratorTraversalAgenticReasoningLabelsTitle}
              </div>
            </div>
          </Tooltip>
          <OrchestratorTraversalPresetsSection
            runGraphRagTraversal={presetsProps.runGraphRagTraversal}
            traversalStartNodeId={presetsProps.traversalStartNodeId}
            setTraversalStartNodeId={presetsProps.setTraversalStartNodeId}
            traversalMaxDepth={presetsProps.traversalMaxDepth}
            setTraversalMaxDepth={presetsProps.setTraversalMaxDepth}
            traversalLabelFilter={presetsProps.traversalLabelFilter}
            setTraversalLabelFilter={presetsProps.setTraversalLabelFilter}
            runGenericTraversalQuery={presetsProps.runGenericTraversalQuery}
            selectedNodeId={presetsProps.selectedNodeId}
            graphRagPathHelper={presetsProps.graphRagPathHelper}
            graphNodesById={presetsProps.graphNodesById}
            selectNode={presetsProps.selectNode}
            duckdbQueriesFromConfig={presetsProps.duckdbQueriesFromConfig}
          />
        </CollapsibleSection>
      )}
      {showPresetsAndEditor && (
        <CollapsibleSection
          title={(
            <Tooltip
              content={TRAVERSAL_EDITOR_AND_LAYERS_SECTION_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
            >
              <span className="inline-flex items-center gap-1">
                <span>{UI_COPY.orchestratorTraversalEditorSectionTitle}</span>
              </span>
            </Tooltip>
          )}
          collapsed={editorCollapsed}
          onToggle={setEditorCollapsed}
        >
          <OrchestratorTraversalAndLayersSection
            traversalViewModel={editorProps.traversalViewModel}
          />
        </CollapsibleSection>
      )}
    </>
  )
}
