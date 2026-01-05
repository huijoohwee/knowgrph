import React from 'react';
import { ChevronDown } from 'lucide-react';
import IconButton from '@/components/IconButton';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useWorkflowExportActions } from '@/features/panels/hooks/useWorkflowExportActions';
import { useParserWorkflowState } from '@/features/parsers/useParserWorkflowState';
import { useGraphStore } from '@/hooks/useGraphStore';
import { openBottomPanel } from '@/features/bottom-panel/open';
import { EXAMPLE_DATASETS } from '@/features/parsers/examplesCatalog';
import { buildGraphRagWorkflowJsonLdDocument } from '@/features/panels/utils/workflowJsonLd';
import { buildGraphRagWorkflowFromGraphData } from '@/features/panels/utils/graphragConfig';
import {
  SHARE_BACKEND_URL,
  PIPELINE_COMMAND_RUNNING_STATUS_TEXT,
  PIPELINE_COMMAND_LOADED_STATUS_TEXT,
  PIPELINE_COMMAND_FALLBACK_STATUS_TEXT,
  WORKFLOW_TAB_HEADER_TOOLTIP,
  UI_COPY,
} from '@/lib/config';
import MainPanelBody from '@/features/panels/ui/MainPanelBody';
import { getJsonLdGraphMappingSummary, getAgenticRagContextComparison } from '@/lib/graph/jsonld';
import { WorkflowSteps } from '@/features/panels/views/WorkflowSteps';
import { getIconSizeClass } from '@/lib/ui';
import type { JsonLdMappingSummary, AgenticContextSummary } from '@/features/panels/views/WorkflowStepsModel';
import type { GraphData } from '@/lib/graph/types';
import { runMarkdownPipelineAndLoadArtifacts } from '@/features/panels/hooks/workflowJsonLdActions';

