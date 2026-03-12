import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import Tooltip from '@/features/panels/ui/Tooltip';
import type { ExampleId, ExampleConfig } from '@/features/parsers/examplesCatalog';
import { WORKFLOW_STEP_COPY } from '@/features/panels/config';
import {
  RUN_CODEBASE_INDEX_PIPELINE_LABEL,
  WORKFLOW_STEP3_PARSER_TOOLTIP,
  WORKFLOW_STEP6_ORCHESTRATOR_TOOLTIP,
} from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import WorkspaceActionsStep from '@/features/workspace-actions/WorkspaceActionsStep';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { ParserSelectionSection, ParserDataSection } from '@/features/panels/views/ParserSections'
import GraphRagTextPipelineSection from '@/features/panels/views/GraphRagTextPipelineSection'
import type { ParserSelectionSectionProps, ParserDataSectionProps } from '@/features/panels/views/ParserSectionsModel'
import { useSchemaConfiguratorUiState } from '@/features/schema-editor/useSchemaConfiguratorUiState'
import SchemaUiEditorPane from '@/features/schema/ui/SchemaUiEditorPane'
import WorkflowExportActions from '@/features/panels/views/WorkflowExportActions'
import { useWorkflowExportActions } from '@/features/panels/hooks/useWorkflowExportActions'

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
  selectionProps: ParserSelectionSectionProps;
  dataProps: ParserDataSectionProps;
}

