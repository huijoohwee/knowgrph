import { LRUCache } from '@/lib/cache/LRUCache'
import type { TokenWithLines } from '@/features/markdown/ui/markdownPreviewLexUtils'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'
import {
  buildMarkdownDataViewFromTableToken,
  type MarkdownDataView,
} from '@/features/markdown/ui/markdownDataViewModel'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { tryBuildJsonMarkdownTablesFromText } from '@/features/markdown/jsonToMarkdownDocument'

export type DataViewCandidate = {
  id: string
  legacyId?: string
  label: string
  table: TokenWithLines & TokensTable
  view: MarkdownDataView
}

const DATA_VIEW_CANDIDATES_CACHE = new LRUCache<string, DataViewCandidate[]>(60)
const DERIVED_TABLE_SCAN_MAX_CHARS = 320_000
const HEADING_LINE_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/

export function tryBuildApiGraphMarkdownTablesFromJson(text: string, preferredMode?: JsonToMarkdownMode): string | null {
  return tryBuildJsonMarkdownTablesFromText(text, preferredMode)
}

const buildMarkdownDataViewFromTableTokenLoose = (table: TokensTable): MarkdownDataView | null => {
  const headerCells = Array.isArray(table.header) ? table.header : []
  const rowsCells = Array.isArray(table.rows) ? table.rows : []
  const colCount = Math.max(headerCells.length, ...rowsCells.map(r => r.length))
  if (!Number.isFinite(colCount) || colCount <= 1 || colCount > 32) return null

  const headerNames = Array.from({ length: colCount }).map((_, i) => String(headerCells[i]?.text ?? '').trim())
  const rows = rowsCells.map((r, rowIndex) => {
    const cells = Array.from({ length: colCount }).map((_, colIndex) => String(r[colIndex]?.text ?? '').trim())
    return { id: `row_${rowIndex}`, cells }
  })
  if (rows.length < 1) return null

  const columns = headerNames.map((name, colIndex) => {
    const safe = name || `Column ${colIndex + 1}`
    return { id: `col_${colIndex}`, name: safe, kind: 'text' as const }
  })

  const titleColumnId = columns[0]?.id ?? 'col_0'
  return { columns, rows, titleColumnId, groupByColumnId: null }
}

const deriveCandidateBaseLabel = (markdownLines: string[], startLine: number, fallbackIndex: number): string => {
  const fromIndex = Math.max(0, startLine - 2)
  for (let i = fromIndex; i >= 0; i -= 1) {
    const raw = String(markdownLines[i] || '')
    const line = raw.trim()
    if (!line) continue
    const headingMatch = line.match(HEADING_LINE_RE)
    if (headingMatch?.[1]) return headingMatch[1].trim()
    if (line.startsWith('|')) continue
    if (line.startsWith('```')) break
  }
  return `Table ${fallbackIndex}`
}

export const buildDataViewCandidates = (
  markdownText: string,
  candidatesKey: string,
  tokens: TokenWithLines[],
  relaxed: boolean,
): DataViewCandidate[] => {
  if (markdownText.length > DERIVED_TABLE_SCAN_MAX_CHARS) return []
  const cacheKey = `${candidatesKey}|${relaxed ? 'relaxed' : 'strict'}`
  const cached = DATA_VIEW_CANDIDATES_CACHE.get(cacheKey)
  if (cached) return cached
  const markdownLines = markdownText.split('\n')
  const tables = tokens.filter((t): t is TokenWithLines & TokensTable => t.type === 'table')
  const candidates: DataViewCandidate[] = []
  const seenLabels = new Map<string, number>()
  for (let i = 0; i < tables.length; i += 1) {
    const table = tables[i]
    const view = relaxed
      ? (buildMarkdownDataViewFromTableToken(table) || buildMarkdownDataViewFromTableTokenLoose(table))
      : buildMarkdownDataViewFromTableToken(table)
    if (!view) continue
    const startLine = Math.max(1, Math.floor(Number((table as unknown as { startLine?: unknown }).startLine || 0)))
    const endLine = Math.max(startLine, Math.floor(Number((table as unknown as { endLine?: unknown }).endLine || 0)))
    const stableId = `md-block:${startLine}-${endLine}`
    const baseLabel = deriveCandidateBaseLabel(markdownLines, startLine, candidates.length + 1)
    const labelCount = seenLabels.get(baseLabel) || 0
    seenLabels.set(baseLabel, labelCount + 1)
    const label = labelCount > 0 ? `${baseLabel} (${labelCount + 1})` : baseLabel
    candidates.push({
      id: stableId,
      legacyId: `table_${i}`,
      label,
      table,
      view,
    })
  }
  DATA_VIEW_CANDIDATES_CACHE.set(cacheKey, candidates)
  return candidates
}
