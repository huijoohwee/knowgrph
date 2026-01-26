import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import Tooltip from '@/features/panels/ui/Tooltip';
import type { ExampleId, ExampleConfig } from '@/features/parsers/examplesCatalog';
import { WORKFLOW_STEP_COPY } from '@/features/panels/config';
import {
  RUN_CODEBASE_INDEX_PIPELINE_LABEL,
  WORKFLOW_STEP3_PARSER_TOOLTIP,
  WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP,
  WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP,
} from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import WorkspaceActionsStep from '@/features/workspace-actions/WorkspaceActionsStep';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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

interface WorkflowStepsProps {
  collapsedByStep: CollapsedByStep;
  onToggleStep: (step: number, next: boolean) => void;
  hasSchema: boolean;
  graphDataLoaded: boolean;
  searchQuery?: string;
  onOpenSchemaTab: () => void;
  onOpenRenderTab: () => void;
  onOpenOrchestratorTab: () => void;
  onRunAiKgTraversal: () => void;
  parserWorkflow: ParserWorkflowProps;
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
  searchQuery,
  onOpenSchemaTab,
  onOpenRenderTab,
  onOpenOrchestratorTab,
  onRunAiKgTraversal,
  parserWorkflow,
  shareStatus,
  onCopyShareLink,
  pipelineStatus,
  onRunCodebaseIndexPipeline,
}: WorkflowStepsProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('')
  const contentTooltipClassName = `${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`
  const statusPillClassName = `inline-flex items-center h-6 max-w-[14rem] rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs`
  return (
    <div className="mt-0">
      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP_COPY[1].descriptionShort}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={1} label={WORKFLOW_STEP_COPY[1].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[1]}
        onToggle={next => onToggleStep(1, next)}
        className="mt-0 border-t-0 pt-0"
      >
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
        title={(
          <Tooltip
            content={WORKFLOW_STEP_COPY[2].descriptionShort}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={2} label={WORKFLOW_STEP_COPY[2].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[2]}
        onToggle={next => onToggleStep(2, next)}
      >
        <div />
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP3_PARSER_TOOLTIP}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={3} label={WORKFLOW_STEP_COPY[3].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[3]}
        onToggle={next => onToggleStep(3, next)}
      >
        <WorkspaceActionsStep
          searchQuery={searchQuery}
          examples={parserWorkflow.examples}
          onApplyExample={parserWorkflow.onApplyExample}
        />
        {parserWorkflow.presets.length > 0 && (
          <div className={`mt-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
            <div className="mb-1">Or apply a curated workflow preset:</div>
            <select
              className={`w-full min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={selectedPresetId}
              onChange={(e) => {
                const id = e.target.value
                setSelectedPresetId(id)
                if (id) parserWorkflow.onApplyPreset(id)
                setTimeout(() => setSelectedPresetId(''), 0)
              }}
              aria-label="Workflow preset"
            >
              <option value="">Select a preset…</option>
              {parserWorkflow.presets.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP_COPY[4].descriptionShort}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={4} label={WORKFLOW_STEP_COPY[4].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[4]}
        onToggle={next => onToggleStep(4, next)}
      >
        <div />
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP_COPY[5].descriptionShort}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={5} label={WORKFLOW_STEP_COPY[5].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[5]}
        onToggle={next => onToggleStep(5, next)}
      >
        <div className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
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
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-blue-600 text-white`}
            onClick={onRunAiKgTraversal}
          >
            Run traversal preset
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={6} label={WORKFLOW_STEP_COPY[6].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[6]}
        onToggle={next => onToggleStep(6, next)}
      >
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
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
            onClick={onRunCodebaseIndexPipeline}
          >
            {RUN_CODEBASE_INDEX_PIPELINE_LABEL}
          </button>
          {pipelineStatus && (
            <span className={statusPillClassName} title={pipelineStatus}>
              <span className="truncate overflow-hidden whitespace-nowrap">
                {pipelineStatus}
              </span>
            </span>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP_COPY[7].descriptionShort}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={7} label={WORKFLOW_STEP_COPY[7].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[7]}
        onToggle={next => onToggleStep(7, next)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-blue-600 text-white`}
            onClick={onCopyShareLink}
          >
            Copy share link
          </button>
          {shareStatus && (
            <span className={statusPillClassName} title={shareStatus}>
              <span className="truncate overflow-hidden whitespace-nowrap">
                {shareStatus}
              </span>
            </span>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={(
          <Tooltip
            content={WORKFLOW_STEP8_BOTTOM_TABS_TOOLTIP}
            maxWidthPx={280}
            contentClassName={contentTooltipClassName}
          >
            <span className="inline-flex items-center gap-1">
              <WorkflowStepHeader step={8} label={WORKFLOW_STEP_COPY[8].label} />
            </span>
          </Tooltip>
        )}
        collapsed={collapsedByStep[8]}
        onToggle={next => onToggleStep(8, next)}
      >
        <div />
      </CollapsibleSection>
    </div>
  );
}
