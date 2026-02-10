import { hashStringToHex } from '../hash/stringHash'
import { parseMarkdownBlocks, parseMarkdownFrontmatter, splitMarkdownLines } from '../markdown'

export type PdfConversionMode = 'text-only' | 'image-heavy' | 'scan-ocr'

export type AnchorId = string
export type DocumentId = string

export type PdfWorkspaceDocNode = {
  id: AnchorId
  kind: 'heading'
  level: number
  text: string
  source?: { page?: number }
}

export type PdfWorkspaceAnchorMap = {
  docId: DocumentId
  mode: PdfConversionMode
  nodes: PdfWorkspaceDocNode[]
  domIdByAnchorId: Record<AnchorId, string>
}

export type PdfWorkspaceDocumentMeta = {
  docId: DocumentId
  title: string
  sourceName: string
  createdAtMs: number
  updatedAtMs: number
  lastMode: PdfConversionMode
}

export type PdfWorkspaceIndex = {
  version: 1
  docs: PdfWorkspaceDocumentMeta[]
}

export const PDF_WORKSPACE_INDEX_VERSION = 1 as const

const normalizeWhitespace = (text: string): string => String(text || '').replace(/\s+/g, ' ').trim()

export const slugifyHeadingText = (raw: string): string => {
  const cleaned = normalizeWhitespace(raw)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  return cleaned || 'section'
}

export const buildDomIdForAnchorId = (anchorId: AnchorId): string => {
  const h = hashStringToHex(`pdf-anchor:${String(anchorId || '').trim()}`)
  return `kg-a-${h.slice(0, 12)}`
}

export const buildAnchorMapFromMarkdown = (args: {
  docId: DocumentId
  mode: PdfConversionMode
  markdown: string
}): PdfWorkspaceAnchorMap => {
  const lines = splitMarkdownLines(args.markdown)
  const { startIndex } = parseMarkdownFrontmatter(lines)
  const blocks = parseMarkdownBlocks(lines, startIndex)
  const headings = blocks
    .filter(b => b.kind === 'heading')
    .map(b => ({ level: b.level, text: normalizeWhitespace(b.text) }))

  const nodes: PdfWorkspaceDocNode[] = []
  const domIdByAnchorId: Record<AnchorId, string> = {}

  const stack: Array<{ level: number; id: AnchorId }> = []
  const occurrences = new Map<string, number>()

  let activePage: number | undefined = undefined
  const readPageFromHeading = (level: number, text: string): number | undefined => {
    if (level !== 2) return undefined
    const m = /^page\s+(\d+)\b/i.exec(text)
    if (!m) return undefined
    const n = Number(m[1] || '')
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
  }

  for (const h of headings) {
    const page = readPageFromHeading(h.level, h.text)
    if (typeof page === 'number') stack.length = 0
    while (stack.length > 0 && (stack[stack.length - 1]?.level || 0) >= h.level) {
      stack.pop()
    }
    const parentId = stack.length > 0 ? stack[stack.length - 1]?.id || '' : ''
    if (typeof page === 'number') activePage = page
    const baseSlug = typeof page === 'number' ? `page-${page}` : slugifyHeadingText(h.text)
    const key = `${parentId}::${baseSlug}`
    const nextCount = (occurrences.get(key) || 0) + 1
    occurrences.set(key, nextCount)
    const suffix = nextCount > 1 ? `--${nextCount}` : ''
    const id = parentId ? `${parentId}/${baseSlug}${suffix}` : `${baseSlug}${suffix}`
    const node: PdfWorkspaceDocNode = {
      id,
      kind: 'heading',
      level: h.level,
      text: h.text,
      source: typeof activePage === 'number' ? { page: activePage } : undefined,
    }
    nodes.push(node)
    domIdByAnchorId[id] = buildDomIdForAnchorId(id)
    stack.push({ level: h.level, id })
  }

  return {
    docId: args.docId,
    mode: args.mode,
    nodes,
    domIdByAnchorId,
  }
}

export const resolveAnchorIdAfterSwitch = (args: {
  desired: AnchorId | null
  nextMap: PdfWorkspaceAnchorMap
}): AnchorId | null => {
  const desired = String(args.desired || '').trim()
  const ids = new Set(args.nextMap.nodes.map(n => n.id))
  if (desired && ids.has(desired)) return desired
  const parts = desired ? desired.split('/').filter(Boolean) : []
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const candidate = parts.slice(0, i).join('/')
    if (ids.has(candidate)) return candidate
  }
  const first = args.nextMap.nodes[0]
  return first ? first.id : null
}
