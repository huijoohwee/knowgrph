import { lsNum, lsSetNum, lsInt, lsSetInt, lsBool, lsSetBool, lsJson, lsSetJson } from '@/lib/persistence';
import { LS_KEYS } from '@/lib/config';
import type { GraphDataTableFreezeMode, GraphDataTableScope, GraphState } from '@/hooks/store/types';
import type { StoreApi } from 'zustand';
import {
  buildDefaultVisibleColumns,
  isGraphDataTableColumnKey,
  isGraphDataTablePropertyColumnKey,
  GRAPH_DATA_TABLE_COLUMN_DEFS,
  parseGraphDataTableAggregateVizMode,
  type GraphDataTableColumnKey,
  type GraphDataTableColumnVisibilityByKey,
  type GraphDataTableAggregateVizMode,
  type GraphDataTableFilterCondition,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterMatch,
  type GraphDataTableFilterOperator,
  type GraphDataTableFilterGroup,
  type GraphDataTableRowDensity,
  type GraphDataTableSortRule,
} from '@/features/graph-data-table/graphDataTable';
import { createInitialFilterState, type GraphDataTableFilterState } from '@/features/graph-data-table/graphDataTableFilters';
import { createInitialSortRules } from '@/features/graph-data-table/graphDataTableSorts';

type SetGraph = StoreApi<GraphState>['setState'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseBooleanRecord(raw: unknown): Record<string, boolean> | null {
  if (!isRecord(raw)) return null;
  const next: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') next[k] = v;
  }
  return next;
}

function parseGraphDataTableVisibleColumns(raw: unknown): GraphDataTableColumnVisibilityByKey | null {
  const parsed = parseBooleanRecord(raw);
  if (!parsed) return null;
  const next: GraphDataTableColumnVisibilityByKey = buildDefaultVisibleColumns();
  for (const [k, v] of Object.entries(parsed)) {
    if (!isGraphDataTableColumnKey(k)) continue;
    if (isGraphDataTablePropertyColumnKey(k)) {
      next[k] = v;
    } else {
      next[k] = v;
    }
  }
  return next;
}

function parseGraphDataTableColumnOrder(raw: unknown): GraphDataTableColumnKey[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((v): v is string => typeof v === 'string')
    .filter(isGraphDataTableColumnKey);
}

function parseGraphDataTableFilterState(raw: unknown): GraphDataTableFilterState | null {
  if (!isRecord(raw)) return null;
  const match = raw.match;
  const clauses = raw.clauses;
  if (match !== 'all' && match !== 'any') return null;
  if (!Array.isArray(clauses)) return null;
  const parsedClauses: GraphDataTableFilterClause[] = [];
  for (const clause of clauses) {
    const parsed = parseGraphDataTableFilterClause(clause);
    if (parsed) parsedClauses.push(parsed);
  }
  if (parsedClauses.length === 0) return null;
  return { match, clauses: parsedClauses };
}

function parseGraphDataTableSortRules(raw: unknown): GraphDataTableSortRule[] | null {
  if (!Array.isArray(raw)) return null;
  const next: GraphDataTableSortRule[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = item.id;
    const key = item.key;
    const dir = item.dir;
    if (typeof id !== 'string') continue;
    if (dir !== 'asc' && dir !== 'desc') continue;
    if (typeof key !== 'string' || !isGraphDataTableColumnKey(key)) continue;
    next.push({ id, key, dir });
  }
  if (next.length === 0) return null;
  return next;
}

function parseGraphDataTableGroupKey(raw: unknown): GraphDataTableColumnKey | '' | null {
  if (typeof raw !== 'string') return '';
  if (raw === '') return '';
  if (!isGraphDataTableColumnKey(raw)) return '';
  return raw;
}

function parseGraphDataTableRowDensity(raw: unknown): GraphDataTableRowDensity | null {
  if (raw === 'compact') return 'compact';
  if (raw === 'expanded') return 'expanded';
  return null;
}

function parseGraphDataTableColumnWidths(
  raw: unknown,
): Partial<Record<GraphDataTableColumnKey, number>> | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const next: Partial<Record<GraphDataTableColumnKey, number>> = {};
  for (const [key, v] of Object.entries(value)) {
    if (!isGraphDataTableColumnKey(key)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    next[key] = v;
  }
  return next;
}

type GraphDataTableFreezeModeByScope = Record<GraphDataTableScope, GraphDataTableFreezeMode>;

