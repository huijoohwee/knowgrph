import { buildMarkdownDataViewFromTableToken } from '@/features/markdown/ui/markdownDataViewModel'
import { serializeMarkdownDataViewToTableLines } from '@/features/markdown/ui/markdownDataViewSerialize'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'
import {
  applyYamlMetadataTableReplacement,
  buildYamlMetadataTableMarkdown,
} from '@/features/markdown-workspace/main/viewer/sourceStructuredDataViewYaml'

const MAX_SOURCE_METADATA_CHARS = 160_000
const HEADING_LINE_RE = /^#{1,6}\s+/
const TOP_LEVEL_YAML_KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*\s*:/
const PIPE_TABLE_LINE_RE = /^\s*\|.*\|\s*$/
const PIPE_TABLE_SEPARATOR_RE = /^\s*\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/

export type StructuredSourceTableReplacement = {
  kind: 'metadata' | 'body'
  generatedStartLine: number
  generatedEndLine: number
  sourceStartLine: number
  sourceEndLine: number
  sourceLineByRowIndex?: number[]
}

export type StructuredSourceDataViewProjection = {
  markdownText: string
  replacements: StructuredSourceTableReplacement[]
}

const SOURCE_LINE_TABLE_COLUMNS = ['Content', 'Line', 'Indent', 'Level'] as const

const extractLeadingStructuredSourceParts = (text: string): { metadataText: string; bodyText: string; metadataStartLine: number; metadataEndLine: number; bodyStartLine: number } => {
  const normalized = String(text || '').replace(/\r\n/g, '\n')
  if (!normalized.trim() || normalized.length > MAX_SOURCE_METADATA_CHARS) return { metadataText: '', bodyText: '', metadataStartLine: 1, metadataEndLine: 1, bodyStartLine: 1 }
  const lines = normalized.split('\n')
  if (lines[0]?.trim() === '---') {
    const closeIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
    return closeIndex > 0
      ? {
        metadataText: lines.slice(1, closeIndex).join('\n'),
        metadataStartLine: 2,
        metadataEndLine: closeIndex,
        bodyText: lines.slice(closeIndex + 1).join('\n'),
        bodyStartLine: closeIndex + 2,
      }
      : { metadataText: '', bodyText: '', metadataStartLine: 1, metadataEndLine: 1, bodyStartLine: 1 }
  }
  if (!TOP_LEVEL_YAML_KEY_RE.test(String(lines[0] || '').trim())) return { metadataText: '', bodyText: '', metadataStartLine: 1, metadataEndLine: 1, bodyStartLine: 1 }
  let endIndex = 1
  for (let i = 1; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (isUnfencedYamlMetadataLine(line)) endIndex = i + 1
    else break
  }
  return {
    metadataText: lines.slice(0, endIndex).join('\n'),
    metadataStartLine: 1,
    metadataEndLine: Math.max(1, endIndex),
    bodyText: lines.slice(endIndex).join('\n'),
    bodyStartLine: endIndex + 1,
  }
}

const isUnfencedYamlMetadataLine = (line: string): boolean => {
  const raw = String(line || '')
  const trimmed = raw.trim()
  if (!trimmed) return true
  if (HEADING_LINE_RE.test(trimmed) || PIPE_TABLE_LINE_RE.test(trimmed) || trimmed.startsWith('```')) return false
  if (TOP_LEVEL_YAML_KEY_RE.test(trimmed)) return true
  return /^\s+/.test(raw) || /^\s*-\s+/.test(raw)
}

const buildSerializedTableMarkdownLines = (args: {
  heading: string
  header: readonly string[]
  rows: readonly (readonly string[])[]
}): string[] => {
  const header = Array.from(args.header || []).map(text => ({ text }))
  const rows = Array.from(args.rows || []).map(row => Array.from({ length: header.length }).map((_, index) => ({ text: String(row[index] ?? '') })))
  if (header.length < 1 || rows.length < 1) return []
  const table: TokensTable = {
    type: 'table',
    raw: '',
    header,
    rows,
  }
  const view = buildMarkdownDataViewFromTableToken(table)
  if (!view) return []
  const lines = serializeMarkdownDataViewToTableLines(view)
  return lines.length > 0 ? [`## ${args.heading}`, '', ...lines] : []
}

const splitSourceLines = (text: string): string[] => String(text || '').replace(/\r\n/g, '\n').split('\n')

const readLineIndent = (line: string): number => {
  const match = String(line || '').match(/^ */)
  return match ? match[0].length : 0
}

const stripLineIndent = (line: string): string => String(line || '').replace(/^ +/, '')

