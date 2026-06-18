import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
  readCardMarkdownPreviewMediaLabel,
} from '@/lib/cards/cardMarkdownPreviewUtils'

const INLINE_MEDIA_EDIT_TOKEN_ATTR = 'data-kg-inline-media-edit-token'
const INLINE_MEDIA_EDIT_MARKDOWN_ATTR = 'data-kg-inline-media-markdown'

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const escapeHtmlAttr = (value: unknown): string =>
  escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeMarkdownAlt = (value: unknown): string =>
  String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/]/g, '\\]')
    .trim()

const readMediaMarkdown = (kind: 'image' | 'audio' | 'video', src: string, alt: string): string => {
  const safeAlt = escapeMarkdownAlt(alt || kind)
  return kind === 'image'
    ? `![${safeAlt}](${src})`
    : `![${kind === 'audio' ? 'Audio' : 'Video'}: ${safeAlt}](${src})`
}

const buildInlineMediaEditTokenHtml = (args: {
  kind: 'image' | 'audio' | 'video'
  src: string
  alt: string
  title: string
}): string => {
  const label = readCardMarkdownPreviewMediaLabel(args.alt || args.title, args.kind === 'audio' ? 'Audio' : args.kind === 'video' ? 'Video' : 'Image')
  const markdown = readMediaMarkdown(args.kind, args.src, args.alt || args.title || label)
  return [
    `<span class="${escapeHtmlAttr(`${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} isolate !overflow-visible`)}"`,
    ` title="${escapeHtmlAttr(label)}"`,
    ' data-kg-card-inline-media-pill="1"',
    ` ${INLINE_MEDIA_EDIT_TOKEN_ATTR}="1"`,
    ` ${INLINE_MEDIA_EDIT_MARKDOWN_ATTR}="${escapeHtmlAttr(markdown)}"`,
    ' contenteditable="false">',
    `<span class="${escapeHtmlAttr(`${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME} inline-flex items-center justify-center bg-black/5 text-[color:var(--kg-text-secondary)]`)}" aria-hidden="true"></span>`,
    `<span class="${escapeHtmlAttr(CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME)}">${escapeHtml(label)}</span>`,
    '</span>',
  ].join('')
}

export const rewriteRenderedInlineMediaForEditorHtml = (html: string): string => {
  const raw = String(html || '')
  if (!raw.trim() || typeof DOMParser === 'undefined') return raw
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(`<section>${raw}</section>`, 'text/html')
  } catch {
    return raw
  }
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return raw
  const mediaNodes = Array.from(root.querySelectorAll('img,video,audio')) as HTMLElement[]
  mediaNodes.forEach(node => {
    const tag = String(node.tagName || '').toLowerCase()
    const kind = tag === 'audio' ? 'audio' : tag === 'video' ? 'video' : 'image'
    const src = String(node.getAttribute('src') || '').trim()
    if (!src) return
    const alt = String(node.getAttribute('alt') || node.getAttribute('aria-label') || node.getAttribute('title') || '').trim()
    const title = String(node.getAttribute('title') || alt || '').trim()
    const wrapper = doc.createElement('span')
    wrapper.innerHTML = buildInlineMediaEditTokenHtml({ kind, src, alt, title })
    const token = wrapper.firstElementChild
    if (token) node.replaceWith(token)
  })
  return root.innerHTML
}

export const restoreInlineMediaEditTokensInPlace = (root: HTMLElement): void => {
  const tokens = Array.from(root.querySelectorAll(`[${INLINE_MEDIA_EDIT_TOKEN_ATTR}="1"]`)) as HTMLElement[]
  tokens.forEach(token => {
    const markdown = String(token.getAttribute(INLINE_MEDIA_EDIT_MARKDOWN_ATTR) || '').trim()
    if (!markdown) return
    token.replaceWith(root.ownerDocument.createTextNode(markdown))
  })
}

export const INLINE_MEDIA_EDIT_TOKEN_SELECTOR = `[${INLINE_MEDIA_EDIT_TOKEN_ATTR}="1"]`

const readInlineMediaEditTokenMarkdown = (token: Element): string =>
  String(token.getAttribute(INLINE_MEDIA_EDIT_MARKDOWN_ATTR) || token.textContent || '').replace(/\r/g, '')

const isInlineMediaEditTokenElement = (node: Node): node is HTMLElement =>
  node.nodeType === Node.ELEMENT_NODE
    && (node as Element).matches(INLINE_MEDIA_EDIT_TOKEN_SELECTOR)

const readSerializedInlineMediaLength = (node: Node): number => {
  if (isInlineMediaEditTokenElement(node)) return readInlineMediaEditTokenMarkdown(node).length
  if (node.nodeType === Node.TEXT_NODE) return String(node.nodeValue || '').replace(/\r/g, '').length
  if (node.nodeType !== Node.ELEMENT_NODE) return 0
  const element = node as HTMLElement
  if (String(element.tagName || '').toLowerCase() === 'br') return 1
  let length = 0
  Array.from(element.childNodes).forEach(child => {
    length += readSerializedInlineMediaLength(child)
  })
  const tag = String(element.tagName || '').toLowerCase()
  if (tag === 'div' || tag === 'p' || tag === 'pre') length += 1
  return length
}

