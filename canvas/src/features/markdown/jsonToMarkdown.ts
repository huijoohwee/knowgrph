export type JsonLike = unknown

export type JsonToMarkdownMode = 'table' | 'key-value' | 'hierarchical' | 'auto'

export type JsonToMarkdownConfig = {
  defaultMode?: JsonToMarkdownMode
  tableMaxRows?: number
  tableMaxColumns?: number
  indent?: string
  bullet?: string
  sortKeys?: boolean
}

import { JSON_TO_MARKDOWN_COPY } from './markdownCopy'
import { serializeMarkdownPipeTable } from './ui/markdownDataViewSerialize'

type ResolvedConfig = {
  defaultMode: JsonToMarkdownMode
  tableMaxRows: number
  tableMaxColumns: number
  indent: string
  bullet: string
  sortKeys: boolean
}

export const JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_ROWS = 200
export const JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_COLUMNS = 40

const defaultConfig: ResolvedConfig = {
  defaultMode: 'auto',
  tableMaxRows: JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_ROWS,
  tableMaxColumns: JSON_TO_MARKDOWN_DEFAULT_TABLE_MAX_COLUMNS,
  indent: '  ',
  bullet: '-',
  sortKeys: true,
}

function isScalar(value: JsonLike): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function looksLikeObjectArray(items: JsonLike[]): boolean {
  if (!items.length) return false
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  }
  return true
}

function rowHasNestedValues(row: Record<string, JsonLike>): boolean {
  for (const value of Object.values(row)) {
    if (!value) continue
    if (typeof value === 'object') return true
  }
  return false
}

function hasNestedStructures(value: JsonLike): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) {
    for (const v of value) {
      if (v && typeof v === 'object') return true
    }
    return false
  }
  const obj = value as Record<string, JsonLike>
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') return true
  }
  return false
}

function formatScalar(value: JsonLike): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return String(value)
}

function resolveConfig(config?: JsonToMarkdownConfig): ResolvedConfig {
  if (!config) return defaultConfig
  return {
    defaultMode: config.defaultMode || defaultConfig.defaultMode,
    tableMaxRows:
      typeof config.tableMaxRows === 'number' && config.tableMaxRows > 0
        ? config.tableMaxRows
        : defaultConfig.tableMaxRows,
    tableMaxColumns:
      typeof config.tableMaxColumns === 'number' && config.tableMaxColumns > 0
        ? config.tableMaxColumns
        : defaultConfig.tableMaxColumns,
    indent: typeof config.indent === 'string' ? config.indent : defaultConfig.indent,
    bullet: typeof config.bullet === 'string' ? config.bullet : defaultConfig.bullet,
    sortKeys:
      typeof config.sortKeys === 'boolean' ? config.sortKeys : defaultConfig.sortKeys,
  }
}

function detectMode(value: JsonLike, config: ResolvedConfig): Exclude<JsonToMarkdownMode, 'auto'> {
  if (config.defaultMode === 'table' || config.defaultMode === 'key-value' || config.defaultMode === 'hierarchical') {
    return config.defaultMode
  }
  if (Array.isArray(value)) {
    if (!value.length) return 'hierarchical'
    if (looksLikeObjectArray(value)) return 'table'
    return 'hierarchical'
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, JsonLike>
    const values = Object.values(obj)
    for (const entry of values) {
      if (!Array.isArray(entry)) continue
      if (looksLikeObjectArray(entry)) return 'table'
    }
    if (hasNestedStructures(value)) return 'hierarchical'
    return 'key-value'
  }
  return 'key-value'
}

function collectTableHeaderKeys(rows: Record<string, JsonLike>[], maxColumns: number): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  const limit = maxColumns > 0 ? maxColumns : Number.POSITIVE_INFINITY
  for (const row of rows) {
    const rowKeys = Object.keys(row)
    for (const key of rowKeys) {
      if (seen.has(key)) continue
      seen.add(key)
      keys.push(key)
      if (keys.length >= limit) return keys
    }
  }
  return keys
}

function renderTable(rows: Record<string, JsonLike>[], config: ResolvedConfig): string[] {
  if (!rows.length) return [JSON_TO_MARKDOWN_COPY.emptyArrayLabel]
  const headerKeys = collectTableHeaderKeys(rows, config.tableMaxColumns)
  const headerCells = headerKeys.map(k => String(k) || 'key')
  const maxRows = config.tableMaxRows > 0 ? config.tableMaxRows : rows.length
  const visibleRows = rows.slice(0, maxRows)
  const bodyRows = visibleRows.map(row =>
    headerKeys.map(key => {
      const value = row[key]
      if (isScalar(value)) {
        return formatScalar(value)
      }
      try {
        const json = JSON.stringify(value)
        return json || ''
      } catch {
        return formatScalar(value)
      }
    }))
  const lines = serializeMarkdownPipeTable({ columns: headerCells, rows: bodyRows })
  if (rows.length > maxRows) {
    const remaining = rows.length - maxRows
    lines.push('')
    lines.push(JSON_TO_MARKDOWN_COPY.moreRowsLabel(remaining))
  }
  return lines
}

