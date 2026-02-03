export type SpreadsheetBaseId = string
export type SpreadsheetTableId = string
export type SpreadsheetColumnId = string
export type SpreadsheetRowId = string
export type SpreadsheetViewId = string

export type SpreadsheetColumnKind = 'text' | 'number' | 'boolean' | 'date' | 'json' | 'link'

export type SpreadsheetLinkSpec = {
  targetTableId: SpreadsheetTableId
  cardinality: 'one' | 'many'
}

export type SpreadsheetColumn = {
  id: SpreadsheetColumnId
  tableId: SpreadsheetTableId
  name: string
  kind: SpreadsheetColumnKind
  order: number
  createdAtMs: number
  updatedAtMs: number
  linkSpec?: SpreadsheetLinkSpec
}

export type SpreadsheetRowData = Record<SpreadsheetColumnId, unknown>

export type SpreadsheetRow = {
  id: SpreadsheetRowId
  tableId: SpreadsheetTableId
  order: number
  data: SpreadsheetRowData
  createdAtMs: number
  updatedAtMs: number
}

export type SpreadsheetTable = {
  id: SpreadsheetTableId
  baseId: SpreadsheetBaseId
  name: string
  order: number
  createdAtMs: number
  updatedAtMs: number
}

export type SpreadsheetBase = {
  id: SpreadsheetBaseId
  name: string
  createdAtMs: number
  updatedAtMs: number
}

export type SpreadsheetSortRule = {
  columnId: SpreadsheetColumnId
  dir: 'asc' | 'desc'
}

export type SpreadsheetView = {
  id: SpreadsheetViewId
  tableId: SpreadsheetTableId
  name: string
  columnOrder?: SpreadsheetColumnId[]
  hiddenColumnIds?: SpreadsheetColumnId[]
  sort?: SpreadsheetSortRule[]
  createdAtMs: number
  updatedAtMs: number
}

export function isSpreadsheetColumnKind(v: unknown): v is SpreadsheetColumnKind {
  return v === 'text' || v === 'number' || v === 'boolean' || v === 'date' || v === 'json' || v === 'link'
}