export const readInlineMediaEditorMarkdownText = (root: HTMLElement | null): string => {
  if (!root) return ''
  let out = ''
  const walk = (node: Node): void => {
    if (isInlineMediaEditTokenElement(node)) {
      out += readInlineMediaEditTokenMarkdown(node)
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      out += String(node.nodeValue || '').replace(/\r/g, '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    const tag = String(element.tagName || '').toLowerCase()
    if (tag === 'br') {
      out += '\n'
      return
    }
    Array.from(element.childNodes).forEach(walk)
    if (tag === 'div' || tag === 'p' || tag === 'pre') out += '\n'
  }
  Array.from(root.childNodes).forEach(walk)
  return out.endsWith('\n') ? out.slice(0, -1) : out
}

const readSerializedOffsetToBoundary = (
  root: HTMLElement,
  container: Node,
  offset: number,
): number | null => {
  const computeWithin = (parent: Node, baseOffset: number): number | null => {
    if (parent === container && parent.nodeType === Node.TEXT_NODE) {
      return baseOffset + Math.max(0, Math.min(offset, String(parent.nodeValue || '').length))
    }
    if (isInlineMediaEditTokenElement(parent)) {
      if (parent === container || parent.contains(container)) {
        return baseOffset + (offset > 0 ? readInlineMediaEditTokenMarkdown(parent).length : 0)
      }
      return null
    }
    const children = Array.from(parent.childNodes)
    let current = baseOffset
    for (let index = 0; index <= children.length; index += 1) {
      if (parent === container && offset === index) return current
      if (index >= children.length) break
      const child = children[index]!
      if (child === container && child.nodeType === Node.TEXT_NODE) {
        return current + Math.max(0, Math.min(offset, String(child.nodeValue || '').length))
      }
      if (isInlineMediaEditTokenElement(child)) {
        if (child === container || child.contains(container)) {
          return current + (offset > 0 ? readInlineMediaEditTokenMarkdown(child).length : 0)
        }
        current += readInlineMediaEditTokenMarkdown(child).length
        continue
      }
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).contains(container)) {
        const nested = computeWithin(child, current)
        if (nested != null) return nested
      }
      current += readSerializedInlineMediaLength(child)
    }
    return null
  }
  return computeWithin(root, 0)
}

export const getInlineMediaEditorMarkdownSelectionOffsets = (
  root: HTMLElement | null,
): { startOffset: number; endOffset: number } | null => {
  if (!root || !root.querySelector(INLINE_MEDIA_EDIT_TOKEN_SELECTOR)) return null
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  if (!selection || selection.rangeCount <= 0) return null
  const range = selection.getRangeAt(0)
  const startNode = range.startContainer
  const endNode = range.endContainer
  const startElement = startNode.nodeType === Node.ELEMENT_NODE ? startNode as Element : startNode.parentElement
  const endElement = endNode.nodeType === Node.ELEMENT_NODE ? endNode as Element : endNode.parentElement
  if (!startElement || !endElement || !root.contains(startElement) || !root.contains(endElement)) return null
  const startOffset = readSerializedOffsetToBoundary(root, startNode, range.startOffset)
  const endOffset = readSerializedOffsetToBoundary(root, endNode, range.endOffset)
  if (startOffset == null || endOffset == null) return null
  return {
    startOffset: Math.max(0, startOffset),
    endOffset: Math.max(0, endOffset),
  }
}

type InlineMediaOffsetSegment = {
  visibleStart: number
  visibleEnd: number
  markdownStart: number
  markdownEnd: number
  token: boolean
}

const readInlineMediaOffsetSegments = (root: HTMLElement): InlineMediaOffsetSegment[] => {
  const segments: InlineMediaOffsetSegment[] = []
  let visibleOffset = 0
  let markdownOffset = 0
  const push = (visibleLength: number, markdownLength: number, token: boolean) => {
    segments.push({
      visibleStart: visibleOffset,
      visibleEnd: visibleOffset + visibleLength,
      markdownStart: markdownOffset,
      markdownEnd: markdownOffset + markdownLength,
      token,
    })
    visibleOffset += visibleLength
    markdownOffset += markdownLength
  }
  const walk = (node: Node): void => {
    if (isInlineMediaEditTokenElement(node)) {
      push(String(node.textContent || '').replace(/\r/g, '').length, readInlineMediaEditTokenMarkdown(node).length, true)
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const length = String(node.nodeValue || '').replace(/\r/g, '').length
      push(length, length, false)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    const tag = String(element.tagName || '').toLowerCase()
    if (tag === 'br') {
      push(1, 1, false)
      return
    }
    Array.from(element.childNodes).forEach(walk)
    if (tag === 'div' || tag === 'p' || tag === 'pre') push(1, 1, false)
  }
  Array.from(root.childNodes).forEach(walk)
  return segments
}

const mapVisibleOffsetToMarkdownOffset = (segments: InlineMediaOffsetSegment[], rawOffset: number): number => {
  const offset = Math.max(0, rawOffset)
  for (const segment of segments) {
    if (offset < segment.visibleStart) return segment.markdownStart
    if (offset > segment.visibleEnd) continue
    if (segment.token) {
      return offset <= segment.visibleStart ? segment.markdownStart : segment.markdownEnd
    }
    return segment.markdownStart + Math.max(0, Math.min(offset - segment.visibleStart, segment.markdownEnd - segment.markdownStart))
  }
  const last = segments[segments.length - 1]
  return last ? last.markdownEnd : offset
}

export const mapInlineMediaEditorVisibleOffsetsToMarkdownOffsets = (
  root: HTMLElement | null,
  offsets: { startOffset: number; endOffset: number } | null | undefined,
): { startOffset: number; endOffset: number } | null => {
  if (!root || !offsets || !root.querySelector(INLINE_MEDIA_EDIT_TOKEN_SELECTOR)) return offsets || null
  const segments = readInlineMediaOffsetSegments(root)
  return {
    startOffset: mapVisibleOffsetToMarkdownOffset(segments, offsets.startOffset),
    endOffset: mapVisibleOffsetToMarkdownOffset(segments, offsets.endOffset),
  }
}
