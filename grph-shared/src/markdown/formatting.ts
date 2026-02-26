import { normalizeMarkdownAsciiBlocks } from './asciiBlocks.js'

export type MarkdownFormatAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'inlineCode'
  | 'link'
  | 'heading2'
  | 'bulletList'
  | 'numberedList'
  | 'blockquote'
  | 'normalizeAsciiBlocks'

export type MarkdownSelectionOffsets = { startOffset: number; endOffset: number }

export type MarkdownFormatResult = {
  nextText: string
  nextSelection: MarkdownSelectionOffsets
}

const clampOffsets = (text: string, selection: MarkdownSelectionOffsets): MarkdownSelectionOffsets => {
  const n = text.length
  const a = Math.max(0, Math.min(n, Math.floor(selection.startOffset || 0)))
  const b = Math.max(0, Math.min(n, Math.floor(selection.endOffset || 0)))
  return a <= b ? { startOffset: a, endOffset: b } : { startOffset: b, endOffset: a }
}

const isWrapped = (
  text: string,
  selection: MarkdownSelectionOffsets,
  left: string,
  right: string,
): boolean => {
  const { startOffset, endOffset } = selection
  if (startOffset < left.length) return false
  if (endOffset + right.length > text.length) return false
  return (
    text.slice(startOffset - left.length, startOffset) === left &&
    text.slice(endOffset, endOffset + right.length) === right
  )
}

const toggleWrap = (
  text: string,
  selection: MarkdownSelectionOffsets,
  left: string,
  right: string,
  emptyInsertionText?: string,
): MarkdownFormatResult => {
  const sel = clampOffsets(text, selection)
  const { startOffset, endOffset } = sel

  if (startOffset === endOffset) {
    const inserted = emptyInsertionText ?? ''
    const nextText = text.slice(0, startOffset) + left + inserted + right + text.slice(endOffset)
    const cursor = startOffset + left.length
    return {
      nextText,
      nextSelection: { startOffset: cursor, endOffset: cursor + inserted.length },
    }
  }

  if (isWrapped(text, sel, left, right)) {
    const nextText =
      text.slice(0, startOffset - left.length) +
      text.slice(startOffset, endOffset) +
      text.slice(endOffset + right.length)
    return {
      nextText,
      nextSelection: { startOffset: startOffset - left.length, endOffset: endOffset - left.length },
    }
  }

  const nextText =
    text.slice(0, startOffset) + left + text.slice(startOffset, endOffset) + right + text.slice(endOffset)
  return {
    nextText,
    nextSelection: { startOffset: startOffset + left.length, endOffset: endOffset + left.length },
  }
}

const lineStartOffset = (text: string, offset: number): number => {
  const clamped = Math.max(0, Math.min(text.length, offset))
  const idx = text.lastIndexOf('\n', clamped - 1)
  return idx < 0 ? 0 : idx + 1
}

const lineEndOffset = (text: string, offset: number): number => {
  const clamped = Math.max(0, Math.min(text.length, offset))
  const idx = text.indexOf('\n', clamped)
  return idx < 0 ? text.length : idx
}

const toggleLinePrefix = (
  text: string,
  selection: MarkdownSelectionOffsets,
  prefix: string,
  opts?: { numbered?: boolean },
): MarkdownFormatResult => {
  const sel = clampOffsets(text, selection)
  const start = lineStartOffset(text, sel.startOffset)
  const end = lineEndOffset(text, sel.endOffset)
  const block = text.slice(start, end)
  const lines = block.split('\n')
  const isNumbered = !!opts?.numbered

  const allHavePrefix = (() => {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ''
      if (!line.trim()) continue
      if (isNumbered) {
        if (!/^\d+\.\s+/.test(line)) return false
      } else {
        if (!line.startsWith(prefix)) return false
      }
    }
    return true
  })()

  const nextLines = lines.map((line, i) => {
    if (!line.trim()) return line
    if (isNumbered) {
      if (allHavePrefix) return line.replace(/^\d+\.\s+/, '')
      return `${i + 1}. ${line.replace(/^\d+\.\s+/, '')}`
    }
    if (allHavePrefix) return line.startsWith(prefix) ? line.slice(prefix.length) : line
    return prefix + line
  })

  const nextBlock = nextLines.join('\n')
  const nextText = text.slice(0, start) + nextBlock + text.slice(end)
  const delta = nextBlock.length - block.length
  return {
    nextText,
    nextSelection: {
      startOffset: sel.startOffset,
      endOffset: sel.endOffset + delta,
    },
  }
}

export function applyMarkdownFormatAction(args: {
  text: string
  selection: MarkdownSelectionOffsets
  action: MarkdownFormatAction
}): MarkdownFormatResult {
  const { text, selection, action } = args

  switch (action) {
    case 'bold':
      return toggleWrap(text, selection, '**', '**')
    case 'italic':
      return toggleWrap(text, selection, '*', '*')
    case 'strike':
      return toggleWrap(text, selection, '~~', '~~')
    case 'inlineCode':
      return toggleWrap(text, selection, '`', '`')
    case 'link': {
      const sel = clampOffsets(text, selection)
      if (sel.startOffset === sel.endOffset) {
        const nextText = text.slice(0, sel.startOffset) + '[]()' + text.slice(sel.endOffset)
        return {
          nextText,
          nextSelection: { startOffset: sel.startOffset + 1, endOffset: sel.startOffset + 1 },
        }
      }
      const label = text.slice(sel.startOffset, sel.endOffset)
      const nextText =
        text.slice(0, sel.startOffset) + `[${label}]()` + text.slice(sel.endOffset)
      const cursor = sel.startOffset + label.length + 3
      return { nextText, nextSelection: { startOffset: cursor, endOffset: cursor } }
    }
    case 'heading2': {
      const sel = clampOffsets(text, selection)
      const start = lineStartOffset(text, sel.startOffset)
      const end = lineEndOffset(text, sel.endOffset)
      const block = text.slice(start, end)
      const lines = block.split('\n')
      const allHave = lines.every(line => !line.trim() || line.startsWith('## '))
      const nextLines = lines.map(line => {
        if (!line.trim()) return line
        if (allHave) return line.startsWith('## ') ? line.slice(3) : line
        return line.startsWith('# ') || line.startsWith('### ') || line.startsWith('## ') ? line.replace(/^#{1,6}\s+/, '## ') : `## ${line}`
      })
      const nextBlock = nextLines.join('\n')
      const nextText = text.slice(0, start) + nextBlock + text.slice(end)
      const delta = nextBlock.length - block.length
      return {
        nextText,
        nextSelection: { startOffset: sel.startOffset, endOffset: sel.endOffset + delta },
      }
    }
    case 'bulletList':
      return toggleLinePrefix(text, selection, '- ')
    case 'numberedList':
      return toggleLinePrefix(text, selection, '1. ', { numbered: true })
    case 'blockquote':
      return toggleLinePrefix(text, selection, '> ')
    case 'normalizeAsciiBlocks': {
      const sel = clampOffsets(text, selection)
      const start = lineStartOffset(text, sel.startOffset)
      const end = lineEndOffset(text, sel.endOffset)
      const block = text.slice(start, end)
      const nextBlock = normalizeMarkdownAsciiBlocks(block)
      const nextText = text.slice(0, start) + nextBlock + text.slice(end)
      const delta = nextBlock.length - block.length
      return {
        nextText,
        nextSelection: { startOffset: sel.startOffset, endOffset: sel.endOffset + delta },
      }
    }
    default: {
      const _exhaustive: never = action
      return { nextText: text, nextSelection: clampOffsets(text, selection) }
    }
  }
}
