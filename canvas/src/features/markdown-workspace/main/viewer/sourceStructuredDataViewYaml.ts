import { buildMarkdownDataViewFromTableToken } from '@/features/markdown/ui/markdownDataViewModel'
import { serializeMarkdownDataViewToTableLines } from '@/features/markdown/ui/markdownDataViewSerialize'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'

const PIPE_TABLE_LINE_RE = /^\s*\|.*\|\s*$/
const PIPE_TABLE_SEPARATOR_RE = /^\s*\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/
const YAML_METADATA_TRAILING_COLUMNS = ['Key', 'Type', 'Value', 'Level', 'Content', 'Line', 'Indent'] as const

export type YamlMetadataTableProjection = {
  lines: string[]
  sourceLineByRowIndex: number[]
}

const splitSourceLines = (text: string): string[] => String(text || '').replace(/\r\n/g, '\n').split('\n')

const readLineIndent = (line: string): number => {
  const match = String(line || '').match(/^ */)
  return match ? match[0].length : 0
}

const stripLineIndent = (line: string): string => String(line || '').replace(/^ +/, '')

const joinPath = (parts: readonly string[]): string => parts.filter(Boolean).join('.')

const parseIndentCell = (value: string): number => {
  const numeric = Number.parseInt(String(value || '').trim(), 10)
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return Math.min(240, numeric)
}

export const yamlQuote = (value: string): string => `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

export const readYamlScalarText = (value: string): string => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const inner = trimmed.slice(1, -1)
    return trimmed.startsWith('"')
      ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : inner.replace(/''/g, "'")
  }
  return trimmed
}

export const readYamlKeyValue = (line: string): { key: string; value: string; indent: number } | null => {
  const raw = String(line || '')
  const match = raw.match(/^(\s*)(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.:-]*))\s*:\s*(.*)$/)
  if (!match) return null
  return {
    indent: match[1]?.length || 0,
    key: match[2] || match[3] || '',
    value: readYamlScalarText(match[4] || ''),
  }
}

const readYamlListValue = (line: string): { value: string; indent: number } | null => {
  const match = String(line || '').match(/^(\s*)-\s+(.*)$/)
  if (!match) return null
  return { indent: match[1]?.length || 0, value: readYamlScalarText(match[2] || '') }
}

const readYamlSourceKey = (line: string): string => {
  const trimmed = stripLineIndent(line).trim()
  const match = trimmed.match(/^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.:-]*))\s*:/)
  return match ? (match[1] || match[2] || '') : ''
}

const splitSemanticValue = (value: string): { key: string; value: string } => {
  const text = String(value || '').trim()
  const index = text.indexOf(':')
  if (index < 1) return { key: '', value: text }
  return {
    key: text.slice(0, index).trim(),
    value: text.slice(index + 1).trim(),
  }
}

const buildSerializedTableMarkdownLines = (args: {
  heading: string
  header: readonly string[]
  rows: readonly (readonly string[])[]
}): string[] => {
  const header = Array.from(args.header || []).map(text => ({ text }))
  const rows = Array.from(args.rows || []).map(row => Array.from({ length: header.length }).map((_, index) => ({ text: String(row[index] ?? '') })))
  if (header.length < 1 || rows.length < 1) return []
  const table: TokensTable = { type: 'table', raw: '', header, rows }
  const view = buildMarkdownDataViewFromTableToken(table)
  const lines = view ? serializeMarkdownDataViewToTableLines(view) : []
  return lines.length > 0 ? [`## ${args.heading}`, '', ...lines] : []
}

type YamlMetadataRow = {
  levels: string[]
  key: string
  type: 'blank' | 'list' | 'map' | 'scalar'
  value: string
  content: string
  level: number
  line: number
  indent: number
}

