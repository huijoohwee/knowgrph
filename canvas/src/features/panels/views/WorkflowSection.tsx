import React from 'react';
import { useWorkflowExportActions } from '@/features/panels/hooks/useWorkflowExportActions';
import { useParserWorkflowState } from '@/features/parsers/useParserWorkflowState';
import { useGraphStore } from '@/hooks/useGraphStore';
import { openBottomPanel } from '@/features/bottom-panel/open';
import { EXAMPLE_DATASETS } from '@/features/parsers/examplesCatalog';
import { SHARE_BACKEND_URL, UI_COPY } from '@/lib/config';
import { WorkflowSteps } from '@/features/panels/views/WorkflowSteps';
import { runMarkdownPipelineWithStatus } from '@/features/panels/hooks/markdownPipelineActions';

type WorkflowActions = {
  collapseAll?: () => void;
  expandAll?: () => void;
  allCollapsed?: boolean;
};

type WorkflowSectionProps = {
  searchQuery?: string;
  onRegisterActions?: (actions: WorkflowActions) => void;
};

export default function WorkflowSection({ searchQuery, onRegisterActions }: WorkflowSectionProps) {
  const graphData = useGraphStore(s => s.graphData);
  const graphDataLoaded = !!graphData;
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId);
  const setRequestAiKgTraversal = useGraphStore(s => s.setRequestAiKgTraversal);
  const schema = useGraphStore(s => s.schema);
  const captureCanvasPngSnapshot = useGraphStore(s => s.captureCanvasPngSnapshot);
  const captureCanvasSvgSnapshot = useGraphStore(s => s.captureCanvasSvgSnapshot);
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
    3: false,
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
  useWorkflowExportActions({
    parserDataExports: parserDataProps,
    graphData,
    graphSchema: schema,
    selectedNodeId,
    selectedEdgeId,
    captureCanvasSvgSnapshot,
    captureCanvasPngSnapshot,
  });

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
    await runMarkdownPipelineWithStatus(setPipelineStatus);
  }, []);

  const allStepsCollapsed = Object.values(collapsedByStep).every(Boolean);
  React.useEffect(() => {
    if (!onRegisterActions) return;
    onRegisterActions({
      collapseAll,
      expandAll,
      allCollapsed: allStepsCollapsed,
    });
  }, [allStepsCollapsed, collapseAll, expandAll, onRegisterActions]);

  return (
    <WorkflowSteps
      collapsedByStep={collapsedByStep}
      onToggleStep={handleToggleStep}
      hasSchema={hasSchema}
      graphDataLoaded={graphDataLoaded}
      searchQuery={searchQuery}
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
      shareStatus={shareStatus}
      onCopyShareLink={handleCopyShareLink}
      pipelineStatus={pipelineStatus}
      onRunCodebaseIndexPipeline={handleRunCodebaseIndexPipeline}
    />
  );
}
