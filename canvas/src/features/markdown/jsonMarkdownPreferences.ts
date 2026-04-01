import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import {
  JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_COLUMNS,
  JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_ROWS,
  type JsonToMarkdownConfig,
  type JsonToMarkdownMode,
} from '@/features/markdown/jsonToMarkdown'

export const JSON_MARKDOWN_MODE_SELECT_OPTIONS: JsonToMarkdownMode[] = ['auto', 'table', 'key-value', 'hierarchical']
const JSON_MARKDOWN_MODE_OPTIONS = new Set<JsonToMarkdownMode>(JSON_MARKDOWN_MODE_SELECT_OPTIONS)
export const JSON_MARKDOWN_MODE_LABELS: Record<JsonToMarkdownMode, string> = {
  auto: 'Auto',
  table: 'Table',
  'key-value': 'Key-value',
  hierarchical: 'Hierarchical',
}
export const JSON_MARKDOWN_TABLE_LIMIT_MIN = 1
export const JSON_MARKDOWN_TABLE_LIMIT_MAX = 5000

export type JsonMarkdownPreferences = {
  mode: JsonToMarkdownMode
  tableMaxRows: number
  tableMaxColumns: number
}

const parseJsonMarkdownMode = (value: unknown): JsonToMarkdownMode => {
  if (typeof value !== 'string') return 'auto'
  const normalized = value.trim() as JsonToMarkdownMode
  if (JSON_MARKDOWN_MODE_OPTIONS.has(normalized)) return normalized
  return 'auto'
}

const parseJsonMarkdownTableLimit = (value: unknown, fallback: number): number => {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  const rounded = Math.floor(num)
  if (rounded < JSON_MARKDOWN_TABLE_LIMIT_MIN) return fallback
  if (rounded > JSON_MARKDOWN_TABLE_LIMIT_MAX) return JSON_MARKDOWN_TABLE_LIMIT_MAX
  return rounded
}

export const readJsonMarkdownMode = (): JsonToMarkdownMode =>
  lsJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, 'auto', parseJsonMarkdownMode)

export const writeJsonMarkdownMode = (mode: JsonToMarkdownMode): JsonToMarkdownMode =>
  lsSetJson<JsonToMarkdownMode>(LS_KEYS.jsonMarkdownMode, parseJsonMarkdownMode(mode))

export const readJsonMarkdownTableMaxRows = (): number =>
  lsJson<number>(
    LS_KEYS.jsonMarkdownTableMaxRows,
    JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_ROWS,
    value => parseJsonMarkdownTableLimit(value, JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_ROWS),
  )

export const writeJsonMarkdownTableMaxRows = (value: unknown): number =>
  lsSetJson<number>(
    LS_KEYS.jsonMarkdownTableMaxRows,
    parseJsonMarkdownTableLimit(value, JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_ROWS),
  )

export const readJsonMarkdownTableMaxColumns = (): number =>
  lsJson<number>(
    LS_KEYS.jsonMarkdownTableMaxColumns,
    JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_COLUMNS,
    value => parseJsonMarkdownTableLimit(value, JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_COLUMNS),
  )

export const writeJsonMarkdownTableMaxColumns = (value: unknown): number =>
  lsSetJson<number>(
    LS_KEYS.jsonMarkdownTableMaxColumns,
    parseJsonMarkdownTableLimit(value, JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_COLUMNS),
  )

export const readJsonMarkdownPreferences = (): JsonMarkdownPreferences => ({
  mode: readJsonMarkdownMode(),
  tableMaxRows: readJsonMarkdownTableMaxRows(),
  tableMaxColumns: readJsonMarkdownTableMaxColumns(),
})

export const buildJsonMarkdownConfigFromPreferences = (): JsonToMarkdownConfig => {
  const prefs = readJsonMarkdownPreferences()
  return {
    defaultMode: prefs.mode,
    tableMaxRows: prefs.tableMaxRows,
    tableMaxColumns: prefs.tableMaxColumns,
  }
}
