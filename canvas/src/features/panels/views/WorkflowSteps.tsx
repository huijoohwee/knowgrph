import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import Tooltip from '@/features/panels/ui/Tooltip';
import type { ExampleId, ExampleConfig } from '@/features/parsers/examplesCatalog';
import { ORCHESTRATOR_AGENTIC_COPY, WORKFLOW_STEP_COPY, PIPELINE_STAGE_COPY } from '@/features/panels/config';
import JsonEditor from '@/features/json/JsonEditor';
import {
  UI_ANCHORS,
  UI_LABELS,
  RUN_CODEBASE_INDEX_PIPELINE_LABEL,
  WORKFLOW_STEP3_PARSER_TOOLTIP,
  WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP,
  WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP,
} from '@/lib/config';
import { AGENTIC_RAG_CONTEXT_URL, AGENTIC_RAG_SCHEMA_URL, AGENTIC_RAG_GRAPH_RAG_PATH_IRI } from '@/lib/agenticrag';
import type { JsonLdMappingSummary, AgenticContextSummary } from '@/features/panels/views/WorkflowStepsModel';
import { useGraphStore } from '@/hooks/useGraphStore';
import { getPillClass, getChipClass } from '@/lib/ui';
import WorkspaceActionsStep from '@/features/workspace-actions/WorkspaceActionsStep';

type CollapsedByStep = {
  1: boolean;
  2: boolean;
  3: boolean;
  4: boolean;
  5: boolean;
  6: boolean;
  7: boolean;
  8: boolean;
};

interface ParserPreset {
  id: string;
  label: string;
}

interface ParserWorkflowProps {
  examples: ExampleConfig[];
  onApplyExample: (exampleId: ExampleId) => void;
  presets: ParserPreset[];
  onApplyPreset: (presetId: string) => void;
}

interface GraphRagWorkflowProps {
  jsonLdMapping: JsonLdMappingSummary | null;
  agenticContext: AgenticContextSummary | null;
  graphRagWorkflowJsonText: string;
  onChangeGraphRagWorkflowJsonText: (text: string) => void;
  graphRagEditorExpanded: boolean;
  onToggleGraphRagEditorExpanded: () => void;
  onResetGraphRagWorkflowJson: () => void;
  onGenerateGraphRagWorkflowFromGraph: () => void;
  onImportGraphRagWorkflowJsonLd: () => void;
}

interface WorkflowStepsProps {
  collapsedByStep: CollapsedByStep;
  onToggleStep: (step: number, next: boolean) => void;
  hasSchema: boolean;
  graphDataLoaded: boolean;
  onOpenSchemaTab: () => void;
  onOpenRenderTab: () => void;
  onOpenOrchestratorTab: () => void;
  onRunAiKgTraversal: () => void;
  parserWorkflow: ParserWorkflowProps;
  graphRagWorkflow: GraphRagWorkflowProps;
  shareStatus: string | null;
  onCopyShareLink: () => void;
  pipelineStatus: string | null;
  onRunCodebaseIndexPipeline: () => void;
}

interface WorkflowStepHeaderProps {
  step: number;
  label: string;
}

function WorkflowStepHeader({ step, label }: WorkflowStepHeaderProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">{`Step ${step}`}</span>
      <span className="text-xs font-semibold text-gray-800">{label}</span>
    </span>
  );
}