interface WorkflowStepsProps {
  collapsedByStep: CollapsedByStep;
  onToggleStep: (step: number, next: boolean) => void;
  hasSchema: boolean;
  graphDataLoaded: boolean;
  searchQuery?: string;
  exportActions: ReturnType<typeof useWorkflowExportActions>;
  onOpenSchemaTab: () => void;
  onOpenParserScript: () => void;
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
  exportActions,
  onOpenSchemaTab,
  onOpenParserScript,
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
  const schemaOpOk = useGraphStore(s => s.schemaOpOk)
  const schemaOpMsg = useGraphStore(s => s.schemaOpMsg)
  const schemaUi = useSchemaConfiguratorUiState()
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('')
  const contentTooltipClassName = `${UI_THEME_TOKENS.tooltip.bg} ${UI_THEME_TOKENS.tooltip.text}`
  const statusPillClassName = `inline-flex items-center h-6 max-w-[14rem] rounded-full border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.tertiary} px-2 text-xs`
  return (
    <section className="mt-0" aria-label="Workflow steps">
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
        <section aria-label="Schema configuration" className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${
              hasSchema ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={onOpenSchemaTab}
          >
            Open schema file
          </button>
          <p className="text-xs text-gray-600">
            Edit schema in the Editor workspace (no embedded text editors).
          </p>
        </section>
        <section aria-label="Schema UI configurator" className="mt-3">
          <SchemaUiEditorPane
            schemaError={schemaOpOk === false ? String(schemaOpMsg || 'Schema error') : ''}
            schemaUiStep31Collapsed={schemaUi.schemaUiStep31Collapsed}
            schemaUiStep32Collapsed={schemaUi.schemaUiStep32Collapsed}
            schemaUiStep33Collapsed={schemaUi.schemaUiStep33Collapsed}
            schemaUiStep332Collapsed={schemaUi.schemaUiStep332Collapsed}
            onToggleStep31={schemaUi.setSchemaUiStep31Collapsed}
            onToggleStep32={schemaUi.setSchemaUiStep32Collapsed}
            onToggleStep33={schemaUi.setSchemaUiStep33Collapsed}
            onToggleStep332={schemaUi.setSchemaUiStep332Collapsed}
          />
        </section>
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
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
          Run the pipeline after schema + data are ready.
        </p>
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
        <section aria-label="Parser configuration" className={`mt-3 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
          <header className="flex items-center gap-2 mb-2">
            <button
              type="button"
              className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-50 text-gray-700`}
              onClick={onOpenParserScript}
              data-kg-spotlight-tab="parser"
            >
              Open parser script file
            </button>
            <p className="text-xs text-gray-600">
              Script edits happen in the Editor workspace; this panel stays UI-only.
            </p>
          </header>
          <section className="space-y-3" aria-label="Parser UI editor">
            <ParserSelectionSection {...parserWorkflow.selectionProps} />
            <ParserDataSection {...parserWorkflow.dataProps} />
            <GraphRagTextPipelineSection />
          </section>
        </section>
        {parserWorkflow.presets.length > 0 && (
          <section aria-label="Workflow presets" className={`mt-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
            <p className="mb-1">Or apply a curated workflow preset:</p>
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
          </section>
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
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
          Use Renderer + Orchestrator to explore traversal overlays.
        </p>
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
        <section className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${
              graphDataLoaded ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
            onClick={onOpenRenderTab}
          >
            Open Renderer Panel
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-blue-600 text-white`}
            onClick={onRunAiKgTraversal}
          >
            Run traversal preset
          </button>
        </section>
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
        <section className={`flex items-center gap-2 mb-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
          <button
            type="button"
            className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-600 text-white`}
            onClick={onOpenOrchestratorTab}
          >
            Open Orchestrator Tab
          </button>
        </section>
        <section className="flex items-center gap-2 mb-2" aria-label="Codebase indexing">
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
        </section>
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
            content={WORKFLOW_STEP_COPY[8].descriptionShort}
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
        <WorkflowExportActions
          exportedThisSession={exportActions.exportedThisSession}
          exportedAt={exportActions.exportedAt}
          onExportAll={exportActions.exportAll}
          onExportGraphJsonLd={exportActions.exportGraphJsonLd}
          onExportGraphJson={exportActions.exportGraphJson}
          onExportGraphCsvCombined={exportActions.exportGraphCsvCombined}
          onExportGraphMl={exportActions.exportGraphGraphMl}
          onExportGraphCypher={exportActions.exportGraphCypher}
          onExportSettingsJsonLd={exportActions.exportSettingsJsonLd}
          onExportHistoryJsonLd={exportActions.exportHistoryJsonLd}
          onExportGraphFieldSettingsJsonLd={exportActions.exportGraphFieldSettingsJsonLd}
          onExportGraphRagWorkflowJsonLd={exportActions.exportGraphRagWorkflowJsonLd}
          onExportSvgSnapshot={exportActions.exportSvgSnapshotAction}
          onExportPngSnapshot={exportActions.exportPngSnapshotAction}
          onExportHtmlViewer={exportActions.exportHtmlViewerAction}
          onExportHtmlCanvas={exportActions.exportHtmlCanvasAction}
          onCopyGraphJsonLd={exportActions.copyGraphJsonLd}
          onCopyGraphJson={exportActions.copyGraphJson}
          onExportValidationJson={exportActions.exportValidationJson}
          onExportValidationMarkdown={exportActions.exportValidationMarkdown}
          onExportSelectionValidationJson={exportActions.exportSelectionValidationJson}
          onExportSelectionValidationMarkdown={exportActions.exportSelectionValidationMarkdown}
          onExportSchemaJson={exportActions.exportSchemaJson}
          onExportSchemaJsonLd={exportActions.exportSchemaJsonLd}
          onExportSchemaCsv={exportActions.exportSchemaCsv}
          onCopySchemaJsonLd={exportActions.copySchemaJsonLd}
          onCopySchemaJson={exportActions.copySchemaJson}
          graphHeading=""
          schemaHeading=""
          hasSelection={exportActions.hasSelection}
          selectionSummary={exportActions.selectionSummary}
          onExportSelectionJsonLd={exportActions.exportSelectionJsonLd}
          onExportSelectionJson={exportActions.exportSelectionJson}
          onExportSelectionCsvCombined={exportActions.exportSelectionCsvCombined}
          onExportSelectionGraphMl={exportActions.exportSelectionGraphMl}
          onExportSelectionCypher={exportActions.exportSelectionCypher}
        />
      </CollapsibleSection>
    </section>
  );
}
