import { buildMarkdownDataViewFromTableToken } from '@/features/markdown/ui/markdownDataViewModel'
import { serializeMarkdownDataViewToTableLines } from '@/features/markdown/ui/markdownDataViewSerialize'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  applyYamlMetadataTableReplacement,
  buildYamlMetadataTableMarkdown,
  readYamlKeyValue,
  readYamlScalarText,
  yamlQuote,
} from '@/features/markdown-workspace/main/viewer/sourceStructuredDataViewYaml'
import {
  buildStrybldrGraphData,
  parseStrybldrStoryboardMarkdown,
  updateStrybldrStoryboardMarkdownCardOverride,
} from '@/features/strybldr/strybldrStoryboard'
import type { StrybldrCardOverride } from '@/features/strybldr/strybldrTypes'

const MAX_SOURCE_METADATA_CHARS = 160_000
const HEADING_LINE_RE = /^#{1,6}\s+/
const TOP_LEVEL_YAML_KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*\s*:/
const PIPE_TABLE_LINE_RE = /^\s*\|.*\|\s*$/
const PIPE_TABLE_SEPARATOR_RE = /^\s*\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/

export type StructuredSourceTableReplacement = {
  kind: 'metadata' | 'body' | 'storyboard'
  generatedStartLine: number
  generatedEndLine: number
  sourceStartLine: number
  sourceEndLine: number
  sourceLineByRowIndex?: number[]
  storyboardRows?: StructuredStoryboardRowReplacement[]
  storyboardEditMode?: 'yamlNode' | 'strybldrPayload'
}

export type StructuredSourceDataViewProjection = {
  markdownText: string
  replacements: StructuredSourceTableReplacement[]
}

type StructuredStoryboardRowReplacement = {
  nodeId: string
  blockStartLine: number
  blockEndLine: number
  nodeIndent: number
  propertiesLine: number | null
  fieldLineByColumnId: Record<string, number>
  currentValueByColumnId: Record<string, string>
}

const STORYBOARD_TABLE_COLUMNS = [
  'Node Id',
  'Lane',
  'Type',
  'Label',
  'Order',
  'Summary',
  'Output',
  'Action',
  'Dialogue',
  'Prompt',
] as const

const STORYBOARD_COLUMN_TO_SOURCE_KEY: Record<string, string> = {
  'Lane': 'lane',
  'Type': 'type',
  'Label': 'label',
  'Order': 'order',
  'Summary': '"kgc:readingSummary"',
  'Output': 'output',
  'Action': 'action',
  'Dialogue': 'dialogue',
  'Prompt': 'prompt',
}
const SOURCE_LINE_TABLE_COLUMNS = ['Content', 'Line', 'Indent'] as const

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

const buildSourceLineTableMarkdown = (args: {
  heading: string
  text: string
  startLine: number
}): { lines: string[]; sourceLineByRowIndex: number[] } => {
  const sourceLines = splitSourceLines(args.text)
  const rows = sourceLines.map((line, index) => [
    stripLineIndent(line),
    String(args.startLine + index),
    String(readLineIndent(line)),
  ])
  return {
    lines: buildSerializedTableMarkdownLines({ heading: args.heading, header: SOURCE_LINE_TABLE_COLUMNS, rows }),
    sourceLineByRowIndex: sourceLines.map((_, index) => args.startLine + index),
  }
}

const readYamlListId = (line: string): { id: string; indent: number } | null => {
  const raw = String(line || '')
  const match = raw.match(/^(\s*)-\s+id\s*:\s*(.*)$/)
  if (!match) return null
  const id = readYamlScalarText(match[2] || '')
  return id ? { id, indent: match[1]?.length || 0 } : null
}

const sourceKeyForStoryboardColumn = (column: string): string | null => STORYBOARD_COLUMN_TO_SOURCE_KEY[column] || null

