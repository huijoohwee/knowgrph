export const MARKDOWN_SPREADSHEET_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const

export const MARKDOWN_PRESENTATION_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation' as const

export type MarkdownPipeTableAlignment = 'left' | 'center' | 'right' | null

export type ParsedMarkdownPipeTable = {
  columns: string[]
  rows: string[][]
  alignments: MarkdownPipeTableAlignment[]
}

export type ParseMarkdownPipeTableOptions = {
  maxColumns?: number
  maxRows?: number
  maxCellCharacters?: number
  maxTotalCells?: number
}

export type ParsedMarkdownSlide = {
  title: string
  bodyLines: string[]
}

export type ParseMarkdownSlidesOptions = {
  maxCharacters?: number
  maxSlides?: number
  maxLinesPerSlide?: number
  maxLineCharacters?: number
  maxTitleCharacters?: number
}

const PIPE_TABLE_LIMITS = Object.freeze({
  maxColumns: 64,
  maxRows: 1_000,
  maxCellCharacters: 16_384,
  maxTotalCells: 50_000,
})

const SLIDE_LIMITS = Object.freeze({
  maxCharacters: 256_000,
  maxSlides: 100,
  maxLinesPerSlide: 200,
  maxLineCharacters: 4_096,
  maxTitleCharacters: 240,
})

const readLimit = (value: number | undefined, maximum: number): number => {
  if (!Number.isFinite(value)) return maximum
  return Math.min(maximum, Math.max(1, Math.floor(value as number)))
}

const splitMarkdownPipeRow = (line: string): string[] | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  const cells: string[] = []
  let cell = ''
  let escaped = false
  for (const character of trimmed.slice(1, -1)) {
    if (escaped) {
      cell += character
      escaped = false
      continue
    }
    if (character === '\\') {
      cell += character
      escaped = true
      continue
    }
    if (character === '|') {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += character
  }
  cells.push(cell.trim())
  return cells
}

const unescapeMarkdownPipeCell = (value: string): string => value.replace(/\\([\\|])/g, '$1')

const parseAlignment = (value: string): MarkdownPipeTableAlignment => {
  const normalized = value.replace(/\s+/g, '')
  if (normalized.startsWith(':') && normalized.endsWith(':')) return 'center'
  if (normalized.startsWith(':')) return 'left'
  if (normalized.endsWith(':')) return 'right'
  return null
}

const isFence = (line: string): '`' | '~' | null => {
  const marker = line.trim().match(/^(`{3,}|~{3,})/)?.[1]
  if (!marker) return null
  return marker.startsWith('~') ? '~' : '`'
}

/** Parse the first non-fenced GFM pipe table within hard resource limits. */
export const parseBoundedMarkdownPipeTable = (
  value: unknown,
  options: ParseMarkdownPipeTableOptions = {},
): ParsedMarkdownPipeTable | null => {
  const limits = {
    maxColumns: readLimit(options.maxColumns, PIPE_TABLE_LIMITS.maxColumns),
    maxRows: readLimit(options.maxRows, PIPE_TABLE_LIMITS.maxRows),
    maxCellCharacters: readLimit(options.maxCellCharacters, PIPE_TABLE_LIMITS.maxCellCharacters),
    maxTotalCells: readLimit(options.maxTotalCells, PIPE_TABLE_LIMITS.maxTotalCells),
  }
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n')
  let fence: '`' | '~' | null = null

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index] || ''
    const fenceMarker = isFence(line)
    if (fenceMarker) {
      fence = fence === fenceMarker ? null : (fence || fenceMarker)
      continue
    }
    if (fence) continue

    const header = splitMarkdownPipeRow(line)
    if (!header || header.length < 1 || header.length > limits.maxColumns) continue
    const delimiter = splitMarkdownPipeRow(lines[index + 1] || '')
    if (
      !delimiter
      || delimiter.length !== header.length
      || !delimiter.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))
    ) continue

    const columns = header.map(unescapeMarkdownPipeCell)
    if (columns.some(cell => cell.length > limits.maxCellCharacters)) return null
    const rows: string[][] = []
    let totalCells = columns.length

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowLine = lines[rowIndex] || ''
      if (isFence(rowLine)) break
      const rawRow = splitMarkdownPipeRow(rowLine)
      if (!rawRow) break
      if (rawRow.length !== columns.length) return null
      if (rows.length >= limits.maxRows || totalCells + rawRow.length > limits.maxTotalCells) return null
      const row = rawRow.map(unescapeMarkdownPipeCell)
      if (row.some(cell => cell.length > limits.maxCellCharacters)) return null
      rows.push(row)
      totalCells += row.length
    }

    return { columns, rows, alignments: delimiter.map(parseAlignment) }
  }
  return null
}