export default function WorkflowSection() {
  const graphData = useGraphStore(s => s.graphData);
  const graphDataLoaded = !!graphData;
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId);
  const setRequestAiKgTraversal = useGraphStore(s => s.setRequestAiKgTraversal);
  const schema = useGraphStore(s => s.schema);
  const captureCanvasPngSnapshot = useGraphStore(s => s.captureCanvasPngSnapshot);
  const captureCanvasSvgSnapshot = useGraphStore(s => s.captureCanvasSvgSnapshot);
  const graphId = useGraphStore(s => s.graphId);
  const graphRagWorkflowJsonText = useGraphStore(s => s.graphRagWorkflowJsonText);
  const setGraphRagWorkflowJsonText = useGraphStore(s => s.setGraphRagWorkflowJsonText);
  const uiIconScale = useGraphStore(s => s.uiIconScale);
  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  );
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  );
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );
  const iconSizeClass = getIconSizeClass(uiIconScale);
  const [graphRagEditorExpanded, setGraphRagEditorExpanded] = React.useState(false);
  const jsonLdMapping = React.useMemo<JsonLdMappingSummary | null>(() => {
    const summary = getJsonLdGraphMappingSummary(graphData as GraphData | null) as
      | { selectedEdgeProps?: string[] | null }
      | null;
    if (!summary || !Array.isArray(summary.selectedEdgeProps)) return null;
    return { selectedEdgeProps: summary.selectedEdgeProps };
  }, [graphData]);
  const agenticContext = React.useMemo<AgenticContextSummary | null>(() => {
    const res = getAgenticRagContextComparison(graphData as GraphData | null) as
      | { graphContextUrl?: string | null; isCanonicalMatch?: boolean | null }
      | null;
    if (!res) return null;
    return {
      graphContextUrl: res.graphContextUrl,
      isCanonicalMatch: res.isCanonicalMatch,
    };
  }, [graphData]);
  const hasSchema = useGraphStore(s => {
    const currentSchema = s.schema;
    const catalog = currentSchema && currentSchema.catalog;
    const nodes = catalog && Array.isArray(catalog.nodeTypes) ? catalog.nodeTypes.length : 0;
    const edges = catalog && Array.isArray(catalog.edgeLabels) ? catalog.edgeLabels.length : 0;
    return nodes > 0 || edges > 0;
  });
  const handleOpenSchemaTab = React.useCallback(() => {
    openBottomPanel('schema');
  }, []);
  const handleOpenOrchestratorTab = React.useCallback(() => {
    openBottomPanel('orchestrator');
  }, []);
  const handleOpenRenderTab = React.useCallback(() => {
    openBottomPanel('render');
  }, []);
  const handleRunAiKgTraversal = React.useCallback(() => {
    openBottomPanel('render');
    setRequestAiKgTraversal(true);
  }, [setRequestAiKgTraversal]);
  const { parserDataProps, applyExampleById } = useParserWorkflowState();
  const [collapsedByStep, setCollapsedByStep] = React.useState({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
  });
  const collapseAll = React.useCallback(() => {
    setCollapsedByStep({
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true,
      8: true,
    });
  }, []);
  const expandAll = React.useCallback(() => {
    setCollapsedByStep({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
      8: false,
    });
  }, []);
  const handleToggleStep = React.useCallback(
    (step: number, next: boolean) => {
      setCollapsedByStep(prev => ({ ...prev, [step]: next }));
    },
    [],
  );
  const {
    importGraphRagWorkflowJsonLd,
  } = useWorkflowExportActions({
    parserDataExports: parserDataProps,
    graphData,
    graphSchema: schema,
    selectedNodeId,
    selectedEdgeId,
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
  });
  React.useEffect(() => {
    const hasText = typeof graphRagWorkflowJsonText === 'string' && graphRagWorkflowJsonText.trim().length > 0;
    if (hasText) return;
    try {
      const doc = buildGraphRagWorkflowJsonLdDocument(graphId);
      const text = JSON.stringify(doc, null, 2);
      setGraphRagWorkflowJsonText(text);
    } catch {
      setGraphRagWorkflowJsonText(null);
    }
  }, [graphId, graphRagWorkflowJsonText, setGraphRagWorkflowJsonText]);

  const handleResetGraphRagWorkflowJson = React.useCallback(() => {
    try {
      const doc = buildGraphRagWorkflowJsonLdDocument(graphId);
      const text = JSON.stringify(doc, null, 2);
      setGraphRagWorkflowJsonText(text);
    } catch {
      setGraphRagWorkflowJsonText(null);
    }
  }, [graphId, setGraphRagWorkflowJsonText]);

  const [shareStatus, setShareStatus] = React.useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = React.useState<string | null>(null);
  const hasShareBackend = typeof SHARE_BACKEND_URL === 'string' && SHARE_BACKEND_URL.length > 0;

  const handleCopyShareLink = React.useCallback(async () => {
    try {
      const store = useGraphStore.getState();
      const current = store.graphData;
      if (!current) {
        setShareStatus(UI_COPY.workflowShareNoGraphData);
        return;
      }
      if (!hasShareBackend) {
        try {
          await navigator.clipboard.writeText(JSON.stringify(current));
          setShareStatus(UI_COPY.workflowShareCopiedJsonNoBackend);
        } catch {
          setShareStatus(UI_COPY.workflowShareCopyFailedNoBackend);
        }
        return;
      }
      const res = await fetch(SHARE_BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      if (!res.ok) {
        setShareStatus(UI_COPY.workflowShareFailedStatus(res.status));
        return;
      }
      let url = '';
      try {
        const payload = await res.json();
        if (payload && typeof payload.url === 'string' && payload.url.trim()) {
          url = payload.url.trim();
        } else if (typeof payload === 'string' && payload.trim()) {
          url = payload.trim();
        }
      } catch {
        void 0;
      }
      if (!url) {
        setShareStatus(UI_COPY.workflowShareBackendNoUrl);
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus(UI_COPY.workflowShareLinkCopied);
      } catch {
        setShareStatus(UI_COPY.workflowShareClipboardWriteFailed);
      }
    } catch {
      setShareStatus(UI_COPY.workflowShareFailedGeneric);
    }
  }, [hasShareBackend]);

  const handleRunCodebaseIndexPipeline = React.useCallback(async () => {
    try {
      setPipelineStatus(PIPELINE_COMMAND_RUNNING_STATUS_TEXT);
      const ok = await runMarkdownPipelineAndLoadArtifacts();
      setPipelineStatus(ok ? PIPELINE_COMMAND_LOADED_STATUS_TEXT : PIPELINE_COMMAND_FALLBACK_STATUS_TEXT);
    } catch {
      setPipelineStatus(PIPELINE_COMMAND_FALLBACK_STATUS_TEXT);
    }
  }, []);

  const handleGenerateGraphRagWorkflowFromGraph = React.useCallback(() => {
    try {
      const doc = buildGraphRagWorkflowFromGraphData(graphId, graphData || null);
      const text = JSON.stringify(doc, null, 2);
      setGraphRagWorkflowJsonText(text);
    } catch {
      setGraphRagWorkflowJsonText(null);
    }
  }, [graphData, graphId, setGraphRagWorkflowJsonText]);

  const allStepsCollapsed = Object.values(collapsedByStep).every(Boolean);
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  );

  const header = (
    <div
      className={[
        'mt-4 border-t border-gray-200 flex items-center justify-between mb-1',
        uiSectionHeaderRowHeightClass,
        uiSectionHeaderRowPaddingClass,
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center gap-1 text-gray-600',
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
      >
        <Tooltip
          content={WORKFLOW_TAB_HEADER_TOOLTIP}
          maxWidthPx={280}
          contentClassName="bg-gray-800/90"
        >
          <span>Workflow</span>
        </Tooltip>
      </div>
      <IconButton
        className="App-toolbar__btn flex items-center justify-center"
        title={allStepsCollapsed ? 'Expand All' : 'Collapse All'}
        onClick={() => {
          if (allStepsCollapsed) {
            expandAll();
          } else {
            collapseAll();
          }
        }}
        showTooltip
      >
        <ChevronDown
          className={`${iconSizeClass} text-gray-700 transition-transform ${allStepsCollapsed ? '' : 'rotate-180'}`}
          aria-hidden="true"
        />
      </IconButton>
    </div>
  );

  return (
    <MainPanelBody header={header}>
      <div
        className={
          [
            'h-full min-h-0 flex flex-col overflow-hidden py-2 text-gray-600',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')
        }
      >
        <WorkflowSteps
          collapsedByStep={collapsedByStep}
          onToggleStep={handleToggleStep}
          hasSchema={hasSchema}
        graphDataLoaded={graphDataLoaded}
        onOpenSchemaTab={handleOpenSchemaTab}
        onOpenRenderTab={handleOpenRenderTab}
        onOpenOrchestratorTab={handleOpenOrchestratorTab}
        onRunAiKgTraversal={handleRunAiKgTraversal}
        parserWorkflow={{
          examples: EXAMPLE_DATASETS,
          onApplyExample: applyExampleById,
          presets: parserDataProps.presets || [],
          onApplyPreset: parserDataProps.onApplyPreset,
        }}
        graphRagWorkflow={{
          jsonLdMapping,
          agenticContext,
          graphRagWorkflowJsonText: graphRagWorkflowJsonText || '',
          onChangeGraphRagWorkflowJsonText: v => setGraphRagWorkflowJsonText(v),
          graphRagEditorExpanded,
          onToggleGraphRagEditorExpanded: () => setGraphRagEditorExpanded(v => !v),
          onResetGraphRagWorkflowJson: handleResetGraphRagWorkflowJson,
          onGenerateGraphRagWorkflowFromGraph: handleGenerateGraphRagWorkflowFromGraph,
          onImportGraphRagWorkflowJsonLd: importGraphRagWorkflowJsonLd,
        }}
        shareStatus={shareStatus}
        onCopyShareLink={handleCopyShareLink}
        pipelineStatus={pipelineStatus}
        onRunCodebaseIndexPipeline={handleRunCodebaseIndexPipeline}
      />
      </div>
    </MainPanelBody>
  );
}
