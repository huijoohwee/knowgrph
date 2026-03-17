export const parseDataViewRowIndex = (rowId: string): number | null => {
  const m = /^row_(\d+)$/.exec(String(rowId || ''))
  if (!m) return null
  const idx = Number.parseInt(m[1], 10)
  return Number.isFinite(idx) && idx >= 0 ? idx : null
}

export const rowIdToMarkdownLineInTable = (args: {
  rowId: string
  tableStartLine: number
  tableEndLine: number
}): number | null => {
  const rowIndex = parseDataViewRowIndex(args.rowId)
  if (rowIndex == null) return null
  const startLine = Math.max(1, Math.floor(args.tableStartLine || 1))
  const endLine = Math.max(startLine, Math.floor(args.tableEndLine || startLine))
  const line = startLine + 2 + rowIndex
  if (line > endLine) return endLine
  return line
}

