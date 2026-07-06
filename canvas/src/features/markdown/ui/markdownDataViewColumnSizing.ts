export const MARKDOWN_DATA_VIEW_DEFAULT_COLUMN_WIDTH_PX = 192

export const readMarkdownDataViewDefaultColumnWidth = (name: string): number => {
  const normalized = String(name || '').trim()
  if (normalized === 'Line' || normalized === 'Indent') return 72
  if (normalized === 'Type') return 112
  if (normalized === 'Content') return 260
  if (normalized === 'Key') return 220
  if (['Summary', 'Output', 'Action', 'Reference Pack'].includes(normalized)) return 220
  if (normalized === 'Value' || /^.+ Value$/.test(normalized)) return 184
  return MARKDOWN_DATA_VIEW_DEFAULT_COLUMN_WIDTH_PX
}