export const buildYamlMetadataTableMarkdown = (args: {
  text: string
  startLine: number
}): YamlMetadataTableProjection => {
  const sourceLines = splitSourceLines(args.text)
  const stack: { indent: number; key: string; path: string }[] = []
  const rowModels: YamlMetadataRow[] = sourceLines.map((line, index) => {
    const parsed = readYamlKeyValue(line)
    const listValue = readYamlListValue(line)
    const indent = readLineIndent(line)
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) stack.pop()
    const parentPath = stack[stack.length - 1]?.path || ''
    const level = Math.max(0, stack.length)
    const parentLevels = parentPath ? parentPath.split('.') : []
    if (parsed) {
      const path = joinPath(parentPath ? [parentPath, parsed.key] : [parsed.key])
      stack.push({ indent, key: parsed.key, path })
      return {
        levels: [...parentLevels, parsed.key],
        key: parsed.key,
        type: parsed.value ? 'scalar' : 'map',
        value: parsed.value || '',
        content: stripLineIndent(line),
        level,
        line: args.startLine + index,
        indent,
      }
    }
    if (listValue) {
      const semantic = splitSemanticValue(listValue.value)
      const key = semantic.key || stack[stack.length - 1]?.key || ''
      return {
        levels: [...parentLevels, key].filter(Boolean),
        key,
        type: 'list',
        value: semantic.value,
        content: stripLineIndent(line),
        level,
        line: args.startLine + index,
        indent,
      }
    }
    return {
      levels: parentLevels,
      key: '',
      type: 'blank',
      value: '',
      content: stripLineIndent(line),
      level,
      line: args.startLine + index,
      indent,
    }
  })
  const maxLevel = Math.max(0, ...rowModels.map(row => Math.max(0, row.levels.length - 1)))
  const levelColumns = Array.from({ length: maxLevel + 1 }).map((_, index) => `L${index}`)
  const rows = rowModels.map(row => [
    ...Array.from({ length: levelColumns.length }).map((_, index) => row.levels[index] || ''),
    row.key,
    row.type,
    row.value,
    `L${row.level}`,
    row.content,
    String(row.line),
    String(row.indent),
  ])
  return {
    lines: buildSerializedTableMarkdownLines({ heading: 'YAML Frontmatter', header: [...levelColumns, ...YAML_METADATA_TRAILING_COLUMNS], rows }),
    sourceLineByRowIndex: sourceLines.map((_, index) => args.startLine + index),
  }
}

const parsePipeCells = (line: string): string[] => {
  const trimmed = String(line || '').trim()
  const withoutLeading = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < withoutLeading.length; i += 1) {
    const char = withoutLeading[i]
    if (char === '\\' && withoutLeading[i + 1] === '|') {
      current += '|'
      i += 1
      continue
    }
    if (char === '|' && i === withoutLeading.length - 1) {
      cells.push(current.trim())
      current = ''
      continue
    }
    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.length > 0 || !trimmed.endsWith('|')) cells.push(current.trim())
  return cells
}

const parseMarkdownTable = (lines: readonly string[]): { header: string[]; rows: string[][] } | null => {
  const bodyLines = Array.from(lines || []).filter(line => PIPE_TABLE_LINE_RE.test(String(line || '')))
  if (bodyLines.length < 2) return null
  const header = parsePipeCells(String(bodyLines[0] || ''))
  const hasSeparator = PIPE_TABLE_SEPARATOR_RE.test(String(bodyLines[1] || ''))
  const rows = bodyLines.slice(hasSeparator ? 2 : 1).map(parsePipeCells)
  return header.length > 0 && rows.length > 0 ? { header, rows } : null
}

export const applyYamlMetadataTableReplacement = (args: {
  sourceText: string
  sourceLineByRowIndex?: readonly number[]
  replacementLines: readonly string[]
}): string | null => {
  const sourceLines = String(args.sourceText || '').replace(/\r\n/g, '\n').split('\n')
  const table = parseMarkdownTable(args.replacementLines)
  const rows = table?.rows || []
  const keyIndex = table?.header.indexOf('Key') ?? -1
  const valueIndex = table?.header.indexOf('Value') ?? -1
  const contentIndex = table?.header.indexOf('Content') ?? -1
  const lineIndex = table?.header.indexOf('Line') ?? -1
  const indentIndex = table?.header.indexOf('Indent') ?? -1
  if (rows.length < 1 || keyIndex < 0 || valueIndex < 0 || contentIndex < 0 || lineIndex < 0 || indentIndex < 0) return null
  rows.forEach((row, rowIndex) => {
    const parsedLine = Number.parseInt(String(row[lineIndex] || '').trim(), 10)
    const sourceLine = Number.isFinite(parsedLine) ? parsedLine : args.sourceLineByRowIndex?.[rowIndex]
    if (!sourceLine || sourceLine < 1 || sourceLine > sourceLines.length) return
    const indent = parseIndentCell(row[indentIndex] || '')
    const originalLine = sourceLines[sourceLine - 1] || ''
    const originalParsed = readYamlKeyValue(originalLine)
    const originalListValue = readYamlListValue(originalLine)
    const nextKey = String(row[keyIndex] || '').trim()
    const nextValue = String(row[valueIndex] || '')
    if (originalParsed && originalParsed.value && nextKey) {
      const sourceKey = readYamlSourceKey(originalLine) || nextKey
      sourceLines[sourceLine - 1] = `${' '.repeat(indent)}${sourceKey}: ${yamlQuote(nextValue)}`
      return
    }
    if (originalListValue) {
      const nextScalar = nextKey && nextValue ? `${nextKey}: ${nextValue}` : (nextValue || String(row[contentIndex] || '').replace(/^-\s*/, ''))
      sourceLines[sourceLine - 1] = `${' '.repeat(indent)}- ${yamlQuote(nextScalar)}`
      return
    }
    sourceLines[sourceLine - 1] = `${' '.repeat(indent)}${String(row[contentIndex] || '')}`
  })
  return sourceLines.join('\n')
}
