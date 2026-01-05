import { create } from 'zustand';
import { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema, defaultSchema, GraphBehavior, PropertySpec } from '@/lib/graph/schema';
import { createGraphDataSlice } from '@/hooks/store/graphDataSlice';
import { createMinimapSlice } from '@/features/minimap/store';
import { createSelectionSlice } from '@/hooks/store/selectionSlice';
import { createHistorySlice } from '@/hooks/store/historySlice';
import { createUiSlice } from '@/hooks/store/uiSlice';
import { createCanvasSlice } from '@/hooks/store/canvasSlice';
import { createSchemaSlice, readSchemaFromStorage } from '@/hooks/store/schemaSlice';
import { useParserUIState } from '@/features/parsers/uiState';
import { clearCustomParsers } from '@/features/parsers/persistence';
import type { BottomTab } from '@/features/bottom-panel/open';
import type { GraphFieldId, GraphFieldSettingsById } from '@/features/graph-fields/graphFields';
import { isJsonValue } from '@/lib/graph/jsonValue';
import type {
  GraphDataTableColumnKey,
  GraphDataTableColumnVisibilityByKey,
  GraphDataTableFilterClause,
  GraphDataTableFilterMatch,
  GraphDataTableRowDensity,
  GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable';
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal';
import { LS_KEYS, SESSION_KEYS } from '@/lib/config';
import { getLocalStorage, lsSetJson, ssSetString, ssString } from '@/lib/persistence';

type CanvasSnapshotFns = {
  capturePng?: (pixelRatio?: number) => Promise<Blob | null>;
  captureSvg?: () => Promise<string | null>;
};

type GraphDataTableScope = 'all' | 'nodes' | 'edges';

type GraphDataTableFreezeMode = 'none' | 'label' | 'id';

type LayoutMode = 'force' | 'radial' | 'tidy-tree'
type NodePosition2d = { x: number; y: number }
type LayoutPositionCacheKey = `${string}:${LayoutMode}`

export interface GraphState {
  graphData: GraphData | null;
  graphDataRevision: number;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  graphFieldsOpOk: boolean | null;
  graphFieldsOpMsg: string;
  orchestratorOpOk: boolean | null;
  orchestratorOpMsg: string;
  renderOpOk: boolean | null;
  renderOpMsg: string;
  selectionSource: null | 'canvas' | 'menu' | 'toolbar' | 'editor' | 'table' | 'unknown';
  setSelectionSource: (src: null | 'canvas' | 'menu' | 'toolbar' | 'editor' | 'table' | 'unknown') => void;
  isEditMode: boolean;
  isSidebarOpen: boolean;
  history: Array<{ id: string; label: string; timestamp: number; graphData: GraphData; graphFieldSettingsById?: GraphFieldSettingsById }>;
  historyIndex: number;
  historyDebounceMs: number;
  historyTimer: ReturnType<typeof setTimeout> | null;
  schema: GraphSchema;
  layoutPositionCacheByMode: Partial<Record<LayoutPositionCacheKey, Record<string, NodePosition2d>>>;
  schemaImportLabel: string | null;
  schemaOpOk: boolean | null;
  schemaOpMsg: string;
  graphValidationStatus: 'valid' | 'invalid' | null;
  graphValidationTimestamp: number | null;
  setGraphValidationResult: (status: 'valid' | 'invalid' | null, timestamp: number | null) => void;
  setSchemaImportLabel: (label: string | null) => void;
  setSchemaOpStatus: (ok: boolean | null, msg: string) => void;
  setGraphFieldsOpStatus: (ok: boolean | null, msg: string) => void;
  setOrchestratorOpStatus: (ok: boolean | null, msg: string) => void;
  setRenderOpStatus: (ok: boolean | null, msg: string) => void;
  lifecycleStage: 'idle' | 'reset' | 'hydrated' | 'committed' | 'rendering' | 'selectionUpdate' | 'edgeMutate' | 'zoomUpdate' | 'minimapQuick' | 'minimapAsync';
  setLifecycleStage: (stage: 'idle' | 'reset' | 'hydrated' | 'committed' | 'rendering' | 'selectionUpdate' | 'edgeMutate' | 'zoomUpdate' | 'minimapQuick' | 'minimapAsync') => void;
  setGraphData: (data: GraphData) => void;
  resyncGraphFieldsFromGraphData: () => void;
  clearGraphData: () => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  updateEdge: (id: string, updates: Partial<GraphEdge>) => void;
  addNode: (node: GraphNode) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setEditMode: (mode: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  addHistory: (label?: string) => void;
  restoreHistory: (index: number) => void;
  undoHistory: () => void;
  redoHistory: () => void;
  scheduleHistory: (label: string) => void;
  setHistoryDebounceMs: (ms: number) => void;
  replaceHistoryState: (
    history: Array<{ id: string; label: string; timestamp: number; graphData: GraphData; graphFieldSettingsById?: GraphFieldSettingsById }>,
    historyIndex: number,
  ) => void;
  codeHighlightDurationMs: number;
  codeSelectThrottleMs: number;
  codeHighlightUntilClick: boolean;
  setCodeHighlightDurationMs: (ms: number) => void;
  setCodeSelectThrottleMs: (ms: number) => void;
  setCodeHighlightUntilClick: (v: boolean) => void;
  uiPanelKeyValueTextSizeClass: string;
  uiPanelTextFontClass: string;
  uiPanelKeyValueInputClass: string;
  uiPanelRowDensityDefaultClass: string;
  uiPanelRowDensityCompactClass: string;
  uiPanelMonospaceTextClass: string;
  uiPanelMicroLabelTextSizeClass: string;
  uiHeaderRowHeightClass: string;
  uiHeaderRowPaddingClass: string;
  uiSectionHeaderRowHeightClass: string;
  uiSectionHeaderRowPaddingClass: string;
  uiIconScale: 'compact' | 'default';
  uiIconFormat: 'default' | 'minimal' | '1';
  uiIconStrokeWidth: number;
  uiIconColorClass: string;
  uiIconHoverBgClass: string;
  uiIconButtonPaddingClass: string;
  uiIconPillClass: string;
  uiIconPillLegendTextSizeClass: string;
  uiIconPillBadgeTextSizeClass: string;
  uiIconBadgeChipClass: string;
  uiIconBadgeChipTextSizeClass: string;
  uiIconAnimationEnabled: boolean;
  uiOverlayOpacity: number;
  uiPanelOpacity: number;
  uiToolbarOpacity: number;
  chatEndpointUrl: string | null;
  chatModel: string | null;
  chatTemperature: number;
  chatSystemPrompt: string | null;
  bottomPanelHeightRatio: number;
  floatingPanelWidthRatio: number;
  floatingPanelHeightRatio: number;
  floatingPanelZIndex: number;
  sidebarWidthRatio: number;
  bottomPanelTab: BottomTab;
  bottomPanelCurationView: 'grid' | 'json' | 'block' | 'markdown';
  bottomPanelCodeSource: 'graph-json';
  launchSpotlightMode: 'tour' | 'stats';
  enableLaunchSpotlight: boolean;
  statusPanelPinned: boolean;
  schemaDeriveCacheCapacity: number;
  graphFieldSettingsById: GraphFieldSettingsById;
  selectedGraphFieldId: GraphFieldId | null;
  graphRagWorkflowJsonText: string | null;
  graphDataTableVisibleColumns: GraphDataTableColumnVisibilityByKey;
  graphDataTableColumnOrder: GraphDataTableColumnKey[];
  graphDataTableAggregateKeys: GraphDataTableColumnKey[];
  graphDataTableFilterMatch: GraphDataTableFilterMatch;
  graphDataTableFilterClauses: GraphDataTableFilterClause[];
  graphDataTableSortRules: GraphDataTableSortRule[];
  graphDataTableGroupKey: GraphDataTableColumnKey | '';
  graphDataTableAutoSortEnabled: boolean;
  graphDataTableRowDensity: GraphDataTableRowDensity;
  graphDataTableDisableAutoScroll: boolean;
  graphDataTableColumnWidths: Partial<Record<GraphDataTableColumnKey, number>>;
  graphDataTableFreezeFirstDataColumn: GraphDataTableFreezeMode;
  graphDataTableFreezeFirstDataColumnByScope: Record<GraphDataTableScope, GraphDataTableFreezeMode>;
  graphDataTableAggregateDefaultVizMode: 'none' | 'radial' | 'bars' | 'sparkline';
  graphDataTableAggregateIncludeMixedNumericFields: boolean;
  graphDataTableAggregateIncludeIdAsNumeric: boolean;
  graphDataTableAggregateIncludeSourceAsNumeric: boolean;
  graphDataTableAggregateIncludeTargetAsNumeric: boolean;
  graphDataTableNumericSampleLimit: number;
  graphDataTableNumericSampleMinCount: number;
  graphDataTableNumericSampleMinRatio: number;
  spotlightMargin: number;
  spotlightNearTopThreshold: number;
  graphDataTableFrozenDragStepNoneLabelPx: number;
  graphDataTableFrozenDragStepLabelIdPx: number;
  graphDataTableVirtualOverscanRows: number;
  graphDataTableOverscanMultiplier: number;
  graphDataTableVirtualMinRows: number;
  graphDataTableVirtualDebugLogRanges: boolean;
  markdownDocumentName: string | null;
  markdownDocumentText: string | null;
  markdownDocumentSourceUrl: string | null;
  markdownPreviewMermaidFocusCode: string | null;
  markdownPreviewMermaidFocusConfig: Record<string, unknown> | null;
  markdownPreviewActiveMediaKey: string | null;
  setUiIconScale: (scale: 'compact' | 'default') => void;
  setUiOverlayOpacity: (v: number) => void;
  setUiPanelOpacity: (v: number) => void;
  setUiToolbarOpacity: (v: number) => void;
  setChatEndpointUrl: (url: string | null) => void;
  setChatModel: (model: string | null) => void;
  setChatTemperature: (v: number) => void;
  setChatSystemPrompt: (v: string | null) => void;
  setBottomPanelHeightRatio: (v: number) => void;
  setFloatingPanelWidthRatio: (v: number) => void;
  setFloatingPanelHeightRatio: (v: number) => void;
  setFloatingPanelZIndex: (v: number) => void;
  setSidebarWidthRatio: (v: number) => void;
  setBottomPanelTab: (tab: BottomTab) => void;
  setBottomPanelCurationView: (view: 'grid' | 'json' | 'block' | 'markdown') => void;
  setLaunchSpotlightMode: (mode: 'tour' | 'stats') => void;
  setEnableLaunchSpotlight: (v: boolean) => void;
  setStatusPanelPinned: (v: boolean) => void;
  setSchemaDeriveCacheCapacity: (n: number) => void;
  setGraphFieldSettingsById: (next: GraphFieldSettingsById) => void;
  setSelectedGraphFieldId: (id: GraphFieldId | null) => void;
  setGraphRagWorkflowJsonText: (text: string | null) => void;
  setGraphDataTableVisibleColumns: (next: GraphDataTableColumnVisibilityByKey) => void;
  setGraphDataTableColumnOrder: (next: GraphDataTableColumnKey[]) => void;
  setGraphDataTableAggregateKeys: (next: GraphDataTableColumnKey[]) => void;
  setGraphDataTableFilterMatch: (match: GraphDataTableFilterMatch) => void;
  setGraphDataTableFilterClauses: (
    updater: GraphDataTableFilterClause[] | ((prev: GraphDataTableFilterClause[]) => GraphDataTableFilterClause[]),
  ) => void;
  setGraphDataTableSortRules: (
    updater: GraphDataTableSortRule[] | ((prev: GraphDataTableSortRule[]) => GraphDataTableSortRule[]),
  ) => void;
  setGraphDataTableGroupKey: (key: GraphDataTableColumnKey | '') => void;
  setGraphDataTableAutoSortEnabled: (v: boolean) => void;
  setGraphDataTableRowDensity: (v: GraphDataTableRowDensity) => void;
  setGraphDataTableDisableAutoScroll: (v: boolean) => void;
  setGraphDataTableColumnWidth: (key: GraphDataTableColumnKey, width: number) => void;
  setGraphDataTableFreezeFirstDataColumn: (scope: GraphDataTableScope, v: GraphDataTableFreezeMode) => void;
  setGraphDataTableAggregateDefaultVizMode: (v: 'none' | 'radial' | 'bars' | 'sparkline') => void;
  setGraphDataTableAggregateIncludeMixedNumericFields: (v: boolean) => void;
  setGraphDataTableAggregateIncludeIdAsNumeric: (v: boolean) => void;
  setGraphDataTableAggregateIncludeSourceAsNumeric: (v: boolean) => void;
  setGraphDataTableAggregateIncludeTargetAsNumeric: (v: boolean) => void;
  setGraphDataTableNumericSampleLimit: (v: number) => void;
  setGraphDataTableNumericSampleMinCount: (v: number) => void;
  setGraphDataTableNumericSampleMinRatio: (v: number) => void;
  setSpotlightMargin: (v: number) => void;
  setSpotlightNearTopThreshold: (v: number) => void;
  setGraphDataTableFrozenDragStepNoneLabelPx: (v: number) => void;
  setGraphDataTableFrozenDragStepLabelIdPx: (v: number) => void;
  setGraphDataTableVirtualOverscanRows: (v: number) => void;
  setGraphDataTableOverscanMultiplier: (v: number) => void;
  setGraphDataTableVirtualMinRows: (v: number) => void;
  setGraphDataTableVirtualDebugLogRanges: (v: boolean) => void;
  setMarkdownDocument: (name: string | null, text: string | null) => void;
  setMarkdownDocumentSourceUrl: (url: string | null) => void;
  setMarkdownPreviewMermaidFocus: (
    focus: { code: string; frontmatterConfig: Record<string, unknown> | null } | null,
  ) => void;
  setMarkdownPreviewActiveMediaKey: (key: string | null) => void;
  setUiPanelKeyValueTextSizeClass: (className: string) => void;
  setUiPanelTextFontClass: (className: string) => void;
  setUiPanelKeyValueInputClass: (className: string) => void;
  setUiPanelRowDensityDefaultClass: (className: string) => void;
  setUiPanelRowDensityCompactClass: (className: string) => void;
  setUiPanelMonospaceTextClass: (className: string) => void;
  setUiPanelMicroLabelTextSizeClass: (className: string) => void;
  setUiHeaderRowHeightClass: (className: string) => void;
  setUiHeaderRowPaddingClass: (className: string) => void;
  setUiSectionHeaderRowHeightClass: (className: string) => void;
  setUiSectionHeaderRowPaddingClass: (className: string) => void;
  setUiIconFormat: (format: 'default' | 'minimal' | '1') => void;
  setUiIconStrokeWidth: (width: number) => void;
  setUiIconColorClass: (className: string) => void;
  setUiIconHoverBgClass: (className: string) => void;
  setUiIconButtonPaddingClass: (className: string) => void;
  setUiIconPillClass: (className: string) => void;
  setUiIconPillLegendTextSizeClass: (className: string) => void;
  setUiIconPillBadgeTextSizeClass: (className: string) => void;
  setUiIconBadgeChipClass: (className: string) => void;
  setUiIconBadgeChipTextSizeClass: (className: string) => void;
  setUiIconAnimationEnabled: (v: boolean) => void;
  canvasDims: { w: number; h: number };
  canvasPos: { x: number; y: number };
  setCanvasDims: (d: { w: number; h: number }) => void;
  setCanvasPos: (p: { x: number; y: number }) => void;
  polygonGroupsVisible: boolean;
  setPolygonGroupsVisible: (v: boolean) => void;
  togglePolygonGroupsVisible: () => void;
  fitToScreenMode: boolean;
  setFitToScreenMode: (v: boolean) => void;
  toggleFitToScreenMode: () => void;
  zoomToSelectionMode: boolean;
  setZoomToSelectionMode: (v: boolean) => void;
  toggleZoomToSelectionMode: () => void;
  zoomRequest: null | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection' | 'transform'; at: number; payload?: { k: number; x: number; y: number } };
  requestZoom: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => void;
  requestZoomTransform: (payload: { k: number; x: number; y: number }) => void;
  zoomState: null | { k: number; x: number; y: number; graphDataRevision?: number };
  setZoomState: (z: { k: number; x: number; y: number; graphDataRevision?: number }) => void;
  threeCameraRequest: null | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at: number };
  requestThreeCamera: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => void;
  clearThreeCameraRequest: () => void;
  edgeCreationRequest: null | { type: 'create' | 'update-source' | 'update-target'; fromId: string; at: number };
  requestEdgeCreation: (req: { type: 'create' | 'update-source' | 'update-target'; fromId: string }) => void;
  clearEdgeCreationRequest: () => void;
  minimapPreview: { nodesPath: string; edgesPath: string; sx: number; bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } };
  minimapWorkerRef: Worker | null;
  cancelMinimapWorker: () => void;
  computeMinimapPreviewQuick: () => void;
  computeMinimapPreviewAsync: () => void;
  setSchema: (schema: GraphSchema) => void;
  updateNodeStyle: (type: string, style: Partial<{ color: string }>) => void;
  updateEdgeStyle: (label: string, style: Partial<{ color: string; width: number }>) => void;
  setBehavior: (b: Partial<GraphBehavior>) => void;
  updateNodeSize: (type: string, size: Partial<{ radius: number }>) => void;
  updateNodeStroke: (type: string, stroke: Partial<{ color: string; width: number }>) => void;
  setLabelStyles: (styles: Partial<{ fontSize: number; color: string }>) => void;
  setLabelOffset: (off: Partial<{ dx: number; dy: number }>) => void;
  setLinkDistanceByLabel: (label: string, dist: number) => void;
  setCharge: (val: number) => void;
  setCollisionByType: (type: string, radius: number) => void;
  setAlphaDecay: (val: number) => void;
  setThreeConfig: (cfg: Partial<GraphSchema['three']>) => void;
  upsertNodeValidation: (type: string, v: Partial<{ required?: string[]; types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>; patterns?: Record<string, string>; ranges?: Record<string, { min?: number; max?: number }>; uniqueness?: string[]; severity?: 'error' | 'warn' }>) => void;
  upsertEdgeValidation: (label: string, v: Partial<{ required?: string[]; types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>; patterns?: Record<string, string>; ranges?: Record<string, { min?: number; max?: number }>; uniqueness?: string[]; severity?: 'error' | 'warn' }>) => void;
  setEndpointMatrix: (label: string, sources: string[], targets: string[]) => void;
  setCardinalityNodeType: (type: string, minEdges?: number, maxEdges?: number) => void;
  setCardinalityEdgeLabel: (label: string, maxPerNode?: number) => void;
  setNodeTemplate: (type: string, tpl: Record<string, import('@/lib/graph/types').JSONValue>) => void;
  setEdgeTemplate: (label: string, tpl: Record<string, import('@/lib/graph/types').JSONValue>) => void;
  setLodHideLabelsBelow: (scale: number) => void;
  setHighContrast: (v: boolean) => void;
  setNodeShape: (type: string, shape: 'circle' | 'rect' | 'diamond' | 'hex' | 'image') => void;
  setEdgeArrow: (label: string, arrow: boolean) => void;
  setSelectMode: (mode: 'single' | 'multi' | 'lasso') => void;
  setCreateMode: (mode: 'shift-drag' | 'click-source-target' | 'panel-only') => void;
  setHover: (v: Partial<{ intensity: number; debounceMs: number }>) => void;
  setSerialization: (v: Partial<GraphSchema['serialization']>) => void;
  addNodeType: (type: string) => void;
  renameNodeType: (oldType: string, newType: string) => void;
  removeNodeType: (type: string) => void;
  addEdgeLabel: (label: string) => void;
  renameEdgeLabel: (oldLabel: string, newLabel: string) => void;
  removeEdgeLabel: (label: string) => void;
  upsertNodeProperty: (type: string, key: string, spec: PropertySpec) => void;
  removeNodeProperty: (type: string, key: string) => void;
  upsertEdgeProperty: (label: string, key: string, spec: PropertySpec) => void;
  removeEdgeProperty: (label: string, key: string) => void;
  graphId: string;
  tabId: string;
  enableTabSync: boolean;
  enableVirtualTables: boolean;
  aiKgTraversalRan: boolean;
  requestAiKgTraversal: boolean;
  schemaLastExportHash: string | null;
  schemaLintCount: number | null;
  schemaLintExamplePath: string | null;
  schemaLintExamplePaths: string[] | null;
  setGraphId: (id: string) => void;
  setEnableTabSync: (v: boolean) => void;
  setEnableVirtualTables: (v: boolean) => void;
  setAiKgTraversalRan: (v: boolean) => void;
  setRequestAiKgTraversal: (v: boolean) => void;
  lastTraversalSummary: TraversalSummary | null;
  setLastTraversalSummary: (summary: TraversalSummary | null) => void;
  setSchemaLastExportSnapshot: (schema: GraphSchema | null) => void;
  setSchemaLintSummary: (count: number, examplePath: string | null, examplePaths?: string[] | null) => void;
  setSchemaLintActivePath: (examplePath: string | null) => void;
  clearSchemaLintSummary: () => void;
  canvasRenderMode: '2d' | '3d';
  setCanvasRenderMode: (m: '2d' | '3d') => void;
  resetAll: () => void;
  canvasSnapshotFns: { '2d'?: CanvasSnapshotFns; '3d'?: CanvasSnapshotFns };
  registerCanvasSnapshotFns: (mode: '2d' | '3d', fns: CanvasSnapshotFns | null) => void;
  captureCanvasPngSnapshot: (mode?: '2d' | '3d') => Promise<Blob | null>;
  captureCanvasSvgSnapshot: () => Promise<string | null>;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  schema: (() => {
    try {
      const storage = getLocalStorage()
      return readSchemaFromStorage(storage) || defaultSchema
    } catch {
      return defaultSchema
    }
  })(),
  layoutPositionCacheByMode: {},
  graphFieldsOpOk: null,
  graphFieldsOpMsg: '',
  orchestratorOpOk: null,
  orchestratorOpMsg: '',
  renderOpOk: null,
  renderOpMsg: '',
  lifecycleStage: 'idle',
  setLifecycleStage: (v) => set({ lifecycleStage: v }),
  ...createGraphDataSlice(set, get),
  ...createMinimapSlice(set, get),
  ...createSelectionSlice(set, get),
  ...createHistorySlice(set, get),
  ...createUiSlice(set),
  ...createCanvasSlice(set),
  ...createSchemaSlice(set, get),
  graphValidationStatus: null,
  graphValidationTimestamp: null,
  setGraphValidationResult: (status: 'valid' | 'invalid' | null, timestamp: number | null) => {
    const normalizedStatus: 'valid' | 'invalid' | null =
      status === 'valid' || status === 'invalid' ? status : null;
    const normalizedTimestamp =
      typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
        ? timestamp
        : null;
    set({
      graphValidationStatus: normalizedStatus,
      graphValidationTimestamp: normalizedTimestamp,
    });
  },
  setGraphFieldsOpStatus: (ok: boolean | null, msg: string) => {
    const cleanedMsg = typeof msg === 'string' ? msg.trim() : '';
    set({ graphFieldsOpOk: ok, graphFieldsOpMsg: cleanedMsg });
  },
  setOrchestratorOpStatus: (ok: boolean | null, msg: string) => {
    const cleanedMsg = typeof msg === 'string' ? msg.trim() : '';
    set({ orchestratorOpOk: ok, orchestratorOpMsg: cleanedMsg });
  },
  setRenderOpStatus: (ok: boolean | null, msg: string) => {
    const cleanedMsg = typeof msg === 'string' ? msg.trim() : '';
    set({ renderOpOk: ok, renderOpMsg: cleanedMsg });
  },
  graphRagWorkflowJsonText: null,
  spotlightMargin: 8,
  spotlightNearTopThreshold: 96,
  setSpotlightMargin: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 8;
    set({ spotlightMargin: n >= 0 ? n : 0 });
  },
  setSpotlightNearTopThreshold: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 96;
    set({ spotlightNearTopThreshold: n >= 0 ? n : 0 });
  },
  setGraphRagWorkflowJsonText: (text: string | null) => {
    const nextText = typeof text === 'string' ? text : null
    set({ graphRagWorkflowJsonText: nextText });
    const graphData = get().graphData
    if (!graphData) return

    const nextMetadata = { ...(graphData.metadata || {}) } as Record<string, import('@/lib/graph/types').JSONValue>
    const trimmed = typeof nextText === 'string' ? nextText.trim() : ''
    if (!trimmed) {
      if ('graphRagWorkflowJsonText' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonText
      if ('graphRagWorkflowJsonLd' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonLd
    } else {
      nextMetadata.graphRagWorkflowJsonText = nextText as unknown as import('@/lib/graph/types').JSONValue
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (isJsonValue(parsed) && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const t = (parsed as Record<string, unknown>)['@type']
          if (t === 'rag:GraphRAGWorkflow' || t === 'GraphRAGWorkflow') {
            nextMetadata.graphRagWorkflowJsonLd = parsed as unknown as import('@/lib/graph/types').JSONValue
          } else if ('graphRagWorkflowJsonLd' in nextMetadata) {
            delete nextMetadata.graphRagWorkflowJsonLd
          }
        } else if ('graphRagWorkflowJsonLd' in nextMetadata) {
          delete nextMetadata.graphRagWorkflowJsonLd
        }
      } catch {
        if ('graphRagWorkflowJsonLd' in nextMetadata) delete nextMetadata.graphRagWorkflowJsonLd
      }
    }

    const nextGraphData: GraphData = {
      ...graphData,
      metadata: nextMetadata,
    }
    set({ graphData: nextGraphData })
    try {
      lsSetJson(LS_KEYS.graphData, nextGraphData)
    } catch {
      void 0
    }
    try {
      get().scheduleHistory('Update GraphRAG workflow')
    } catch {
      void 0
    }
  },
  schemaLastExportHash: null,
  schemaLintCount: null,
  schemaLintExamplePath: null,
  schemaLintExamplePaths: null,
  graphId: 'default',
  tabId: (() => {
    try {
      const existing = ssString(SESSION_KEYS.tabId, '')
      if (existing) return existing
      const id = `tab-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
      ssSetString(SESSION_KEYS.tabId, id)
      return id
    } catch {
      return 'tab-ssr';
    }
  })(),
  enableTabSync: true,
  enableVirtualTables: true,
  aiKgTraversalRan: false,
  requestAiKgTraversal: false,
  lastTraversalSummary: null,
  setGraphId: (id: string) => set({ graphId: id }),
  setEnableTabSync: (v: boolean) => set({ enableTabSync: v }),
  setEnableVirtualTables: (v: boolean) => set({ enableVirtualTables: v }),
  setAiKgTraversalRan: (v: boolean) => set({ aiKgTraversalRan: !!v }),
  setRequestAiKgTraversal: (v: boolean) => set({ requestAiKgTraversal: !!v }),
  setLastTraversalSummary: (summary: TraversalSummary | null) => {
    const next = summary || null;
    set({ lastTraversalSummary: next });
  },
  setSchemaLastExportSnapshot: (schema: GraphSchema | null) => {
    if (!schema) {
      set({ schemaLastExportHash: null });
      return;
    }
    try {
      const hash = JSON.stringify(schema);
      set({ schemaLastExportHash: hash });
    } catch {
      set({ schemaLastExportHash: null });
    }
  },
  setSchemaLintSummary: (count: number, examplePath: string | null, examplePaths?: string[] | null) => {
    const active = (() => {
      const v = typeof examplePath === 'string' ? examplePath.trim() : ''
      return v ? v : null
    })()
    const cleaned = (() => {
      if (!examplePaths) return null
      if (!Array.isArray(examplePaths)) return null
      const vals = examplePaths.map(p => String(p || '').trim()).filter(p => p.length > 0)
      return vals.length > 0 ? vals : null
    })()
    set({
      schemaLintCount: count,
      schemaLintExamplePath: active,
      schemaLintExamplePaths: cleaned,
    })
  },
  setSchemaLintActivePath: (examplePath: string | null) => {
    const v = typeof examplePath === 'string' ? examplePath.trim() : ''
    set({ schemaLintExamplePath: v ? v : null })
  },
  clearSchemaLintSummary: () => {
    set({ schemaLintCount: null, schemaLintExamplePath: null, schemaLintExamplePaths: null })
  },
  canvasRenderMode: '2d',
  setCanvasRenderMode: (m: '2d' | '3d') => set({ canvasRenderMode: m === '3d' ? '3d' : '2d' }),
  canvasSnapshotFns: {},
  registerCanvasSnapshotFns: (mode: '2d' | '3d', fns: CanvasSnapshotFns | null) => {
    set(state => {
      const next = { ...(state.canvasSnapshotFns || {}) };
      if (fns) next[mode] = fns;
      else delete next[mode];
      return { canvasSnapshotFns: next };
    });
  },
  captureCanvasPngSnapshot: async (mode?: '2d' | '3d') => {
    try {
      const state = get();
      const m: '2d' | '3d' = mode || state.canvasRenderMode || '2d';
      const fns = state.canvasSnapshotFns || {};
      const fn = fns[m]?.capturePng;
      if (!fn) return null;
      const ratio =
        typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0
          ? window.devicePixelRatio
          : 1;
      const blob = await fn(ratio);
      return blob || null;
    } catch {
      return null;
    }
  },
  captureCanvasSvgSnapshot: async () => {
    try {
      const state = get();
      const fns = state.canvasSnapshotFns || {};
      const fn = fns['2d']?.captureSvg;
      if (!fn) return null;
      const svg = await fn();
      if (!svg || !svg.trim()) return null;
      return svg;
    } catch {
      return null;
    }
  },
  resetAll: () => {
    try { get().cancelMinimapWorker?.() } catch { void 0 }
    try { get().clearEdgeCreationRequest?.() } catch { void 0 }
    try { get().clearGraphData?.() } catch { void 0 }
    try { set({ history: [], historyIndex: -1 }) } catch { void 0 }
    try { set({ selectedNodeId: null, selectedEdgeId: null }) } catch { void 0 }
    try { set({ aiKgTraversalRan: false, lastTraversalSummary: null }) } catch { void 0 }
    try { set({ canvasRenderMode: '2d' }) } catch { void 0 }
    try { set({ zoomRequest: { type: 'reset', at: Date.now() } }) } catch { void 0 }
    try { get().setSchema(defaultSchema) } catch { void 0 }
    try { get().setSchemaImportLabel(null) } catch { void 0 }
    try { get().setSchemaOpStatus(null, '') } catch { void 0 }
    try { set({ graphFieldsOpOk: null, graphFieldsOpMsg: '' }) } catch { void 0 }
    try { set({ orchestratorOpOk: null, orchestratorOpMsg: '' }) } catch { void 0 }
    try { set({ renderOpOk: null, renderOpMsg: '' }) } catch { void 0 }
    try { set({ schemaLastExportHash: null, schemaLintCount: null, schemaLintExamplePath: null, schemaLintExamplePaths: null }) } catch { void 0 }
    try { useParserUIState.getState().reset() } catch { void 0 }
    try { clearCustomParsers() } catch { void 0 }
  },
}));
