import { lsJson } from '@/lib/persistence'
import { LS_KEYS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseGraphDataTableAggregateVizMode } from '@/features/graph-data-table/graphDataTable'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

const readLsJsonString = (key: (typeof LS_KEYS)[keyof typeof LS_KEYS]): string | null => {
  const value = lsJson<unknown | null>(key, null, raw => raw as unknown)
  if (value === null) return null
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const uiGraphDataTableSettingsRegistry: SettingMeta[] = [
  {
    key: 'graphFields.settingsById',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphFieldSettingsById),
    docKey: 'graphFields.settingsById',
    default: () => null,
  },
  {
    key: 'graphDataTable.visibleColumns',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableVisibleColumns),
    docKey: 'graphDataTable.visibleColumns',
    default: () => null,
  },
  {
    key: 'graphDataTable.columnOrder',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableColumnOrder),
    docKey: 'graphDataTable.columnOrder',
    default: () => null,
  },
  {
    key: 'graphDataTable.columnWidths',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableColumnWidths),
    docKey: 'graphDataTable.columnWidths',
    default: () => null,
  },
  {
    key: 'graphDataTable.aggregateKeys',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableAggregateKeys),
    docKey: 'graphDataTable.aggregateKeys',
    default: () => null,
  },
  {
    key: 'graphDataTable.filterState',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableFilterState),
    docKey: 'graphDataTable.filterState',
    default: () => null,
  },
  {
    key: 'graphDataTable.sortRules',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableSortRules),
    docKey: 'graphDataTable.sortRules',
    default: () => null,
  },
  {
    key: 'graphDataTable.groupKey',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableGroupKey),
    docKey: 'graphDataTable.groupKey',
    default: () => null,
  },
  {
    key: 'graphDataTable.autoSortEnabled',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableAutoSortEnabled),
    docKey: 'graphDataTable.autoSortEnabled',
    default: () => null,
  },
  {
    key: 'graphDataTable.rowDensity',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableRowDensity),
    docKey: 'graphDataTable.rowDensity',
    default: () => null,
  },
  {
    key: 'graphDataTable.disableAutoScroll',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableDisableAutoScroll),
    docKey: 'graphDataTable.disableAutoScroll',
    default: () => null,
  },
  {
    key: 'graphDataTable.freezeFirstDataColumn',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableFreezeFirstDataColumn),
    docKey: 'graphDataTable.freezeFirstDataColumn',
    default: () => null,
  },
  {
    key: 'graphDataTable.freezeFirstDataColumnByScope',
    type: 'string',
    source: 'localStorage',
    read: () => readLsJsonString(LS_KEYS.graphDataTableFreezeFirstDataColumnByScope),
    docKey: 'graphDataTable.freezeFirstDataColumnByScope',
    default: () => null,
  },
  {
    key: 'graphDataTable.virtualOverscanRows',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableVirtualOverscanRows,
    write: (v) => s().setGraphDataTableVirtualOverscanRows(Number(v)),
    docKey: 'graphDataTableVirtualOverscanRows',
    default: () => 12,
  },
  {
    key: 'graphDataTable.overscanMultiplier',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableOverscanMultiplier,
    write: (v) => s().setGraphDataTableOverscanMultiplier(Number(v)),
    docKey: 'graphDataTableOverscanMultiplier',
    default: () => 0.5,
  },
  {
    key: 'graphDataTable.minRows',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableVirtualMinRows,
    write: (v) => s().setGraphDataTableVirtualMinRows(Number(v)),
    docKey: 'graphDataTableVirtualMinRows',
    default: () => 200,
  },
  {
    key: 'graphDataTable.debugLogRanges',
    type: 'boolean',
    source: 'store',
    read: () => s().graphDataTableVirtualDebugLogRanges,
    write: (v) => s().setGraphDataTableVirtualDebugLogRanges(Boolean(v)),
    docKey: 'graphDataTableVirtualDebugLogRanges',
    default: () => false,
  },
  {
    key: 'graphDataTable.aggregateIncludeMixedNumericFields',
    type: 'boolean',
    source: 'store',
    read: () => s().graphDataTableAggregateIncludeMixedNumericFields,
    write: (v) => s().setGraphDataTableAggregateIncludeMixedNumericFields(Boolean(v)),
    docKey: 'graphDataTableAggregateIncludeMixedNumericFields',
    default: () => false,
  },
  {
    key: 'graphDataTable.aggregateIncludeIdAsNumeric',
    type: 'boolean',
    source: 'store',
    read: () => s().graphDataTableAggregateIncludeIdAsNumeric,
    write: (v) => s().setGraphDataTableAggregateIncludeIdAsNumeric(Boolean(v)),
    docKey: 'graphDataTableAggregateIncludeIdAsNumeric',
    default: () => false,
  },
  {
    key: 'graphDataTable.aggregateIncludeSourceAsNumeric',
    type: 'boolean',
    source: 'store',
    read: () => s().graphDataTableAggregateIncludeSourceAsNumeric,
    write: (v) => s().setGraphDataTableAggregateIncludeSourceAsNumeric(Boolean(v)),
    docKey: 'graphDataTableAggregateIncludeSourceAsNumeric',
    default: () => false,
  },
  {
    key: 'graphDataTable.aggregateIncludeTargetAsNumeric',
    type: 'boolean',
    source: 'store',
    read: () => s().graphDataTableAggregateIncludeTargetAsNumeric,
    write: (v) => s().setGraphDataTableAggregateIncludeTargetAsNumeric(Boolean(v)),
    docKey: 'graphDataTableAggregateIncludeTargetAsNumeric',
    default: () => false,
  },
  {
    key: 'graphDataTable.aggregateDefaultVizMode',
    type: 'string',
    source: 'store',
    read: () => s().graphDataTableAggregateDefaultVizMode,
    write: (v) => {
      const parsed = parseGraphDataTableAggregateVizMode(v)
      s().setGraphDataTableAggregateDefaultVizMode(parsed ?? 'radial')
    },
    docKey: 'graphDataTableAggregateDefaultVizMode',
    default: () => 'radial',
  },
  {
    key: 'graphDataTable.numericSampleLimit',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableNumericSampleLimit,
    write: (v) => s().setGraphDataTableNumericSampleLimit(Number(v)),
    docKey: 'graphDataTableNumericSampleLimit',
    default: () => 200,
  },
  {
    key: 'graphDataTable.numericSampleMinCount',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableNumericSampleMinCount,
    write: (v) => s().setGraphDataTableNumericSampleMinCount(Number(v)),
    docKey: 'graphDataTableNumericSampleMinCount',
    default: () => 3,
  },
  {
    key: 'graphDataTable.numericSampleMinRatio',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableNumericSampleMinRatio,
    write: (v) => s().setGraphDataTableNumericSampleMinRatio(Number(v)),
    docKey: 'graphDataTableNumericSampleMinRatio',
    default: () => 0.6,
  },
  {
    key: 'graphDataTable.frozenDragStepNoneLabelPx',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableFrozenDragStepNoneLabelPx,
    write: (v) => s().setGraphDataTableFrozenDragStepNoneLabelPx(Number(v)),
    docKey: 'graphDataTableFrozenDragStepNoneLabelPx',
    default: () => 64,
  },
  {
    key: 'graphDataTable.frozenDragStepLabelIdPx',
    type: 'number',
    source: 'store',
    read: () => s().graphDataTableFrozenDragStepLabelIdPx,
    write: (v) => s().setGraphDataTableFrozenDragStepLabelIdPx(Number(v)),
    docKey: 'graphDataTableFrozenDragStepLabelIdPx',
    default: () => 96,
  },
]