const buildStoryboardTableFromMetadata = (metadataText: string, metadataStartLine: number): { lines: string[]; rows: StructuredStoryboardRowReplacement[] } => {
  const lines = splitSourceLines(metadataText)
  const rows: string[][] = []
  const replacements: StructuredStoryboardRowReplacement[] = []
  let flowIndent: number | null = null
  let nodesIndent: number | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const kv = readYamlKeyValue(lines[index] || '')
    if (kv?.key === 'flow') {
      flowIndent = kv.indent
      nodesIndent = null
      continue
    }
    if (flowIndent != null && kv && kv.indent <= flowIndent && kv.key !== 'flow') {
      flowIndent = null
      nodesIndent = null
    }
    if (flowIndent != null && kv?.key === 'nodes') {
      nodesIndent = kv.indent
      continue
    }
    if (flowIndent == null || nodesIndent == null) continue
    const listId = readYamlListId(lines[index] || '')
    if (!listId || listId.indent <= nodesIndent) continue
    const blockStartIndex = index
    let blockEndIndex = lines.length - 1
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextLine = lines[next] || ''
      const nextListId = readYamlListId(nextLine)
      const nextKv = readYamlKeyValue(nextLine)
      if (nextListId && nextListId.indent === listId.indent) {
        blockEndIndex = next - 1
        break
      }
      if (nextKv && nextKv.indent <= nodesIndent) {
        blockEndIndex = next - 1
        break
      }
    }
    const fieldLineByColumnId: Record<string, number> = {}
    let propertiesLine: number | null = null
    const values: Record<string, string> = { 'Node Id': listId.id }
    for (let lineIndex = blockStartIndex; lineIndex <= blockEndIndex; lineIndex += 1) {
      const absoluteLine = metadataStartLine + lineIndex
      const line = lines[lineIndex] || ''
      const nodeField = readYamlKeyValue(line)
      if (!nodeField) continue
      if (nodeField.key === 'properties') {
        propertiesLine = absoluteLine
        continue
      }
      const columnEntry = Object.entries(STORYBOARD_COLUMN_TO_SOURCE_KEY).find(([, sourceKey]) => sourceKey.replace(/^"|"$/g, '') === nodeField.key)
      if (!columnEntry) continue
      const [column] = columnEntry
      values[column] = nodeField.value
      fieldLineByColumnId[column] = absoluteLine
    }
    if (!values.Label && !values.Type && !values.Lane && !values.Summary) continue
    rows.push(STORYBOARD_TABLE_COLUMNS.map(column => values[column] || ''))
    replacements.push({
      nodeId: listId.id,
      blockStartLine: metadataStartLine + blockStartIndex,
      blockEndLine: metadataStartLine + blockEndIndex,
      nodeIndent: listId.indent,
      propertiesLine,
      fieldLineByColumnId,
      currentValueByColumnId: values,
    })
    index = blockEndIndex
  }
  return {
    lines: buildSerializedTableMarkdownLines({ heading: 'Storyboard Cards', header: STORYBOARD_TABLE_COLUMNS, rows }),
    rows: replacements,
  }
}

