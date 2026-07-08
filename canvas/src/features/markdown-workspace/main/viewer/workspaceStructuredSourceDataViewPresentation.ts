import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'
import { coerceDataViewFieldLineMode, type DataViewFieldLineMode } from '@/lib/ui/dataViewDensity'
import {
  coerceStructuredSourceValueColumnMode,
  type WorkspaceDataViewConfig,
  type WorkspaceStructuredSourceValueColumnMode,
} from './workspaceDataViewConfig'

const FRONTMATTER_PRIMARY_COLUMNS = [
  'Key',
  'Type',
  'Summary',
  'Output',
  'Action',
  'Reference Pack',
  'Content',
  'Line',
] as const

const BODY_PRIMARY_COLUMNS = [
  'Content',
  'Line',
  'Indent',
] as const

const metadataColumnNames = new Set<string>(FRONTMATTER_PRIMARY_COLUMNS)
const bodyColumnNames = new Set<string>(BODY_PRIMARY_COLUMNS)

const isStructuredSourceTypeValueColumn = (name: string): boolean => {
  const normalized = String(name || '').trim()
  return normalized !== 'Value' && normalized !== 'Source Value' && /^.+ Value$/.test(normalized)
}

const readColumnNameSet = (columns: readonly { name: string }[]): Set<string> => (
  new Set(columns.map(column => String(column.name || '').trim()).filter(Boolean))
)

export function readStructuredSourceTypeValueColumnNames(columns: readonly { name: string }[]): string[] {
  return columns.map(column => String(column.name || '').trim()).filter(isStructuredSourceTypeValueColumn)
}

export function hasStructuredSourceValueColumnMode(columns: readonly { name: string }[]): boolean {
  const names = readColumnNameSet(columns)
  return names.has('Value')
    && FRONTMATTER_PRIMARY_COLUMNS.every(name => names.has(name))
    && readStructuredSourceTypeValueColumnNames(columns).length > 0
}

const readColumnIdsByName = (view: MarkdownDataView): Map<string, string> => {
  const byName = new Map<string, string>()
  for (const column of view.columns) {
    const name = String(column.name || '').trim()
    if (!name || byName.has(name)) continue
    byName.set(name, column.id)
  }
  return byName
}

export function readStructuredSourceDefaultVisibleColumnIds(
  view: MarkdownDataView,
  valueColumnMode: WorkspaceStructuredSourceValueColumnMode = 'type-specific',
): string[] | null {
  const byName = readColumnIdsByName(view)
  const hasFrontmatterShape = FRONTMATTER_PRIMARY_COLUMNS.every(name => byName.has(name))
  const hasBodyShape = BODY_PRIMARY_COLUMNS.every(name => byName.has(name))
  const normalizedValueColumnMode = coerceStructuredSourceValueColumnMode(valueColumnMode)
  const typeValueColumnNames = readStructuredSourceTypeValueColumnNames(view.columns)
  const names = hasFrontmatterShape
    ? ['Key', 'Type', ...(normalizedValueColumnMode === 'type-specific' && typeValueColumnNames.length ? typeValueColumnNames : ['Value']), 'Summary', 'Output', 'Action', 'Reference Pack', 'Content', 'Line']
    : hasBodyShape
      ? BODY_PRIMARY_COLUMNS
      : []
  if (names.length < 1) return null
  const ids = names.map(name => byName.get(name)).filter((id): id is string => !!id)
  return ids.length > 0 ? ids : null
}

export function isStructuredSourcePrimaryColumn(name: string): boolean {
  const normalizedName = String(name || '').trim()
  return metadataColumnNames.has(normalizedName) || normalizedName === 'Value' || isStructuredSourceTypeValueColumn(normalizedName) || bodyColumnNames.has(normalizedName)
}

export function readStructuredSourceDataViewPresentation(view: MarkdownDataView, viewConfig: WorkspaceDataViewConfig | null | undefined) {
  const valueColumnMode = coerceStructuredSourceValueColumnMode(viewConfig?.structuredSourceValueColumnMode)
  return {
    visibleColumnIds: readStructuredSourceDefaultVisibleColumnIds(view, valueColumnMode),
    rowHeightPreset: viewConfig?.rowHeightPreset === 'compact' ? 'compact' as const : 'comfortable' as const,
    fieldLineMode: coerceDataViewFieldLineMode(viewConfig?.fieldLineMode),
  }
}

export function readStructuredSourceRowHeightPreset(raw: WorkspaceDataViewConfig['rowHeightPreset']): 'compact' | 'comfortable' {
  return raw === 'compact' ? 'compact' : 'comfortable'
}

export function readStructuredSourceFieldLineMode(raw: WorkspaceDataViewConfig['fieldLineMode']): DataViewFieldLineMode {
  return coerceDataViewFieldLineMode(raw)
}