function isGraphDataTableFilterOperator(value: unknown): value is GraphDataTableFilterOperator {
  return (
    value === 'contains' ||
    value === 'does_not_contain' ||
    value === 'equals' ||
    value === 'not_equals' ||
    value === 'starts_with' ||
    value === 'ends_with' ||
    value === 'is_empty' ||
    value === 'is_not_empty' ||
    value === 'greater_than' ||
    value === 'greater_or_equal' ||
    value === 'less_than' ||
    value === 'less_or_equal'
  );
}

function parseGraphDataTableFilterCondition(raw: unknown): GraphDataTableFilterCondition | null {
  if (!isRecord(raw)) return null;
  if (raw.kind !== 'condition') return null;
  const id = raw.id;
  const key = raw.key;
  const operator = raw.operator;
  const value = raw.value;
  if (typeof id !== 'string') return null;
  if (typeof key !== 'string' || !isGraphDataTableColumnKey(key)) return null;
  if (!isGraphDataTableFilterOperator(operator)) return null;
  if (typeof value !== 'string') return null;
  return { kind: 'condition', id, key, operator, value };
}

function parseGraphDataTableFilterGroup(raw: unknown): GraphDataTableFilterGroup | null {
  if (!isRecord(raw)) return null;
  if (raw.kind !== 'group') return null;
  const id = raw.id;
  const match = raw.match;
  const clauses = raw.clauses;
  if (typeof id !== 'string') return null;
  if (match !== 'all' && match !== 'any') return null;
  if (!Array.isArray(clauses)) return null;
  const nextClauses: GraphDataTableFilterClause[] = [];
  for (const clause of clauses) {
    const parsed = parseGraphDataTableFilterClause(clause);
    if (parsed) nextClauses.push(parsed);
  }
  if (nextClauses.length === 0) return null;
  return { kind: 'group', id, match, clauses: nextClauses };
}

function parseGraphDataTableFilterClause(raw: unknown): GraphDataTableFilterClause | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'condition') return parseGraphDataTableFilterCondition(raw);
  if (raw.kind === 'group') return parseGraphDataTableFilterGroup(raw);
  return null;
}

function parseGraphDataTableFreezeMode(raw: unknown): GraphDataTableFreezeMode {
  if (raw === 'label' || raw === 'id' || raw === 'none') return raw;
  if (raw === true) return 'label';
  return 'none';
}

function parseGraphDataTableFreezeModeByScope(raw: unknown): GraphDataTableFreezeModeByScope | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const all = parseGraphDataTableFreezeMode(value.all);
  const nodes = parseGraphDataTableFreezeMode(value.nodes);
  const edges = parseGraphDataTableFreezeMode(value.edges);
  return {
    all,
    nodes,
    edges,
  };
}

