import { extractFencedCodeBlocks } from './extractFencedCodeBlocks'
import { extractYamlFrontmatterBlock } from './frontmatter'

const LAYOUT_FENCE_INFO = 'kg-webpage-layout'

function findLayoutBlock(bodyText: string) {
  const blocks = extractFencedCodeBlocks(bodyText)
  const marked = blocks.find(
    b => b.lang === 'text' && String(b.info || '').toLowerCase().includes(LAYOUT_FENCE_INFO),
  )
  if (marked) return { blocks, block: marked }
  const textBlock = blocks.find(b => b.lang === 'text')
  if (textBlock) return { blocks, block: textBlock }
  return { blocks, block: null as typeof blocks[number] | null }
}

export function extractWebpageLayoutAsciiFromMarkdownDoc(rawDoc: string): string {
  const doc = String(rawDoc || '')
  const fm = extractYamlFrontmatterBlock(doc)
  const body = fm ? fm.bodyText : doc
  const { block } = findLayoutBlock(body)
  const content = String(block?.content || '').trimEnd()
  if (content) return `${content}\n`
  return String(body || '')
}

function splitLayoutMockupAndTail(ascii: string): { mockup: string; tail: string } {
  const raw = String(ascii || '')
  const lines = raw.split(/\r\n|\n|\r/)
  const idx = lines.findIndex(l => String(l || '').trim() === 'Legend:')
  if (idx <= 0) return { mockup: raw, tail: '' }
  const mockup = lines.slice(0, idx).join('\n').trimEnd()
  const tail = lines.slice(idx).join('\n').trimEnd()
  return { mockup: mockup ? `${mockup}\n` : '', tail: tail ? `${tail}\n` : '' }
}

export function extractWebpageLayoutMockupAsciiFromMarkdownDoc(rawDoc: string): string {
  const ascii = extractWebpageLayoutAsciiFromMarkdownDoc(rawDoc)
  const { mockup } = splitLayoutMockupAndTail(ascii)
  return mockup || ascii
}

export function extractWebpageLayoutMockupAndTailFromMarkdownDoc(rawDoc: string): { mockup: string; tail: string } {
  const ascii = extractWebpageLayoutAsciiFromMarkdownDoc(rawDoc)
  return splitLayoutMockupAndTail(ascii)
}

export function hasWebpageLayoutAsciiFence(rawDoc: string): boolean {
  const doc = String(rawDoc || '')
  const fm = extractYamlFrontmatterBlock(doc)
  const body = fm ? fm.bodyText : doc
  const blocks = extractFencedCodeBlocks(body)
  return blocks.some(b => b.lang === 'text' && String(b.info || '').toLowerCase().includes(LAYOUT_FENCE_INFO))
}

function replaceFirstFencedBlock(bodyText: string, nextContent: string): string {
  const body = String(bodyText || '')
  const { block: target } = findLayoutBlock(body)
  if (!target) {
    const trimmed = nextContent.replace(/\s+$/g, '')
    const prefix = body.trimEnd()
    const nextBlock = `\n\n\`\`\`text ${LAYOUT_FENCE_INFO}\n${trimmed}\n\`\`\`\n`
    return prefix ? `${prefix}${nextBlock}` : nextBlock.replace(/^\n\n/, '')
  }

  const existingContent = String(target.content || '')
  const existingSplit = splitLayoutMockupAndTail(existingContent)
  const nextSplit = splitLayoutMockupAndTail(nextContent)
  const mergedContent = `${nextSplit.mockup.trimEnd()}${
    existingSplit.tail.trim() ? `\n\n${existingSplit.tail.trimEnd()}` : ''
  }`.replace(/\s+$/g, '')

  const lines = body.split(/\r\n|\n|\r/)
  const openIdx = Math.max(0, target.startLine - 1)
  const closeIdx = Math.max(openIdx, Math.min(lines.length - 1, target.endLine - 1))
  const openLine = lines[openIdx]
  const open = typeof openLine === 'string' ? openLine.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)\s*(.*)$/) : null
  const fence = open?.[1] ?? '```'
  const fenceOpen = `${fence}text ${LAYOUT_FENCE_INFO}`

  const contentLines = mergedContent ? mergedContent.split(/\r\n|\n|\r/) : ['']
  const replacementLines = [fenceOpen, ...contentLines, fence]
  const before = lines.slice(0, openIdx)
  const after = lines.slice(closeIdx + 1)
  return [...before, ...replacementLines, ...after].join('\n')
}

export function upsertWebpageLayoutAsciiIntoMarkdownDoc(rawDoc: string, ascii: string): string {
  const doc = String(rawDoc || '')
  const fm = extractYamlFrontmatterBlock(doc)
  const body = fm ? fm.bodyText : doc
  const nextBody = replaceFirstFencedBlock(body, String(ascii || ''))
  if (fm) return `${fm.rawBlock}\n\n${nextBody.replace(/^\s*\n/, '')}`
  return nextBody.replace(/^\s*\n/, '')
}
