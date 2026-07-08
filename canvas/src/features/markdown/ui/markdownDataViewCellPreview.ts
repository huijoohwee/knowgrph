import { coerceDataViewFieldLineMode, type DataViewFieldLineMode } from '@/lib/ui/dataViewDensity'

export const MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT = 96

export function readMarkdownDataViewTableCellPreviewText(raw: string): string {
  const value = String(raw || '')
  if (value.length <= MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT) return value
  return `${value.slice(0, MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT).trimEnd()}...`
}

export function readMarkdownDataViewTableCellDisplayText(raw: string, fieldLineMode: DataViewFieldLineMode | null | undefined): string {
  const value = String(raw || '')
  return coerceDataViewFieldLineMode(fieldLineMode) === 'flex'
    ? value
    : readMarkdownDataViewTableCellPreviewText(value)
}