const readMarkdownBodyLineLevel = (args: {
  line: string
  currentHeadingDepth: number
}): { depth: number; nextHeadingDepth: number } => {
  const raw = String(args.line || '')
  const trimmed = raw.trim()
  const headingMatch = /^(#{1,6})\s+/.exec(trimmed)
  if (headingMatch) {
    const depth = Math.max(0, Math.min(5, headingMatch[1]!.length - 1))
    return { depth, nextHeadingDepth: depth }
  }
  const indentDepth = Math.min(8, Math.floor(readLineIndent(raw) / 2))
  const headingChildDepth = args.currentHeadingDepth >= 0 ? args.currentHeadingDepth + 1 : 0
  return { depth: Math.max(indentDepth, headingChildDepth), nextHeadingDepth: args.currentHeadingDepth }
}

const buildSourceLineTableMarkdown = (args: {
  heading: string
  text: string
  startLine: number
}): { lines: string[]; sourceLineByRowIndex: number[] } => {
  const sourceLines = splitSourceLines(args.text)
  let currentHeadingDepth = -1
  const rows = sourceLines.map((line, index) => {
    const level = readMarkdownBodyLineLevel({ line, currentHeadingDepth })
    currentHeadingDepth = level.nextHeadingDepth
    return [
      stripLineIndent(line),
      String(args.startLine + index),
      String(readLineIndent(line)),
      `L${level.depth}`,
    ]
  })
  return {
    lines: buildSerializedTableMarkdownLines({ heading: args.heading, header: SOURCE_LINE_TABLE_COLUMNS, rows }),
    sourceLineByRowIndex: sourceLines.map((_, index) => args.startLine + index),
  }
}

const parseIndentCell = (value: string): number => {
  const numeric = Number.parseInt(String(value || '').trim(), 10)
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return Math.min(240, numeric)
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

export const buildStructuredSourceDataViewProjection = (text: string): StructuredSourceDataViewProjection | null => {
  const { metadataText, bodyText, metadataStartLine, metadataEndLine, bodyStartLine } = extractLeadingStructuredSourceParts(text)
  if (!metadataText) return null
  const metadataTable = buildYamlMetadataTableMarkdown({ text: metadataText, startLine: metadataStartLine })
  const metadataLines = metadataTable.lines
  if (metadataLines.length < 1) return null
  const outputLines: string[] = []
  const replacements: StructuredSourceTableReplacement[] = []
  const pushBlock = (lines: string[], replacement?: StructuredSourceTableReplacement) => {
    if (lines.length < 1) return
    if (outputLines.length > 0) outputLines.push('')
    const blockStartLine = outputLines.length + 1
    outputLines.push(...lines)
    if (replacement) {
      replacements.push({
        ...replacement,
        generatedStartLine: blockStartLine + 2,
        generatedEndLine: blockStartLine + lines.length - 1,
      })
    }
  }
  pushBlock(metadataLines, {
    kind: 'metadata',
    generatedStartLine: 1,
    generatedEndLine: 1,
    sourceStartLine: metadataStartLine,
    sourceEndLine: metadataEndLine,
    sourceLineByRowIndex: metadataTable.sourceLineByRowIndex,
  })
  if (bodyText.length > 0) {
    const bodyTable = buildSourceLineTableMarkdown({ heading: 'Markdown Body', text: bodyText, startLine: bodyStartLine })
    pushBlock(bodyTable.lines, {
      kind: 'body',
      generatedStartLine: 1,
      generatedEndLine: 1,
      sourceStartLine: bodyStartLine,
      sourceEndLine: bodyStartLine + Math.max(0, splitSourceLines(bodyText).length - 1),
      sourceLineByRowIndex: bodyTable.sourceLineByRowIndex,
    })
  }
  return { markdownText: outputLines.join('\n'), replacements }
}

export const buildMarkdownPipeTableFromStructuredSourceMetadata = (text: string): string | null => (
  buildStructuredSourceDataViewProjection(text)?.markdownText ?? null
)

const parseMarkdownTable = (lines: readonly string[]): { header: string[]; rows: string[][] } | null => {
  const bodyLines = Array.from(lines || []).filter(line => PIPE_TABLE_LINE_RE.test(String(line || '')))
  if (bodyLines.length < 2) return null
  const header = parsePipeCells(String(bodyLines[0] || ''))
  const hasSeparator = PIPE_TABLE_SEPARATOR_RE.test(String(bodyLines[1] || ''))
  const rows = bodyLines.slice(hasSeparator ? 2 : 1).map(parsePipeCells)
  return header.length > 0 && rows.length > 0 ? { header, rows } : null
}

const applySourceLineTableReplacement = (sourceText: string, replacement: StructuredSourceTableReplacement, replacementLines: readonly string[]): string | null => {
  const sourceLines = String(sourceText || '').replace(/\r\n/g, '\n').split('\n')
  const table = parseMarkdownTable(replacementLines)
  const rows = table?.rows || []
  const contentIndex = table?.header.indexOf('Content') ?? -1
  const lineIndex = table?.header.indexOf('Line') ?? -1
  const indentIndex = table?.header.indexOf('Indent') ?? -1
  if (rows.length < 1 || contentIndex < 0 || lineIndex < 0 || indentIndex < 0) return null
  rows.forEach((row, rowIndex) => {
    const parsedLine = Number.parseInt(String(row[lineIndex] || '').trim(), 10)
    const sourceLine = Number.isFinite(parsedLine) ? parsedLine : replacement.sourceLineByRowIndex?.[rowIndex]
    if (!sourceLine || sourceLine < 1 || sourceLine > sourceLines.length) return
    const indent = parseIndentCell(row[indentIndex] || '')
    const content = String(row[contentIndex] || '')
    sourceLines[sourceLine - 1] = `${' '.repeat(indent)}${content}`
  })
  return sourceLines.join('\n')
}

export const applyStructuredSourceDataViewReplacement = (args: {
  sourceText: string
  projection: StructuredSourceDataViewProjection | null | undefined
  startLine: number
  endLine: number
  replacementLines: readonly string[]
}): string | null => {
  const projection = args.projection
  if (!projection) return null
  const replacement = projection.replacements.find(candidate => (
    candidate.generatedStartLine === args.startLine && candidate.generatedEndLine === args.endLine
  ))
  if (!replacement) return null
  if (replacement.kind === 'metadata') return applyYamlMetadataTableReplacement({ sourceText: args.sourceText, sourceLineByRowIndex: replacement.sourceLineByRowIndex, replacementLines: args.replacementLines })
  if (replacement.kind === 'body') return applySourceLineTableReplacement(args.sourceText, replacement, args.replacementLines)
  return null
}
