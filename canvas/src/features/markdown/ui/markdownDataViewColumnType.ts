import type { MarkdownDataViewColumnKind } from './markdownDataViewModel'

export type MarkdownDataViewColumnType =
  | 'checkbox'
  | 'date'
  | 'multi-select'
  | 'number'
  | 'progress'
  | 'select'
  | 'link'
  | 'geodata'
  | 'text'
  | 'created-time'
  | 'attachment'
  | 'member'
  | 'created-by'

export type MarkdownDataViewColumnTypeOption = {
  key: MarkdownDataViewColumnType
  label: string
}

export const MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS: readonly MarkdownDataViewColumnTypeOption[] = [
  { key: 'checkbox', label: 'Checkbox' },
  { key: 'date', label: 'Date' },
  { key: 'multi-select', label: 'Multi-select' },
  { key: 'number', label: 'Number' },
  { key: 'progress', label: 'Progress' },
  { key: 'select', label: 'Select' },
  { key: 'link', label: 'Link' },
  { key: 'geodata', label: 'Geodata' },
  { key: 'text', label: 'Text' },
  { key: 'created-time', label: 'Created Time' },
  { key: 'attachment', label: 'Attachment' },
  { key: 'member', label: 'Member' },
  { key: 'created-by', label: 'Created By' },
]

export function labelForMarkdownDataViewColumnType(type: MarkdownDataViewColumnType): string {
  for (const o of MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS) {
    if (o.key === type) return o.label
  }
  return 'Text'
}

export function coerceMarkdownDataViewColumnType(raw: unknown): MarkdownDataViewColumnType | null {
  const v = String(raw || '').trim()
  for (const o of MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS) {
    if (o.key === v) return o.key
  }
  return null
}

export function defaultColumnTypeForInferredKind(kind: MarkdownDataViewColumnKind): MarkdownDataViewColumnType {
  if (kind === 'multi-select') return 'multi-select'
  if (kind === 'select') return 'select'
  return 'text'
}

export function columnTypeToBaseKind(type: MarkdownDataViewColumnType): MarkdownDataViewColumnKind {
  if (type === 'multi-select') return 'multi-select'
  if (type === 'select' || type === 'checkbox') return 'select'
  return 'text'
}

export function isColumnTypeEditable(type: MarkdownDataViewColumnType): boolean {
  return type === 'checkbox' || type === 'date' || type === 'multi-select' || type === 'number' || type === 'progress' || type === 'select' || type === 'link' || type === 'geodata' || type === 'text'
}
