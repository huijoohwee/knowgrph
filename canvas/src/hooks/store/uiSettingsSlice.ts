import type { StoreApi } from 'zustand';
import type { GraphState, GraphDataTableScope, GraphDataTableFreezeMode } from './types';
import type { GraphFieldId, GraphFieldSettingsById } from '@/features/graph-fields/graphFields';
import type { BottomTab } from '@/features/bottom-panel/open';
import type {
  GraphDataTableColumnKey,
  GraphDataTableColumnVisibilityByKey,
  GraphDataTableFilterClause,
  GraphDataTableFilterMatch,
  GraphDataTableRowDensity,
  GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable';
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal';
import { SESSION_KEYS } from '@/lib/config';
import { ssSetString, ssString } from '@/lib/persistence';

type SetGraph = StoreApi<GraphState>['setState'];

export const createUiSettingsSlice = (set: SetGraph) => ({
  uiPanelKeyValueTextSizeClass: 'text-xs',
  uiPanelTextFontClass: 'font-sans',
  uiPanelKeyValueInputClass: 'h-6 text-xs px-1 py-0',
  uiPanelRowDensityDefaultClass: 'py-2',
  uiPanelRowDensityCompactClass: 'py-1',
  uiPanelMonospaceTextClass: 'font-mono text-[10px]',
  uiPanelMicroLabelTextSizeClass: 'text-[10px]',
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
  uiHeaderRowHeightClass: 'h-8',
  uiHeaderRowPaddingClass: 'px-2',
  uiSectionHeaderRowHeightClass: 'h-6',
  uiSectionHeaderRowPaddingClass: 'px-2',
  uiIconScale: 'default' as const,
  uiIconFormat: 'default' as const,
  uiIconStrokeWidth: 1.5,
  uiIconColorClass: 'text-slate-500 dark:text-slate-400',
  uiIconHoverBgClass: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  uiIconButtonPaddingClass: 'p-1',
  uiIconPillClass: 'rounded-full px-2 py-0.5 border border-slate-200 dark:border-slate-700',
  uiIconPillLegendTextSizeClass: 'text-[10px] font-medium text-slate-500',
  uiIconPillBadgeTextSizeClass: 'text-[10px] font-bold',
  uiIconBadgeChipClass: 'rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800',
  uiIconBadgeChipTextSizeClass: 'text-[10px] font-mono',
  uiIconAnimationEnabled: true,
  selectionFlashDurationMs: 500,
  selectionFlashOpacity: 0.18,
  uiOverlayOpacity: 0.9,
  uiPanelOpacity: 0.95,
  uiToolbarOpacity: 0.95,
  chatEndpointUrl: null as string | null,
  chatModel: null as string | null,
  chatTemperature: 0.7,
  chatSystemPrompt: null as string | null,
  bottomPanelHeightRatio: 0.35,
  floatingPanelWidthRatio: 0.25,
  floatingPanelHeightRatio: 0.5,
  floatingPanelZIndex: 40,
  sidebarWidthRatio: 0.2,
  bottomPanelTab: 'graph-data' as BottomTab,
  bottomPanelCurationView: 'grid' as const,
  bottomPanelCodeSource: 'graph-json' as const,
  launchSpotlightMode: 'tour' as const,
  enableLaunchSpotlight: true,
  statusPanelPinned: false,
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
  graphId: 'default',
  markdownAlwaysOnHighlightComplexityBudget: null as number | null,
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

  setUiIconScale: (scale: 'compact' | 'default') => set({ uiIconScale: scale }),
  setUiOverlayOpacity: (v: number) => set({ uiOverlayOpacity: v }),
  setUiPanelOpacity: (v: number) => set({ uiPanelOpacity: v }),
  setUiToolbarOpacity: (v: number) => set({ uiToolbarOpacity: v }),
  setChatEndpointUrl: (url: string | null) => set({ chatEndpointUrl: url }),
  setChatModel: (model: string | null) => set({ chatModel: model }),
  setChatTemperature: (v: number) => set({ chatTemperature: v }),
  setChatSystemPrompt: (v: string | null) => set({ chatSystemPrompt: v }),
  setBottomPanelHeightRatio: (v: number) => set({ bottomPanelHeightRatio: v }),
  setFloatingPanelWidthRatio: (v: number) => set({ floatingPanelWidthRatio: v }),
  setFloatingPanelHeightRatio: (v: number) => set({ floatingPanelHeightRatio: v }),
  setFloatingPanelZIndex: (v: number) => set({ floatingPanelZIndex: v }),
  setSidebarWidthRatio: (v: number) => set({ sidebarWidthRatio: v }),
  setBottomPanelTab: (tab: BottomTab) => set({ bottomPanelTab: tab }),
  setBottomPanelCurationView: (view: 'grid' | 'json' | 'markdown') => set({ bottomPanelCurationView: view }),
  setLaunchSpotlightMode: (mode: 'tour' | 'stats') => set({ launchSpotlightMode: mode }),
  setEnableLaunchSpotlight: (v: boolean) => set({ enableLaunchSpotlight: v }),
  setStatusPanelPinned: (v: boolean) => set({ statusPanelPinned: v }),
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
  setUiPanelKeyValueTextSizeClass: (className: string) => set({ uiPanelKeyValueTextSizeClass: className }),
  setUiPanelTextFontClass: (className: string) => set({ uiPanelTextFontClass: className }),
  setUiPanelKeyValueInputClass: (className: string) => set({ uiPanelKeyValueInputClass: className }),
  setUiPanelRowDensityDefaultClass: (className: string) => set({ uiPanelRowDensityDefaultClass: className }),
  setUiPanelRowDensityCompactClass: (className: string) => set({ uiPanelRowDensityCompactClass: className }),
  setUiPanelMonospaceTextClass: (className: string) => set({ uiPanelMonospaceTextClass: className }),
  setUiPanelMicroLabelTextSizeClass: (className: string) => set({ uiPanelMicroLabelTextSizeClass: className }),
  setUiHeaderRowHeightClass: (className: string) => set({ uiHeaderRowHeightClass: className }),
  setUiHeaderRowPaddingClass: (className: string) => set({ uiHeaderRowPaddingClass: className }),
  setUiSectionHeaderRowHeightClass: (className: string) => set({ uiSectionHeaderRowHeightClass: className }),
  setUiSectionHeaderRowPaddingClass: (className: string) => set({ uiSectionHeaderRowPaddingClass: className }),
  setUiIconFormat: (format: 'default' | 'minimal' | '1') => set({ uiIconFormat: format }),
  setUiIconStrokeWidth: (width: number) => set({ uiIconStrokeWidth: width }),
  setUiIconColorClass: (className: string) => set({ uiIconColorClass: className }),
  setUiIconHoverBgClass: (className: string) => set({ uiIconHoverBgClass: className }),
  setUiIconButtonPaddingClass: (className: string) => set({ uiIconButtonPaddingClass: className }),
  setUiIconPillClass: (className: string) => set({ uiIconPillClass: className }),
  setUiIconPillLegendTextSizeClass: (className: string) => set({ uiIconPillLegendTextSizeClass: className }),
  setUiIconPillBadgeTextSizeClass: (className: string) => set({ uiIconPillBadgeTextSizeClass: className }),
  setUiIconBadgeChipClass: (className: string) => set({ uiIconBadgeChipClass: className }),
  setUiIconBadgeChipTextSizeClass: (className: string) => set({ uiIconBadgeChipTextSizeClass: className }),
  setUiIconAnimationEnabled: (v: boolean) => set({ uiIconAnimationEnabled: v }),
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

  setSpotlightMargin: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 8;
    set({ spotlightMargin: n >= 0 ? n : 0 });
  },
  setSpotlightNearTopThreshold: (v: number) => {
    const n = Number.isFinite(v) ? Number(v) : 96;
    set({ spotlightNearTopThreshold: n >= 0 ? n : 0 });
  },
  setMarkdownAlwaysOnHighlightComplexityBudget: (v: number | null) => {
    if (v == null) {
      set({ markdownAlwaysOnHighlightComplexityBudget: null });
      return;
    }
    const n = Number.isFinite(v) ? Number(v) : 0;
    const clamped = n < 0 ? 0 : n;
    set({ markdownAlwaysOnHighlightComplexityBudget: clamped });
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
});