const buildStoryboardTableFromStrybldrPayload = (sourceText: string): { lines: string[]; rows: StructuredStoryboardRowReplacement[] } => {
  const doc = parseStrybldrStoryboardMarkdown(sourceText)
  if (!doc) return { lines: [], rows: [] }
  const graphData = buildStrybldrGraphData(doc)
  const board = buildStoryboardBoardModel({ graphData, graphRevision: 0 })
  const cards = board.lanes.flatMap(lane => lane.cards)
  if (cards.length < 1) return { lines: [], rows: [] }
  const rows = cards.map(card => [
    card.id,
    card.lane,
    card.typeLabel,
    card.title,
    Number.isFinite(card.order) ? String(card.order) : '',
    card.summary,
    card.output,
    card.action,
    card.dialogue,
    card.prompt,
  ])
  const replacements = cards.map((card): StructuredStoryboardRowReplacement => {
    const currentValueByColumnId: Record<string, string> = {
      'Node Id': card.id,
      'Lane': card.lane,
      'Type': card.typeLabel,
      'Label': card.title,
      'Order': Number.isFinite(card.order) ? String(card.order) : '',
      'Summary': card.summary,
      'Output': card.output,
      'Action': card.action,
      'Dialogue': card.dialogue,
      'Prompt': card.prompt,
    }
    return {
      nodeId: card.id,
      blockStartLine: 1,
      blockEndLine: 1,
      nodeIndent: 0,
      propertiesLine: null,
      fieldLineByColumnId: {},
      currentValueByColumnId,
    }
  })
  return {
    lines: buildSerializedTableMarkdownLines({ heading: 'Storyboard Cards', header: STORYBOARD_TABLE_COLUMNS, rows }),
    rows: replacements,
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
  const strybldrStoryboardTable = buildStoryboardTableFromStrybldrPayload(text)
  const storyboardTable = strybldrStoryboardTable.lines.length > 0
    ? strybldrStoryboardTable
    : buildStoryboardTableFromMetadata(metadataText, metadataStartLine)
  if (storyboardTable.lines.length > 0 && storyboardTable.rows.length > 0) {
    pushBlock(storyboardTable.lines, {
      kind: 'storyboard',
      generatedStartLine: 1,
      generatedEndLine: 1,
      sourceStartLine: metadataStartLine,
      sourceEndLine: metadataEndLine,
      storyboardRows: storyboardTable.rows,
      storyboardEditMode: strybldrStoryboardTable.lines.length > 0 ? 'strybldrPayload' : 'yamlNode',
    })
  }
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

const replaceYamlScalarLine = (line: string, sourceKey: string, nextValue: string): string => {
  const raw = String(line || '')
  const indent = raw.match(/^(\s*)/)?.[1] || ''
  return `${indent}${sourceKey}: ${yamlQuote(nextValue)}`
}

const insertStoryboardPropertyLine = (args: {
  sourceLines: string[]
  row: StructuredStoryboardRowReplacement
  sourceKey: string
  nextValue: string
}): number => {
  const propertyIndent = args.row.nodeIndent + 4
  if (!args.row.propertiesLine) {
    args.sourceLines.splice(
      args.row.blockEndLine,
      0,
      `${' '.repeat(args.row.nodeIndent + 2)}properties:`,
      `${' '.repeat(propertyIndent)}${args.sourceKey}: ${yamlQuote(args.nextValue)}`,
    )
    return args.row.blockEndLine + 2
  }
  args.sourceLines.splice(args.row.propertiesLine, 0, `${' '.repeat(propertyIndent)}${args.sourceKey}: ${yamlQuote(args.nextValue)}`)
  return args.row.propertiesLine + 1
}

const applyStoryboardTableReplacement = (sourceText: string, replacement: StructuredSourceTableReplacement, replacementLines: readonly string[]): string | null => {
  if (replacement.storyboardEditMode === 'strybldrPayload') return applyStrybldrStoryboardTableReplacement(sourceText, replacement, replacementLines)
  const sourceLines = String(sourceText || '').replace(/\r\n/g, '\n').split('\n')
  const rows = parseMarkdownTableRows(replacementLines)
  const replacementRows = replacement.storyboardRows || []
  if (rows.length < 1 || replacementRows.length < 1) return null
  const replacementByNodeId = new Map(replacementRows.map(row => [row.nodeId, row]))
  let lineDelta = 0
  rows.forEach((row, rowIndex) => {
    const rowReplacement = replacementByNodeId.get(String(row[0] || '')) || replacementRows[rowIndex]
    if (!rowReplacement) return
    const workingRow: StructuredStoryboardRowReplacement = {
      ...rowReplacement,
      fieldLineByColumnId: { ...rowReplacement.fieldLineByColumnId },
      blockEndLine: rowReplacement.blockEndLine + lineDelta,
      propertiesLine: rowReplacement.propertiesLine ? rowReplacement.propertiesLine + lineDelta : null,
    }
    STORYBOARD_TABLE_COLUMNS.forEach((column, columnIndex) => {
      if (column === 'Node Id') return
      const sourceKey = sourceKeyForStoryboardColumn(column)
      if (!sourceKey) return
      const nextValue = String(row[columnIndex] || '')
      const originalLine = workingRow.fieldLineByColumnId[column]
      if (originalLine) {
        const lineIndex = originalLine - 1 + lineDelta
        if (lineIndex >= 0 && lineIndex < sourceLines.length) {
          sourceLines[lineIndex] = replaceYamlScalarLine(sourceLines[lineIndex] || '', sourceKey, nextValue)
        }
        return
      }
      if (!nextValue) return
      const insertedLine = insertStoryboardPropertyLine({
        sourceLines,
        row: workingRow,
        sourceKey,
        nextValue,
      })
      workingRow.fieldLineByColumnId[column] = insertedLine - lineDelta
      if (!workingRow.propertiesLine) {
        workingRow.propertiesLine = insertedLine - 1
        workingRow.blockEndLine += 2
        lineDelta += 2
        return
      }
      workingRow.blockEndLine += 1
      lineDelta += 1
    })
  })
  return sourceLines.join('\n')
}

const readStoryboardPatch = (row: readonly string[], rowReplacement: StructuredStoryboardRowReplacement): Omit<Partial<StrybldrCardOverride>, 'nodeId'> => {
  const patch: Omit<Partial<StrybldrCardOverride>, 'nodeId'> = {}
  STORYBOARD_TABLE_COLUMNS.forEach((column, columnIndex) => {
    if (column === 'Node Id') return
    const nextValue = String(row[columnIndex] || '')
    const currentValue = String(rowReplacement.currentValueByColumnId[column] || '')
    if (nextValue === currentValue) return
    if (column === 'Label') {
      patch.title = nextValue
      return
    }
    if (column === 'Order') {
      const order = Number(nextValue)
      patch.order = Number.isFinite(order) ? order : null
      return
    }
    const key = sourceKeyForStoryboardColumn(column)
    if (!key) return
    const normalized = key.replace(/^"|"$/g, '')
    if (normalized === 'lane') patch.lane = nextValue
    else if (normalized === 'type') patch.type = nextValue
    else if (normalized === 'output') patch.output = nextValue
    else if (normalized === 'action') patch.action = nextValue
    else if (normalized === 'dialogue') patch.dialogue = nextValue
    else if (normalized === 'prompt') patch.prompt = nextValue
    else if (normalized === 'kgc:readingSummary') patch.summary = nextValue
  })
  return patch
}

const hasStoryboardPatch = (patch: Omit<Partial<StrybldrCardOverride>, 'nodeId'>): boolean => (
  Object.keys(patch).length > 0
)

const applyStrybldrStoryboardTableReplacement = (sourceText: string, replacement: StructuredSourceTableReplacement, replacementLines: readonly string[]): string | null => {
  const rows = parseMarkdownTableRows(replacementLines)
  const replacementRows = replacement.storyboardRows || []
  if (rows.length < 1 || replacementRows.length < 1) return null
  const replacementByNodeId = new Map(replacementRows.map(row => [row.nodeId, row]))
  let nextText = sourceText
  rows.forEach((row, rowIndex) => {
    const rowReplacement = replacementByNodeId.get(String(row[0] || '')) || replacementRows[rowIndex]
    if (!rowReplacement?.nodeId) return
    const patch = readStoryboardPatch(row, rowReplacement)
    if (!hasStoryboardPatch(patch)) return
    const patched = updateStrybldrStoryboardMarkdownCardOverride({
      text: nextText,
      nodeId: rowReplacement.nodeId,
      patch,
    })
    if (patched != null) nextText = patched
  })
  return nextText === sourceText ? null : nextText
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

const parseMarkdownTableRows = (lines: readonly string[]): string[][] => parseMarkdownTable(lines)?.rows || []

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
  if (replacement.kind === 'storyboard') return applyStoryboardTableReplacement(args.sourceText, replacement, args.replacementLines)
  return null
}