const stripFrontmatter = (lines: string[]): string[] => {
  if (lines[0]?.trim() !== '---') return lines
  const closingIndex = lines.slice(1, 101).findIndex(line => line.trim() === '---')
  if (closingIndex < 0) return lines
  const candidate = lines.slice(1, closingIndex + 1)
  const looksLikeFrontmatter = candidate.length > 0
    && candidate.some(line => /^\s*[A-Za-z_][\w.-]*\s*:/.test(line))
    && candidate.every(line => !/^\s*#{1,6}\s+/.test(line))
  return looksLikeFrontmatter ? lines.slice(closingIndex + 2) : lines
}

const cleanMarkdownText = (value: string): string => value
  .replace(/^\s*>\s?/, '')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/[*_~`]+/g, '')
  .replace(/\\([\\`*_[\]{}()#+\-.!|])/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()

/** Parse slide separators plus level-one/two headings into a bounded deck model. */
export const parseBoundedMarkdownSlides = (
  value: unknown,
  options: ParseMarkdownSlidesOptions = {},
): ParsedMarkdownSlide[] | null => {
  const limits = {
    maxCharacters: readLimit(options.maxCharacters, SLIDE_LIMITS.maxCharacters),
    maxSlides: readLimit(options.maxSlides, SLIDE_LIMITS.maxSlides),
    maxLinesPerSlide: readLimit(options.maxLinesPerSlide, SLIDE_LIMITS.maxLinesPerSlide),
    maxLineCharacters: readLimit(options.maxLineCharacters, SLIDE_LIMITS.maxLineCharacters),
    maxTitleCharacters: readLimit(options.maxTitleCharacters, SLIDE_LIMITS.maxTitleCharacters),
  }
  const markdown = String(value ?? '').replace(/\r\n?/g, '\n')
  if (markdown.length > limits.maxCharacters) return null
  const lines = stripFrontmatter(markdown.split('\n'))
  const slides: ParsedMarkdownSlide[] = []
  let title = ''
  let bodyLines: string[] = []
  let fence: '`' | '~' | null = null

  const flush = (): boolean => {
    const cleanedBody = bodyLines.map(line => {
      const bullet = line.match(/^\s*(?:[-+*]|\d+[.)])\s+(.+)$/)
      const cleaned = cleanMarkdownText(bullet?.[1] || line)
      return bullet && cleaned ? `• ${cleaned}` : cleaned
    }).filter(Boolean)
    let cleanedTitle = cleanMarkdownText(title)
    if (!cleanedTitle && cleanedBody.length > 0 && !/^\s*(?:[-+*]|\d+[.)])\s+/.test(bodyLines[0] || '')) {
      cleanedTitle = cleanedBody.shift() || ''
    }
    if (!cleanedTitle && cleanedBody.length === 0) {
      title = ''
      bodyLines = []
      return true
    }
    if (!cleanedTitle) cleanedTitle = `Slide ${slides.length + 1}`
    if (cleanedTitle.length > limits.maxTitleCharacters || cleanedBody.length > limits.maxLinesPerSlide) return false
    slides.push({ title: cleanedTitle, bodyLines: cleanedBody })
    title = ''
    bodyLines = []
    return slides.length <= limits.maxSlides
  }

  for (const line of lines) {
    if (line.length > limits.maxLineCharacters) return null
    const fenceMarker = isFence(line)
    if (fenceMarker) {
      fence = fence === fenceMarker ? null : (fence || fenceMarker)
      continue
    }
    if (!fence && /^\s*-{3,}\s*$/.test(line)) {
      if (!flush()) return null
      continue
    }
    const heading = !fence ? line.match(/^\s*(#{1,2})\s+(.+?)\s*#*\s*$/) : null
    if (heading) {
      if ((title || bodyLines.length > 0) && !flush()) return null
      title = heading[2] || ''
      continue
    }
    const subheading = !fence ? line.match(/^\s*#{3,6}\s+(.+?)\s*#*\s*$/) : null
    const normalized = subheading?.[1] || line.trim()
    if (normalized) bodyLines.push(normalized)
  }
  if (!flush()) return null
  return slides.length > 0 ? slides : null
}

export const escapeOfficeXml = (value: unknown): string => {
  const validXml = Array.from(String(value ?? ''), character => {
    const codePoint = character.codePointAt(0) || 0
    const valid = codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff)
    return valid ? character : '\ufffd'
  }).join('')
  return validXml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const FIXED_OFFICE_TIMESTAMP = '2000-01-01T00:00:00Z'
export const FIXED_ZIP_DATE = new Date(2000, 0, 1, 0, 0, 0)