export const createGraphDataTableUiSlice = (set: SetGraph) => {
  const initialFilterState = createInitialFilterState();
  const persistedFilterState = lsJson(
    LS_KEYS.graphDataTableFilterState,
    initialFilterState,
    parseGraphDataTableFilterState,
  );
  const initialSortRules = createInitialSortRules();
  const persistedSortRules = lsJson(
    LS_KEYS.graphDataTableSortRules,
    initialSortRules,
    parseGraphDataTableSortRules,
  );
  const persistedGroupKey = lsJson(
    LS_KEYS.graphDataTableGroupKey,
    '' as GraphDataTableColumnKey | '',
    parseGraphDataTableGroupKey,
  );
  const persistedAutoSortEnabled = lsBool(LS_KEYS.graphDataTableAutoSortEnabled, true);
  const persistedRowDensity = lsJson(LS_KEYS.graphDataTableRowDensity, 'compact', parseGraphDataTableRowDensity);
  const persistedDisableAutoScroll = lsBool(LS_KEYS.graphDataTableDisableAutoScroll, false);
  const persistedColumnWidths = lsJson(
    LS_KEYS.graphDataTableColumnWidths,
    {} as Partial<Record<GraphDataTableColumnKey, number>>,
    parseGraphDataTableColumnWidths,
  );
  const persistedFreezeFirstDataColumn = lsJson(
    LS_KEYS.graphDataTableFreezeFirstDataColumn,
    'none' as 'none' | 'label' | 'id',
    parseGraphDataTableFreezeMode,
  );
  const defaultFreezeModeByScope: GraphDataTableFreezeModeByScope = {
    all: persistedFreezeFirstDataColumn,
    nodes: persistedFreezeFirstDataColumn,
    edges: persistedFreezeFirstDataColumn === 'none' ? 'id' : persistedFreezeFirstDataColumn,
  };
  const persistedFreezeFirstDataColumnByScope = lsJson(
    LS_KEYS.graphDataTableFreezeFirstDataColumnByScope,
    defaultFreezeModeByScope,
    parseGraphDataTableFreezeModeByScope,
  );
  const persistedNumericSampleLimit = lsInt(
    LS_KEYS.graphDataTableNumericSampleLimit,
    200,
  );
  const persistedNumericSampleMinCount = lsInt(
    LS_KEYS.graphDataTableNumericSampleMinCount,
    3,
  );
  const persistedNumericSampleMinRatio = lsNum(
    LS_KEYS.graphDataTableNumericSampleMinRatio,
    0.6,
  );
  const persistedFrozenDragStepNoneLabelPx = lsNum(
    LS_KEYS.graphDataTableFrozenDragStepNoneLabelPx,
    64,
  );
  const persistedFrozenDragStepLabelIdPx = lsNum(
    LS_KEYS.graphDataTableFrozenDragStepLabelIdPx,
    96,
  );
  const persistedTableVirtualOverscanRows = lsInt(
    LS_KEYS.graphDataTableVirtualOverscanRows,
    10,
  );
  const persistedTableOverscanMultiplier = lsNum(
    LS_KEYS.graphDataTableOverscanMultiplier,
    0.5,
  );
  const persistedTableVirtualMinRows = lsInt(
    LS_KEYS.graphDataTableVirtualMinRows,
    200,
  );
  const persistedTableVirtualDebugLogRanges = lsBool(
    LS_KEYS.graphDataTableVirtualDebugLogRanges,
    false,
  );
  const persistedAggregateDefaultVizMode = lsJson(
    LS_KEYS.graphDataTableAggregateDefaultVizMode,
    'radial' as GraphDataTableAggregateVizMode,
    parseGraphDataTableAggregateVizMode,
  );

  return {
    graphDataTableVisibleColumns: lsJson(
      LS_KEYS.graphDataTableVisibleColumns,
      buildDefaultVisibleColumns(),
      parseGraphDataTableVisibleColumns,
    ),
    graphDataTableColumnOrder: lsJson(
      LS_KEYS.graphDataTableColumnOrder,
      GRAPH_DATA_TABLE_COLUMN_DEFS.map(d => d.key),
      parseGraphDataTableColumnOrder,
    ),
    graphDataTableAggregateKeys: lsJson(
      LS_KEYS.graphDataTableAggregateKeys,
      [] as GraphDataTableColumnKey[],
      parseGraphDataTableColumnOrder,
    ),
    graphDataTableFilterMatch: persistedFilterState.match,
    graphDataTableFilterClauses: persistedFilterState.clauses,
    graphDataTableSortRules: persistedSortRules,
    graphDataTableGroupKey: persistedGroupKey,
    graphDataTableAutoSortEnabled: persistedAutoSortEnabled,
    graphDataTableRowDensity: persistedRowDensity,
    graphDataTableDisableAutoScroll: persistedDisableAutoScroll,
    graphDataTableColumnWidths: persistedColumnWidths,
    graphDataTableFreezeFirstDataColumn: persistedFreezeFirstDataColumnByScope.all,
    graphDataTableFreezeFirstDataColumnByScope: persistedFreezeFirstDataColumnByScope,
    graphDataTableAggregateDefaultVizMode: persistedAggregateDefaultVizMode,
    graphDataTableAggregateIncludeMixedNumericFields: lsBool(LS_KEYS.graphDataTableAggregateIncludeMixedNumericFields, false),
    graphDataTableAggregateIncludeIdAsNumeric: lsBool(LS_KEYS.graphDataTableAggregateIncludeIdAsNumeric, false),
    graphDataTableAggregateIncludeSourceAsNumeric: lsBool(LS_KEYS.graphDataTableAggregateIncludeSourceAsNumeric, false),
    graphDataTableAggregateIncludeTargetAsNumeric: lsBool(LS_KEYS.graphDataTableAggregateIncludeTargetAsNumeric, false),
    graphDataTableNumericSampleLimit: persistedNumericSampleLimit,
    graphDataTableNumericSampleMinCount: persistedNumericSampleMinCount,
    graphDataTableNumericSampleMinRatio: persistedNumericSampleMinRatio,
    graphDataTableFrozenDragStepNoneLabelPx: persistedFrozenDragStepNoneLabelPx,
    graphDataTableFrozenDragStepLabelIdPx: persistedFrozenDragStepLabelIdPx,
    graphDataTableVirtualOverscanRows: persistedTableVirtualOverscanRows,
    graphDataTableOverscanMultiplier: persistedTableOverscanMultiplier,
    graphDataTableVirtualMinRows: persistedTableVirtualMinRows,
    graphDataTableVirtualDebugLogRanges: persistedTableVirtualDebugLogRanges,

    setGraphDataTableVisibleColumns: (next: GraphDataTableColumnVisibilityByKey) =>
      set({ graphDataTableVisibleColumns: lsSetJson(LS_KEYS.graphDataTableVisibleColumns, next) }),
    setGraphDataTableColumnOrder: (next: GraphDataTableColumnKey[]) =>
      set({ graphDataTableColumnOrder: lsSetJson(LS_KEYS.graphDataTableColumnOrder, next) }),
    setGraphDataTableAggregateKeys: (next: GraphDataTableColumnKey[]) =>
      set({ graphDataTableAggregateKeys: lsSetJson(LS_KEYS.graphDataTableAggregateKeys, next) }),
    setGraphDataTableFilterMatch: (match: GraphDataTableFilterMatch) =>
      set(state => {
        const nextState: GraphDataTableFilterState = {
          match,
          clauses: state.graphDataTableFilterClauses,
        };
        lsSetJson(LS_KEYS.graphDataTableFilterState, nextState);
        return {
          graphDataTableFilterMatch: nextState.match,
          graphDataTableFilterClauses: nextState.clauses,
        };
      }),
    setGraphDataTableFilterClauses: (
      updater: GraphDataTableFilterClause[] | ((prev: GraphDataTableFilterClause[]) => GraphDataTableFilterClause[]),
    ) =>
      set(state => {
        const prevClauses = state.graphDataTableFilterClauses;
        const clauses =
          typeof updater === 'function'
            ? updater(prevClauses)
            : updater;
        const nextState: GraphDataTableFilterState = {
          match: state.graphDataTableFilterMatch,
          clauses,
        };
        lsSetJson(LS_KEYS.graphDataTableFilterState, nextState);
        return {
          graphDataTableFilterMatch: nextState.match,
          graphDataTableFilterClauses: nextState.clauses,
        };
      }),
    setGraphDataTableSortRules: (
      updater: GraphDataTableSortRule[] | ((prev: GraphDataTableSortRule[]) => GraphDataTableSortRule[]),
    ) =>
      set(state => {
        const prevRules = state.graphDataTableSortRules;
        const rules =
          typeof updater === 'function'
            ? updater(prevRules)
            : updater;
        return {
          graphDataTableSortRules: lsSetJson(LS_KEYS.graphDataTableSortRules, rules),
        };
      }),
    setGraphDataTableGroupKey: (key: GraphDataTableColumnKey | '') =>
      set({
        graphDataTableGroupKey: lsSetJson(LS_KEYS.graphDataTableGroupKey, key),
      }),
    setGraphDataTableAutoSortEnabled: (v: boolean) =>
      set({
        graphDataTableAutoSortEnabled: lsSetBool(LS_KEYS.graphDataTableAutoSortEnabled, v),
      }),
    setGraphDataTableRowDensity: (v: GraphDataTableRowDensity) =>
      set({
        graphDataTableRowDensity: lsSetJson(LS_KEYS.graphDataTableRowDensity, v),
      }),
    setGraphDataTableColumnWidth: (key: GraphDataTableColumnKey, width: number) =>
      set(state => {
        const clamped = Math.max(40, Math.floor(width));
        const next: Partial<Record<GraphDataTableColumnKey, number>> = {
          ...state.graphDataTableColumnWidths,
          [key]: clamped,
        };
        return {
          graphDataTableColumnWidths: lsSetJson(LS_KEYS.graphDataTableColumnWidths, next),
        };
      }),
    setGraphDataTableDisableAutoScroll: (v: boolean) =>
      set({
        graphDataTableDisableAutoScroll: lsSetBool(LS_KEYS.graphDataTableDisableAutoScroll, v),
      }),
    setGraphDataTableFreezeFirstDataColumn: (scope: GraphDataTableScope, v: GraphDataTableFreezeMode) =>
      set(state => {
        const nextByScope: GraphDataTableFreezeModeByScope = {
          ...state.graphDataTableFreezeFirstDataColumnByScope,
          [scope]: v,
        };
        lsSetJson(LS_KEYS.graphDataTableFreezeFirstDataColumnByScope, nextByScope);
        return {
          graphDataTableFreezeFirstDataColumn: nextByScope[scope],
          graphDataTableFreezeFirstDataColumnByScope: nextByScope,
        };
      }),
    setGraphDataTableAggregateDefaultVizMode: (v: 'none' | 'radial' | 'bars' | 'sparkline') =>
      set({
        graphDataTableAggregateDefaultVizMode: lsSetJson(
          LS_KEYS.graphDataTableAggregateDefaultVizMode,
          v,
        ),
      }),
    setGraphDataTableAggregateIncludeMixedNumericFields: (v: boolean) =>
      set({
        graphDataTableAggregateIncludeMixedNumericFields: lsSetBool(
          LS_KEYS.graphDataTableAggregateIncludeMixedNumericFields,
          v,
        ),
      }),
    setGraphDataTableAggregateIncludeIdAsNumeric: (v: boolean) =>
      set({
        graphDataTableAggregateIncludeIdAsNumeric: lsSetBool(
          LS_KEYS.graphDataTableAggregateIncludeIdAsNumeric,
          v,
        ),
      }),
    setGraphDataTableAggregateIncludeSourceAsNumeric: (v: boolean) =>
      set({
        graphDataTableAggregateIncludeSourceAsNumeric: lsSetBool(
          LS_KEYS.graphDataTableAggregateIncludeSourceAsNumeric,
          v,
        ),
      }),
    setGraphDataTableAggregateIncludeTargetAsNumeric: (v: boolean) =>
      set({
        graphDataTableAggregateIncludeTargetAsNumeric: lsSetBool(
          LS_KEYS.graphDataTableAggregateIncludeTargetAsNumeric,
          v,
        ),
      }),
    setGraphDataTableNumericSampleLimit: (v: number) =>
      set({
        graphDataTableNumericSampleLimit: lsSetInt(
          LS_KEYS.graphDataTableNumericSampleLimit,
          v,
          { min: 1, max: 1000000 },
        ),
      }),
    setGraphDataTableNumericSampleMinCount: (v: number) =>
      set({
        graphDataTableNumericSampleMinCount: lsSetInt(
          LS_KEYS.graphDataTableNumericSampleMinCount,
          v,
          { min: 1, max: 1000000 },
        ),
      }),
    setGraphDataTableNumericSampleMinRatio: (v: number) =>
      set({
        graphDataTableNumericSampleMinRatio: lsSetNum(
          LS_KEYS.graphDataTableNumericSampleMinRatio,
          Math.max(0, Math.min(1, v)),
        ),
      }),
    setGraphDataTableFrozenDragStepNoneLabelPx: (v: number) =>
      set({
        graphDataTableFrozenDragStepNoneLabelPx: lsSetNum(
          LS_KEYS.graphDataTableFrozenDragStepNoneLabelPx,
          Math.max(8, Math.floor(v)),
        ),
      }),
    setGraphDataTableFrozenDragStepLabelIdPx: (v: number) =>
      set({
        graphDataTableFrozenDragStepLabelIdPx: lsSetNum(
          LS_KEYS.graphDataTableFrozenDragStepLabelIdPx,
          Math.max(8, Math.floor(v)),
        ),
      }),
    setGraphDataTableVirtualOverscanRows: (v: number) =>
      set({
        graphDataTableVirtualOverscanRows: lsSetInt(
          LS_KEYS.graphDataTableVirtualOverscanRows,
          Math.max(0, Math.floor(v)),
          { min: 0, max: 200 },
        ),
      }),
    setGraphDataTableOverscanMultiplier: (v: number) =>
      set({
        graphDataTableOverscanMultiplier: lsSetNum(
          LS_KEYS.graphDataTableOverscanMultiplier,
          Math.max(0.1, Math.min(2, v)),
        ),
      }),
    setGraphDataTableVirtualMinRows: (v: number) =>
      set({
        graphDataTableVirtualMinRows: lsSetInt(
          LS_KEYS.graphDataTableVirtualMinRows,
          Math.max(0, Math.floor(v)),
          { min: 0, max: 1000000 },
        ),
      }),
    setGraphDataTableVirtualDebugLogRanges: (v: boolean) =>
      set({
        graphDataTableVirtualDebugLogRanges: lsSetBool(
          LS_KEYS.graphDataTableVirtualDebugLogRanges,
          v,
        ),
      }),
  };
};
