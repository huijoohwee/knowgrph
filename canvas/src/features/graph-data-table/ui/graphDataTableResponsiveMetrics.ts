import type { CSSProperties } from 'react'

export const GRAPH_DATA_TABLE_SELECT_COLUMN_WIDTH_PX = 44

export const GRAPH_DATA_TABLE_ORDER_COLUMN_WIDTH_PX = 72

export const GRAPH_DATA_TABLE_DATA_COLUMN_MIN_WIDTH_PX = 80

export const GRAPH_DATA_TABLE_DATA_COLUMN_DEFAULT_WIDTH_PX = 180

export const GRAPH_DATA_TABLE_DATA_COLUMN_MAX_WIDTH_PX = 720

export const GRAPH_DATA_TABLE_GRID_SPACER_SIZE_PX = 1

export const GRAPH_DATA_TABLE_GRID_SPACER_STYLE: CSSProperties = {
  width: GRAPH_DATA_TABLE_GRID_SPACER_SIZE_PX,
  height: GRAPH_DATA_TABLE_GRID_SPACER_SIZE_PX,
}

export const GRAPH_DATA_TABLE_DATE_PICKER_STYLE: CSSProperties = {
  width: 'min(var(--kg-graph-data-table-date-picker-width, 16.25rem), calc(100vw - var(--kg-safe-left) - var(--kg-safe-right) - 1rem))',
  maxWidth: 'calc(100vw - var(--kg-safe-left) - var(--kg-safe-right) - 1rem)',
}