export function WorkflowSteps({
  collapsedByStep,
  onToggleStep,
  hasSchema,
  graphDataLoaded,
  onOpenSchemaTab,
  onOpenRenderTab,
  onOpenOrchestratorTab,
  onRunAiKgTraversal,
  parserWorkflow,
  graphRagWorkflow,
  shareStatus,
  onCopyShareLink,
  pipelineStatus,
  onRunCodebaseIndexPipeline,
}: WorkflowStepsProps) {
  const uiIconPillBadgeTextSizeClass = useGraphStore(s => s.uiIconPillBadgeTextSizeClass);
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  );
  return (
    <div className="mt-3">
      <CollapsibleSection
        title={<WorkflowStepHeader step={1} label={WORKFLOW_STEP_COPY[1].label} />}
        collapsed={collapsedByStep[1]}
        onToggle={next => onToggleStep(1, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[1].descriptionShort}
        </div>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${
            hasSchema ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
          onClick={onOpenSchemaTab}
        >
          Open Schema Tab
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title={<WorkflowStepHeader step={2} label={WORKFLOW_STEP_COPY[2].label} />}
        collapsed={collapsedByStep[2]}
        onToggle={next => onToggleStep(2, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[2].descriptionShort}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP3_PARSER_TOOLTIP}
            maxWidthPx={280}
            contentClassName="bg-gray-800/90"
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={3} label={WORKFLOW_STEP_COPY[3].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[3]}
        onToggle={next => onToggleStep(3, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[3].descriptionShort}
        </div>
        <WorkspaceActionsStep />
        <div className={`mt-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
          <div className="mb-1">Or start with an example dataset:</div>
          <div className="flex flex-wrap gap-1">
            {parserWorkflow.examples.map(example => {
              const button = (
                <button
                  type="button"
                  className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
                  onClick={() => parserWorkflow.onApplyExample(example.id)}
                >
                  {example.label}
                </button>
              );

              if (example.id === 'edaMlpPipeline') {
                return (
                  <Tooltip
                    key={example.id}
                    content="Preset optimized for inspecting a single path via traversal."
                    maxWidthPx={260}
                    contentClassName="bg-gray-800/90"
                  >
                    {button}
                  </Tooltip>
                );
              }

              return (
                <span key={example.id}>
                  {button}
                </span>
              );
            })}
          </div>
        </div>
        {parserWorkflow.presets.length > 0 && (
          <div className={`mt-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
            <div className="mb-1">Or apply a curated workflow preset:</div>
            <div className="flex flex-wrap gap-1">
              {parserWorkflow.presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
                  onClick={() => parserWorkflow.onApplyPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={<WorkflowStepHeader step={4} label={WORKFLOW_STEP_COPY[4].label} />}
        collapsed={collapsedByStep[4]}
        onToggle={next => onToggleStep(4, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[4].descriptionShort}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={<WorkflowStepHeader step={5} label={WORKFLOW_STEP_COPY[5].label} />}
        collapsed={collapsedByStep[5]}
        onToggle={next => onToggleStep(5, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[5].descriptionShort}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${
              graphDataLoaded ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={onOpenRenderTab}
          >
            Open Renderer Tab
          </button>
          <button
            type="button"
            className="App-toolbar__btn text-xs bg-blue-600 text-white"
            onClick={onRunAiKgTraversal}
          >
            Run traversal preset
          </button>
        </div>
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500 mt-1`}>
          After loading the graph, use the toolbar Radial Layout and Clusters toggles to orbit nodes in 2D and outline related phases, datasets, and artifacts using schema.metadata["canvas:graphLayers"].
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP}
            maxWidthPx={280}
            contentClassName="bg-gray-800/90"
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={6} label={WORKFLOW_STEP_COPY[6].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[6]}
        onToggle={next => onToggleStep(6, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[6].descriptionShort}
        </div>
        <div className={`flex items-center gap-2 mb-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-600 text-white`}
            onClick={onOpenOrchestratorTab}
          >
            Open Orchestrator Tab
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
            onClick={onRunCodebaseIndexPipeline}
          >
            {RUN_CODEBASE_INDEX_PIPELINE_LABEL}
          </button>
          {pipelineStatus && (
            <span className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
              {pipelineStatus}
            </span>
          )}
        </div>
        <div
          className="mt-1 border border-gray-200 rounded px-2 py-1 flex flex-col min-h-0"
          data-kg-anchor={UI_ANCHORS.ragGraphRAGWorkflow}
        >
          <div className="flex items-start justify-between mb-1 gap-2">
            <div className="flex flex-col">
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-semibold uppercase tracking-wide text-gray-500`}>
                {UI_LABELS.ragGraphRAGWorkflow}
              </div>
              <div className={`mt-0.5 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
                {ORCHESTRATOR_AGENTIC_COPY.schemaLabel}
                {' '}
                <span className={`${uiPanelMonospaceTextClass} break-all`}>{AGENTIC_RAG_SCHEMA_URL}</span>
              </div>
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
                <span
                  className={getPillClass('badge', {
                    baseClass:
                      'inline-flex items-center px-1 py-[1px] mr-1 rounded border border-gray-300 bg-gray-50',
                    badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                    textColorClass: 'text-gray-600',
                  })}
                >
                  {PIPELINE_STAGE_COPY.agenticReasoning.badge}
                </span>
                {ORCHESTRATOR_AGENTIC_COPY.contextLabel}
                {' '}
                <span className={`${uiPanelMonospaceTextClass} break-all`}>{AGENTIC_RAG_CONTEXT_URL}</span>
                {graphRagWorkflow.agenticContext && graphRagWorkflow.agenticContext.graphContextUrl && (
                  <>
                    {' '}
                    {ORCHESTRATOR_AGENTIC_COPY.datasetContextVocabLabel}
                    {' '}
                    <span className={`${uiPanelMonospaceTextClass} break-all`}>
                      {graphRagWorkflow.agenticContext.graphContextUrl}
                    </span>
                    {graphRagWorkflow.agenticContext.isCanonicalMatch === true && ' (matches)'}
                    {graphRagWorkflow.agenticContext.isCanonicalMatch === false && ' (differs)'}
                  </>
                )}
              </div>
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500 mt-0.5`}>
                Step
                {' '}
                {PIPELINE_STAGE_COPY.agenticReasoning.workflowStepId}
                {' – '}
                {PIPELINE_STAGE_COPY.agenticReasoning.descriptionShort}
              </div>
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
                {ORCHESTRATOR_AGENTIC_COPY.graphRagPathIriLabel}
                {' '}
                <span className={`${uiPanelMonospaceTextClass} break-all`}>{AGENTIC_RAG_GRAPH_RAG_PATH_IRI}</span>
              </div>
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
                GraphRAG config layers:
                {' '}
                GraphRAG CLI YAML under a configs/graphrag directory is converted into the workflow JSON-LD shown here and can be wired into orchestrator configs via
                {' '}
                <span className={`${uiPanelMonospaceTextClass} break-all`}>graph.workflow_json</span>
                .
                {' '}
                In this Workflow tab, use Import to load that JSON-LD document or, via the Orchestrator Tool Menu, import the corresponding GraphRAG CLI YAML so the editor reflects the same GraphRAG workflow used by offline pipelines.
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
                onClick={graphRagWorkflow.onImportGraphRagWorkflowJsonLd}
              >
                Import
              </button>
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
                onClick={graphRagWorkflow.onGenerateGraphRagWorkflowFromGraph}
              >
                Generate from current graph
              </button>
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
                onClick={graphRagWorkflow.onToggleGraphRagEditorExpanded}
              >
                {graphRagWorkflow.graphRagEditorExpanded ? 'Collapse' : 'Expand'}
              </button>
              <button
                type="button"
                className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
                onClick={graphRagWorkflow.onResetGraphRagWorkflowJson}
              >
                Reset
              </button>
            </div>
          </div>
          {graphRagWorkflow.jsonLdMapping && graphRagWorkflow.jsonLdMapping.selectedEdgeProps.length > 0 && (
            <div className="mb-1 border border-gray-100 rounded px-1.5 py-1 bg-gray-50">
              <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-semibold uppercase tracking-wide text-gray-500`}>
                JSON-LD context edges
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {graphRagWorkflow.jsonLdMapping.selectedEdgeProps.map(key => (
                  <span
                    key={key}
                    className={getChipClass('default', {
                      textSizeClass: uiIconPillBadgeTextSizeClass,
                      textColorClass: 'text-gray-700',
                      extraClassName: 'border-gray-300 bg-white',
                    })}
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className={graphRagWorkflow.graphRagEditorExpanded ? 'h-64 min-h-0' : 'h-32 min-h-0'}>
            <JsonEditor
              value={graphRagWorkflow.graphRagWorkflowJsonText}
              onChange={graphRagWorkflow.onChangeGraphRagWorkflowJsonText}
              className="w-full h-full"
              language="json"
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={<WorkflowStepHeader step={7} label={WORKFLOW_STEP_COPY[7].label} />}
        collapsed={collapsedByStep[7]}
        onToggle={next => onToggleStep(7, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[7].descriptionShort}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-blue-600 text-white`}
            onClick={onCopyShareLink}
          >
            Copy share link
          </button>
          {shareStatus && (
            <span className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
              {shareStatus}
            </span>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP}
            maxWidthPx={280}
            contentClassName="bg-gray-800/90"
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={8} label={WORKFLOW_STEP_COPY[8].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[8]}
        onToggle={next => onToggleStep(8, next)}
      >
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {WORKFLOW_STEP_COPY[8].descriptionShort}
        </div>
      </CollapsibleSection>
    </div>
  );
}
