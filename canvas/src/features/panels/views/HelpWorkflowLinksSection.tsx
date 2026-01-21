import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import Tooltip from '@/features/panels/ui/Tooltip';
import { HELP_STEP_COPY, PIPELINE_STAGE_COPY, RENDER_PANEL_SECTION_COPY } from '@/features/panels/config';
import {
  UI_ANCHORS,
  UI_LABELS,
  WORKFLOW_LINKS_TOOLTIP,
  GRAPHRAG_PATH_METADATA_TOOLTIP,
  RUN_CODEBASE_INDEX_PIPELINE_LABEL,
  AGENTIC_REASONING_LABELS_TOOLTIP,
  HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP,
  HELP_PIPELINE_COMMAND_TEXT,
  CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH,
} from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import { getPillClass } from '@/lib/ui';

interface HelpWorkflowLinksSectionProps {
  collapsed: boolean;
  onToggle: (next: boolean) => void;
  onOpenWorkflowTab: () => void;
  onOpenGraphFieldsTab: () => void;
}

export function HelpWorkflowLinksSection({
  collapsed,
  onToggle,
  onOpenWorkflowTab,
  onOpenGraphFieldsTab,
}: HelpWorkflowLinksSectionProps) {
  const uiIconPillBadgeTextSizeClass = useGraphStore.getState().uiIconPillBadgeTextSizeClass;
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );

  return (
    <CollapsibleSection
      title={(
        <Tooltip
          content={WORKFLOW_LINKS_TOOLTIP}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          <span>{HELP_STEP_COPY.workflowLinks.title}</span>
        </Tooltip>
      )}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {HELP_STEP_COPY.workflowLinks.descriptionShort && (
        <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {HELP_STEP_COPY.workflowLinks.descriptionShort}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onOpenWorkflowTab}
        >
          Open Workflow tab
        </button>
        <button
          type="button"
          className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} bg-gray-100 text-gray-700`}
          onClick={onOpenGraphFieldsTab}
          data-kg-anchor={UI_ANCHORS.graphFields}
        >
          Open {UI_LABELS.graphFields}
        </button>
      </div>
      <div className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 space-y-1`}>
        <div className={`mt-1 border border-gray-100 rounded px-2 py-1 bg-gray-50 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
          <div className="font-semibold mb-0.5">
            Pipeline stage legend
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span
                className={getPillClass('badge', {
                  baseClass:
                    'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-white',
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-600',
                })}
              >
                {PIPELINE_STAGE_COPY.ingestValidate.badge}
              </span>
              <span>
                Step
                {' '}
                {PIPELINE_STAGE_COPY.ingestValidate.workflowStepId}
                {' – '}
                {PIPELINE_STAGE_COPY.ingestValidate.descriptionShort}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={getPillClass('badge', {
                  baseClass:
                    'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-white',
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-600',
                })}
              >
                {RENDER_PANEL_SECTION_COPY.presetsAndTuning.badge}
              </span>
              <span>
                Step
                {' '}
                {PIPELINE_STAGE_COPY.renderInspect.workflowStepId}
                {' – '}
                {PIPELINE_STAGE_COPY.renderInspect.descriptionShort}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={getPillClass('badge', {
                  baseClass:
                    'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-white',
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-600',
                })}
              >
                {PIPELINE_STAGE_COPY.agenticReasoning.badge}
              </span>
              <span>
                Step
                {' '}
                {PIPELINE_STAGE_COPY.agenticReasoning.workflowStepId}
                {' – '}
                {PIPELINE_STAGE_COPY.agenticReasoning.descriptionShort}
              </span>
            </div>
          </div>
          <div className="mt-0.5">
            <div>
              Phases are rendered on the canvas as soft grouped outlines that wrap the steps they own.
            </div>
            <div>
              Any JSON-LD node with an array property of node ids (or compact IRIs) creates a cluster layer surface around its members; values like
              {' '}
              <span className={uiPanelKeyValueTextSizeClass}>
                steps
              </span>
              {' '}
              or
              {' '}
              <span className={uiPanelKeyValueTextSizeClass}>
                contains
              </span>
              {' '}
              work as long as they point at other nodes in the graph. Cluster layer appearance comes from `schema.metadata["canvas:graphLayers"]`, which the Main Panel Graph Fields tab exposes as editable presets so teams can tune cluster colors and opacity without changing renderer code.
            </div>
          </div>
          <div className={`mt-0.5 flex items-center gap-1 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
            <Tooltip
              content={AGENTIC_REASONING_LABELS_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
            >
              <div>
                Agentic reasoning labels
              </div>
            </Tooltip>
          </div>
        </div>
        <div className={`mt-1 border border-gray-100 rounded px-2 py-1 bg-gray-50 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
          <div className="flex items-center gap-1 mb-0.5">
            <Tooltip
              content={HELP_CODEBASE_INDEX_ENTRY_POINTS_TOOLTIP}
              maxWidthPx={260}
              contentClassName="bg-gray-800/90"
            >
              <div className="font-semibold">
                Markdown pipeline entry points
              </div>
            </Tooltip>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span
                className={getPillClass('badge', {
                  baseClass:
                    'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-white',
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-600',
                })}
              >
                Main panel
              </span>
              <span>
                Workflow tab → Step 6 (Agentic reasoning) → {RUN_CODEBASE_INDEX_PIPELINE_LABEL}.
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={getPillClass('badge', {
                  baseClass:
                    'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-white',
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-600',
                })}
              >
                Bottom panel
              </span>
              <span>
                Render tab → Markdown pipeline helper section → {RUN_CODEBASE_INDEX_PIPELINE_LABEL}.
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={getPillClass('badge', {
                  baseClass:
                    'inline-flex items-center px-1 py-[1px] rounded border border-gray-300 bg-white',
                  badgeTextSizeClass: uiIconPillBadgeTextSizeClass,
                  textColorClass: 'text-gray-600',
                })}
              >
                Workspace
              </span>
              <span>
                Toolbar → {UI_LABELS.floatingPanel} → Run pipeline.
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={GRAPHRAG_PATH_METADATA_TOOLTIP} maxWidthPx={260} contentClassName="bg-gray-800/90">
            <div>
              graphRAGPath metadata
            </div>
          </Tooltip>
        </div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>
            Canvas entry: canvas/src/pages/Canvas.tsx → canvas/src/components/GraphCanvas.tsx → canvas/src/workers/graphParser.worker.ts →
            rendered graph.
          </li>
          <li>
            Markdown pipeline:
            {' '}
            {HELP_PIPELINE_COMMAND_TEXT}
            {' '}
            →
            {' '}
            {CODEBASE_INDEX_PIPELINE_GRAPH_REL_PATH}
            {' '}
            (plus schema and orchestrator config).
          </li>
          <li>
            Stores and workflow: canvas/src/hooks/store/schemaSlice.ts and canvas/src/hooks/store/historySlice.ts → Main Panel Workflow tab →
            python -m knowgrph_parser markdown → Agentic GraphRAG-ready markdown graph snapshot.
          </li>
        </ul>
      </div>
    </CollapsibleSection>
  );
}