function renderTopLevelObjectTables(value: Record<string, JsonLike>, config: ResolvedConfig): string[] | null {
  let keys = Object.keys(value)
  if (config.sortKeys) {
    try {
      keys = keys.slice().sort()
    } catch {
      keys = keys.slice()
    }
  }
  const lines: string[] = []
  for (const key of keys) {
    const current = value[key]
    if (!Array.isArray(current)) continue
    if (!looksLikeObjectArray(current)) continue
    const rows = current as Record<string, JsonLike>[]
    if (rows.length < 1) continue
    if (lines.length > 0) lines.push('')
    lines.push(`## ${key}`)
    lines.push('')
    lines.push(...renderTable(rows, config))
  }
  return lines.length > 0 ? lines : null
}

function renderKeyValue(
  obj: Record<string, JsonLike>,
  config: ResolvedConfig,
  level: number,
): string[] {
  let keys = Object.keys(obj)
  if (config.sortKeys) {
    try {
      keys = keys.slice().sort()
    } catch {
      keys = keys.slice()
    }
  }
  const lines: string[] = []
  const indent = config.indent.repeat(level)
  for (const key of keys) {
    const value = obj[key]
    const label = `**${key}**`
    const prefix = `${indent}${config.bullet} `
    if (isScalar(value) || !hasNestedStructures(value)) {
      const rendered = formatScalar(value)
      lines.push(`${prefix}${label}: ${rendered}`)
    } else {
      lines.push(`${prefix}${label}:`)
      lines.push(...renderHierarchical(value, config, level + 1))
    }
  }
  return lines
}

function renderHierarchical(
  value: JsonLike,
  config: ResolvedConfig,
  level: number,
): string[] {
  const lines: string[] = []
  const indent = config.indent.repeat(level)
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      const items = value as JsonLike[]
      if (!items.length) {
        lines.push(`${indent}${config.bullet} ${JSON_TO_MARKDOWN_COPY.emptyListLabel}`)
        return lines
      }
      for (let idx = 0; idx < items.length; idx += 1) {
        const item = items[idx]
        const prefix = `${indent}${config.bullet} `
        if (isScalar(item)) {
          const rendered = formatScalar(item)
          lines.push(`${prefix}${rendered}`)
        } else if (item && typeof item === 'object') {
          const label = JSON_TO_MARKDOWN_COPY.itemLabel(idx + 1)
          lines.push(`${prefix}${label}:`)
          lines.push(...renderHierarchical(item, config, level + 1))
        } else {
          const rendered = formatScalar(item)
          lines.push(`${prefix}${rendered}`)
        }
      }
      return lines
    }
    const obj = value as Record<string, JsonLike>
    let keys = Object.keys(obj)
    if (config.sortKeys) {
      try {
        keys = keys.slice().sort()
      } catch {
        keys = keys.slice()
      }
    }
    for (const key of keys) {
      const v = obj[key]
      const label = `**${key}**`
      const prefix = `${indent}${config.bullet} `
      if (isScalar(v)) {
        const rendered = formatScalar(v)
        lines.push(`${prefix}${label}: ${rendered}`)
      } else if (v && typeof v === 'object') {
        lines.push(`${prefix}${label}:`)
        lines.push(...renderHierarchical(v, config, level + 1))
      } else {
        const rendered = formatScalar(v)
        lines.push(`${prefix}${label}: ${rendered}`)
      }
    }
    return lines
  }
  const rendered = formatScalar(value)
  lines.push(`${indent}${rendered}`)
  return lines
}

export function jsonToMarkdown(
  value: JsonLike,
  config?: JsonToMarkdownConfig,
  mode?: JsonToMarkdownMode,
): string {
  const resolved = resolveConfig(config)
  const effectiveMode =
    mode && mode !== 'auto'
      ? mode
      : detectMode(value, resolved)
  if (effectiveMode === 'table') {
    if (Array.isArray(value) && looksLikeObjectArray(value)) {
      const rows = value as Record<string, JsonLike>[]
      const lines = renderTable(rows, resolved)
      return lines.join('\n')
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const objectTables = renderTopLevelObjectTables(value as Record<string, JsonLike>, resolved)
      if (objectTables) return objectTables.join('\n')
    }
    const lines = renderHierarchical(value, resolved, 0)
    return lines.join('\n')
  }
  if (effectiveMode === 'key-value') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, JsonLike>
      const lines = renderKeyValue(obj, resolved, 0)
      return lines.join('\n')
    }
    const lines = renderHierarchical(value, resolved, 0)
    return lines.join('\n')
  }
  const lines = renderHierarchical(value, resolved, 0)
  return lines.join('\n')
}

function hasMarkdownTable(text: string): boolean {
  const lines = String(text || '').split('\n')
  for (let i = 1; i < lines.length; i += 1) {
    const prev = String(lines[i - 1] || '').trim()
    const curr = String(lines[i] || '').trim()
    if (!prev.startsWith('|') || !prev.endsWith('|')) continue
    if (!curr.startsWith('|') || !curr.endsWith('|')) continue
    const segments = curr.slice(1, -1).split('|').map(part => part.trim())
    if (segments.length < 1) continue
    if (segments.every(part => /^:?-{3,}:?$/.test(part))) return true
  }
  return false
}

export function jsonToMarkdownPreferTable(
  value: JsonLike,
  config?: JsonToMarkdownConfig,
  fallbackMode?: JsonToMarkdownMode,
): string {
  const preferredConfig = { ...(config || {}), defaultMode: 'table' as JsonToMarkdownMode }
  const tableFirst = jsonToMarkdown(value, preferredConfig, 'table')
  if (hasMarkdownTable(tableFirst)) return tableFirst
  return jsonToMarkdown(value, config, fallbackMode)
}
