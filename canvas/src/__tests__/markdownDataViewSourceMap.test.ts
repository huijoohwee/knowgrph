import { parseDataViewRowIndex, rowIdToMarkdownLineInTable } from '@/features/markdown-workspace/main/viewer/markdownDataViewSourceMap'

export function testMarkdownDataViewRowIndexParsing() {
  if (parseDataViewRowIndex('row_0') !== 0) throw new Error('expected row_0 -> 0')
  if (parseDataViewRowIndex('row_12') !== 12) throw new Error('expected row_12 -> 12')
  if (parseDataViewRowIndex('row_-1') != null) throw new Error('expected row_-1 -> null')
  if (parseDataViewRowIndex('row_') != null) throw new Error('expected row_ -> null')
  if (parseDataViewRowIndex('x_1') != null) throw new Error('expected x_1 -> null')
}

export function testMarkdownDataViewRowLineMappingClampsToTable() {
  const startLine = 10
  const endLine = 14
  const row0 = rowIdToMarkdownLineInTable({ rowId: 'row_0', tableStartLine: startLine, tableEndLine: endLine })
  if (row0 !== 12) throw new Error(`expected row_0 -> 12, got ${String(row0)}`)
  const row3 = rowIdToMarkdownLineInTable({ rowId: 'row_3', tableStartLine: startLine, tableEndLine: endLine })
  if (row3 !== 14) throw new Error(`expected row_3 -> 14 (clamped), got ${String(row3)}`)
}

