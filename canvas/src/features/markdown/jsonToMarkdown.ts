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

type ResolvedConfig = {
  defaultMode: JsonToMarkdownMode
  tableMaxRows: number
  tableMaxColumns: number
  indent: string
  bullet: string
  sortKeys: boolean
}

const defaultConfig: ResolvedConfig = {
  defaultMode: 'auto',
  tableMaxRows: 200,
  tableMaxColumns: 40,
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

function looksLikeUniformObjectArray(items: JsonLike[]): boolean {
  if (!items.length) return false
  const first = items[0]
  if (!first || typeof first !== 'object' || Array.isArray(first)) return false
  const baseKeys = Object.keys(first as Record<string, JsonLike>)
  if (!baseKeys.length) return false
  const baseSet = new Set(baseKeys)
  for (let i = 1; i < items.length; i += 1) {
    const item = items[i]
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const keys = Object.keys(item as Record<string, JsonLike>)
    if (keys.length !== baseSet.size) return false
    for (const k of keys) {
      if (!baseSet.has(k)) return false
    }
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

function escapeTableCell(value: string): string {
  const withoutNewlines = value.replace(/\r?\n/g, ' ')
  const escaped = withoutNewlines.replace(/\|/g, '\\|')
  return escaped.trim()
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
    if (looksLikeUniformObjectArray(value)) {
      const first = value[0] as Record<string, JsonLike>
      if (!rowHasNestedValues(first)) return 'table'
    }
    return 'hierarchical'
  }
  if (value && typeof value === 'object') {
    if (hasNestedStructures(value)) return 'hierarchical'
    return 'key-value'
  }
  return 'key-value'
}

function renderTable(rows: Record<string, JsonLike>[], config: ResolvedConfig): string[] {
  if (!rows.length) return [JSON_TO_MARKDOWN_COPY.emptyArrayLabel]
  let headerKeys = Object.keys(rows[0])
  if (config.tableMaxColumns > 0 && headerKeys.length > config.tableMaxColumns) {
    headerKeys = headerKeys.slice(0, config.tableMaxColumns)
  }
  const headerCells = headerKeys.map(k => escapeTableCell(String(k) || 'key'))
  const lines: string[] = []
  lines.push(`| ${headerCells.join(' | ')} |`)
  lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`)
  const maxRows = config.tableMaxRows > 0 ? config.tableMaxRows : rows.length
  const visibleRows = rows.slice(0, maxRows)
  for (const row of visibleRows) {
    const cells = headerKeys.map(key => {
      const value = row[key]
      if (isScalar(value)) {
        return escapeTableCell(formatScalar(value))
      }
      try {
        const json = JSON.stringify(value)
        return escapeTableCell(json || '')
      } catch {
        return escapeTableCell(formatScalar(value))
      }
    })
    lines.push(`| ${cells.join(' | ')} |`)
  }
  if (rows.length > maxRows) {
    const remaining = rows.length - maxRows
    lines.push('')
    lines.push(JSON_TO_MARKDOWN_COPY.moreRowsLabel(remaining))
  }
  return lines
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
    if (Array.isArray(value) && looksLikeUniformObjectArray(value)) {
      const first = value[0] as Record<string, JsonLike>
      if (!rowHasNestedValues(first)) {
        const rows = value as Record<string, JsonLike>[]
        const lines = renderTable(rows, resolved)
        return lines.join('\n')
      }
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
