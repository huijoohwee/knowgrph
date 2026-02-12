import type { StoreApi } from 'zustand';
import type { GraphState, GraphDataTableScope, GraphDataTableFreezeMode, GraphHoverPreviewConfig, DocumentSemanticMode, BottomTab } from './types';
import type { GraphFieldId, GraphFieldSettingsById } from '@/features/graph-fields/graphFields';
import type {
  GraphDataTableColumnKey,
  GraphDataTableColumnVisibilityByKey,
  GraphDataTableFilterClause,
  GraphDataTableFilterMatch,
  GraphDataTableRowDensity,
  GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable';
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal';
import { SESSION_KEYS, UI_COPY } from '@/lib/config';
import { ssSetString, ssString, getLocalStorage } from '@/lib/persistence';
import { ThemeMode, ResolvedThemeMode, getInitialThemeMode, persistThemeMode, applyThemeMode, resolveThemeMode, getSystemTheme } from '@/lib/ui/theme';

type SetGraph = StoreApi<GraphState>['setState'];
type GetGraph = StoreApi<GraphState>['getState'];

export const createUiSettingsSlice = (set: SetGraph, get: GetGraph) => {
  const themeMode = getInitialThemeMode(getLocalStorage())
  applyThemeMode(themeMode)
  const resolvedThemeMode: ResolvedThemeMode = resolveThemeMode(themeMode)
  return ({
  renderMediaAsNodes: true,
  setRenderMediaAsNodes: (v: boolean) => set({ renderMediaAsNodes: v }),
  mediaNodeOpacity: 0.9,
  setMediaNodeOpacity: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 0.9;
    const clamped = n < 0 ? 0 : n > 1 ? 1 : n;
    set({ mediaNodeOpacity: clamped });
  },
  mediaPanelDensity: 'default' as const,
  setMediaPanelDensity: (v: 'default' | 'compact') => set({ mediaPanelDensity: v }),
  themeMode,
  resolvedThemeMode,
  setThemeMode: (mode: ThemeMode) => {
    persistThemeMode(getLocalStorage(), mode);
    applyThemeMode(mode);
    set({ themeMode: mode, resolvedThemeMode: resolveThemeMode(mode) });
  },
  refreshResolvedThemeModeFromSystem: () => {
    set((state) => {
      if (state.themeMode !== 'system') return {} as Partial<GraphState>;
      const next = getSystemTheme();
      applyThemeMode('system');
      if (state.resolvedThemeMode === next) return {} as Partial<GraphState>;
      return { resolvedThemeMode: next };
    });
  },
  selectionFlashDurationMs: 500,
  selectionFlashOpacity: 0.18,
  markdownSelectionFlashMode: 'auto' as const,
  bottomPanelHeightRatio: 0.35,
  floatingPanelWidthRatio: 0.25,
  floatingPanelHeightRatio: 0.5,
  floatingPanelZIndex: 40,
  bottomPanelTab: 'stats' as BottomTab,
  frontmatterModeEnabled: true,
  documentSemanticMode: 'document' as DocumentSemanticMode,
  schemaDeriveCacheCapacity: 50,
  graphFieldSettingsById: {} as GraphFieldSettingsById,
  selectedGraphFieldId: null as GraphFieldId | null,
  graphRagWorkflowJsonText: null as string | null,
  graphDataTableVisibleColumns: {} as GraphDataTableColumnVisibilityByKey,
  graphDataTableColumnOrder: [] as GraphDataTableColumnKey[],
  graphDataTableAggregateKeys: [] as GraphDataTableColumnKey[],
  graphDataTableFilterMatch: 'all' as GraphDataTableFilterMatch,
  graphDataTableFilterClauses: [] as GraphDataTableFilterClause[],
  graphDataTableSortRules: [] as GraphDataTableSortRule[],
  graphDataTableGroupKey: '' as GraphDataTableColumnKey | '',
  graphDataTableAutoSortEnabled: true,
  graphDataTableRowDensity: 'standard' as GraphDataTableRowDensity,
  graphDataTableDisableAutoScroll: false,
  graphDataTableColumnWidths: {},
  graphDataTableFreezeFirstDataColumn: 'none' as GraphDataTableFreezeMode,
  graphDataTableFreezeFirstDataColumnByScope: {
    all: 'none',
    nodes: 'none',
    edges: 'none',
  } as Record<GraphDataTableScope, GraphDataTableFreezeMode>,
  graphDataTableAggregateDefaultVizMode: 'none' as const,
  graphDataTableAggregateIncludeMixedNumericFields: false,
  graphDataTableAggregateIncludeIdAsNumeric: false,
  graphDataTableAggregateIncludeSourceAsNumeric: false,
  graphDataTableAggregateIncludeTargetAsNumeric: false,
  graphDataTableNumericSampleLimit: 100,
  graphDataTableNumericSampleMinCount: 5,
  graphDataTableNumericSampleMinRatio: 0.8,
  spotlightMargin: 8,
  spotlightNearTopThreshold: 96,
  graphDataTableFrozenDragStepNoneLabelPx: 120,
  graphDataTableFrozenDragStepLabelIdPx: 200,
  graphDataTableVirtualOverscanRows: 5,
  graphDataTableOverscanMultiplier: 1.5,
  graphDataTableVirtualMinRows: 10,
  graphDataTableVirtualDebugLogRanges: false,
  graphHoverPreviewConfig: {
    showNodeId: false,
    showNodeName: true,
    showNodeLabel: true,
    showNodeDescription: true,
    showNodeProperties: true,
    showEdgeId: false,
    showEdgeLabel: true,
    showEdgeWeight: true,
    showEdgeProperties: true,
  },
  setGraphHoverPreviewConfig: (config: Partial<GraphHoverPreviewConfig>) =>
    set((state) => ({
      graphHoverPreviewConfig: { ...state.graphHoverPreviewConfig, ...config },
    })),
  graphId: 'default',
  tabId: (() => {
    try {
      const existing = ssString(SESSION_KEYS.tabId, '');
      if (existing) return existing;
      const id = `tab-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
      ssSetString(SESSION_KEYS.tabId, id);
      return id;
    } catch {
      return 'tab-ssr';
    }
  })(),
  enableTabSync: true,
  enableVirtualTables: true,
  aiKgTraversalRan: false,
  requestAiKgTraversal: false,
  schemaLastExportHash: null as string | null,
  schemaLintCount: null as number | null,
  schemaLintExamplePath: null as string | null,
  schemaLintExamplePaths: null as string[] | null,
  lastTraversalSummary: null as TraversalSummary | null,

  setBottomPanelHeightRatio: (v: number) => set({ bottomPanelHeightRatio: v }),
  setFloatingPanelWidthRatio: (v: number) => set({ floatingPanelWidthRatio: v }),
  setFloatingPanelHeightRatio: (v: number) => set({ floatingPanelHeightRatio: v }),
  setFloatingPanelZIndex: (v: number) => set({ floatingPanelZIndex: v }),
  setBottomPanelTab: (tab: BottomTab) => set({ bottomPanelTab: tab }),
  setFrontmatterModeEnabled: (v: boolean) => {
    if (get().documentStructureBaselineLock === true) {
      get().upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    set({ frontmatterModeEnabled: v })
  },
  setDocumentSemanticMode: (v: DocumentSemanticMode) => {
    if (get().documentStructureBaselineLock === true) {
      get().upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    const nextMode: DocumentSemanticMode = v === 'keyword' ? 'keyword' : 'document'
    const prevMode: DocumentSemanticMode = (get().documentSemanticMode || 'document') as DocumentSemanticMode
    if (nextMode === prevMode) return
    set(state => {
      const prevSchemaByMode = state.schemaBySemanticMode
      const schemaByMode = {
        document: prevSchemaByMode?.document || state.schema,
        keyword: prevSchemaByMode?.keyword || state.schema,
        [prevMode]: state.schema,
      }
      const nextSchema = schemaByMode[nextMode] || state.schema
      return {
        documentSemanticMode: nextMode,
        schema: nextSchema,
        schemaBySemanticMode: schemaByMode,
        selectedNodeId: null,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
        collapsedGroupIds: [],
      } as Partial<GraphState>
    })
  },
  setSchemaDeriveCacheCapacity: (n: number) => set({ schemaDeriveCacheCapacity: n }),
  setGraphFieldSettingsById: (next: GraphFieldSettingsById) => set({ graphFieldSettingsById: next }),
  setSelectedGraphFieldId: (id: GraphFieldId | null) => set({ selectedGraphFieldId: id }),
  setGraphDataTableVisibleColumns: (next: GraphDataTableColumnVisibilityByKey) => set({ graphDataTableVisibleColumns: next }),
  setGraphDataTableColumnOrder: (next: GraphDataTableColumnKey[]) => set({ graphDataTableColumnOrder: next }),
  setGraphDataTableAggregateKeys: (next: GraphDataTableColumnKey[]) => set({ graphDataTableAggregateKeys: next }),
  setGraphDataTableFilterMatch: (match: GraphDataTableFilterMatch) => set({ graphDataTableFilterMatch: match }),
  setGraphDataTableFilterClauses: (
    updater: GraphDataTableFilterClause[] | ((prev: GraphDataTableFilterClause[]) => GraphDataTableFilterClause[]),
  ) =>
    set(state => ({
      graphDataTableFilterClauses: typeof updater === 'function' ? updater(state.graphDataTableFilterClauses) : updater,
    })),
  setGraphDataTableSortRules: (
    updater: GraphDataTableSortRule[] | ((prev: GraphDataTableSortRule[]) => GraphDataTableSortRule[]),
  ) =>
    set(state => ({
      graphDataTableSortRules: typeof updater === 'function' ? updater(state.graphDataTableSortRules) : updater,
    })),
  setGraphDataTableGroupKey: (key: GraphDataTableColumnKey | '') => set({ graphDataTableGroupKey: key }),
  setGraphDataTableAutoSortEnabled: (v: boolean) => set({ graphDataTableAutoSortEnabled: v }),
  setGraphDataTableRowDensity: (v: GraphDataTableRowDensity) => set({ graphDataTableRowDensity: v }),
  setGraphDataTableDisableAutoScroll: (v: boolean) => set({ graphDataTableDisableAutoScroll: v }),
  setGraphDataTableColumnWidth: (key: GraphDataTableColumnKey, width: number) =>
    set(state => ({ graphDataTableColumnWidths: { ...state.graphDataTableColumnWidths, [key]: width } })),
  setGraphDataTableFreezeFirstDataColumn: (scope: GraphDataTableScope, v: GraphDataTableFreezeMode) =>
    set(state => ({
      graphDataTableFreezeFirstDataColumn: scope === 'all' ? v : state.graphDataTableFreezeFirstDataColumn,
      graphDataTableFreezeFirstDataColumnByScope: { ...state.graphDataTableFreezeFirstDataColumnByScope, [scope]: v },
    })),
  setGraphDataTableAggregateDefaultVizMode: (v: 'none' | 'radial' | 'bars' | 'sparkline') =>
    set({ graphDataTableAggregateDefaultVizMode: v }),
  setGraphDataTableAggregateIncludeMixedNumericFields: (v: boolean) =>
    set({ graphDataTableAggregateIncludeMixedNumericFields: v }),
  setGraphDataTableAggregateIncludeIdAsNumeric: (v: boolean) => set({ graphDataTableAggregateIncludeIdAsNumeric: v }),
  setGraphDataTableAggregateIncludeSourceAsNumeric: (v: boolean) => set({ graphDataTableAggregateIncludeSourceAsNumeric: v }),
  setGraphDataTableAggregateIncludeTargetAsNumeric: (v: boolean) => set({ graphDataTableAggregateIncludeTargetAsNumeric: v }),
  setGraphDataTableNumericSampleLimit: (v: number) => set({ graphDataTableNumericSampleLimit: v }),
  setGraphDataTableNumericSampleMinCount: (v: number) => set({ graphDataTableNumericSampleMinCount: v }),
  setGraphDataTableNumericSampleMinRatio: (v: number) => set({ graphDataTableNumericSampleMinRatio: v }),
  setGraphDataTableFrozenDragStepNoneLabelPx: (v: number) => set({ graphDataTableFrozenDragStepNoneLabelPx: v }),
  setGraphDataTableFrozenDragStepLabelIdPx: (v: number) => set({ graphDataTableFrozenDragStepLabelIdPx: v }),
  setGraphDataTableVirtualOverscanRows: (v: number) => set({ graphDataTableVirtualOverscanRows: v }),
  setGraphDataTableOverscanMultiplier: (v: number) => set({ graphDataTableOverscanMultiplier: v }),
  setGraphDataTableVirtualMinRows: (v: number) => set({ graphDataTableVirtualMinRows: v }),
  setGraphDataTableVirtualDebugLogRanges: (v: boolean) => set({ graphDataTableVirtualDebugLogRanges: v }),
  setSelectionFlashDurationMs: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 500;
    const clamped = n < 100 ? 100 : n > 2000 ? 2000 : n;
    set({ selectionFlashDurationMs: clamped });
  },
  setSelectionFlashOpacity: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 0.18;
    const clamped = n < 0 ? 0 : n > 1 ? 1 : n;
    set({ selectionFlashOpacity: clamped });
  },
  setMarkdownSelectionFlashMode: (v: 'auto' | 'manual') => set({ markdownSelectionFlashMode: v }),

  setSpotlightMargin: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 8;
    set({ spotlightMargin: n >= 0 ? n : 0 });
  },
  setSpotlightNearTopThreshold: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 96;
    set({ spotlightNearTopThreshold: n >= 0 ? n : 0 });
  },
  setGraphId: (id: string) => set({ graphId: id }),
  setEnableTabSync: (v: boolean) => set({ enableTabSync: v }),
  setEnableVirtualTables: (v: boolean) => set({ enableVirtualTables: v }),
  setAiKgTraversalRan: (v: boolean) => set({ aiKgTraversalRan: !!v }),
  setRequestAiKgTraversal: (v: boolean) => set({ requestAiKgTraversal: !!v }),
  setLastTraversalSummary: (summary: TraversalSummary | null) => {
    const next = summary || null;
    set({ lastTraversalSummary: next });
  },
  youtubeTranscriptOutputDir: '/Users/huijoohwee/Documents/GitHub/sandbox/test-data/test-youtube-transcript',
  setYoutubeTranscriptOutputDir: (v: string | null) => set({ youtubeTranscriptOutputDir: v }),

  youtubeTranscriptOutputFormat: 'markdown' as const,
  setYoutubeTranscriptOutputFormat: (v: 'markdown' | 'json') => set({ youtubeTranscriptOutputFormat: v }),

  webpageImportIncludeImages: true,
  setWebpageImportIncludeImages: (v: boolean) => set({ webpageImportIncludeImages: v }),

  webpageImportView: 'markdown' as const,
  setWebpageImportView: (v: 'markdown' | 'json' | 'html') => set({ webpageImportView: v }),

  setPdfImportIncludeImages: (v: boolean) => set({ pdfImportIncludeImages: v }),
});
}
