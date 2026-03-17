import { splitMarkdownLines } from '@/lib/markdown'
import type { Token, TokensText, MathToken } from './MarkdownTokens'

export type TokenWithLines = Token & {
  startLine: number
  endLine: number
}

export type MdToken = {
  type: string
  tag: string
  content: string
  map?: [number, number]
  children?: MdToken[]
  attrs?: [string, string][]
  info?: string
  meta?: unknown
}

export const getAttr = (token: MdToken, name: string): string => {
  const list = token.attrs || []
  for (const [k, v] of list) {
    if (k === name) return v
  }
  return ''
}

export const mapLines = (tok: MdToken, lineOffset: number): { startLine: number; endLine: number } => {
  const map = tok.map
  if (!map) {
    const base = lineOffset + 1
    return { startLine: base, endLine: base }
  }
  const startLine = lineOffset + map[0] + 1
  const endLine = lineOffset + map[1]
  return { startLine, endLine: Math.max(startLine, endLine) }
}

export const selectTokensInLineRange = (
  tokens: TokenWithLines[],
  startLine: number,
  endLine: number,
): TokenWithLines[] => {
  const start = Math.max(1, Math.min(startLine, endLine))
  const end = Math.max(start, Math.max(startLine, endLine))
  const out: TokenWithLines[] = []
  for (const t of tokens) {
    if (t.endLine < start) continue
    if (t.startLine > end) break
    if (t.startLine >= start && t.endLine <= end) out.push(t)
  }
  return out
}

export const normalizeVClicksHtmlBlocks = (markdownText: string): string => {
  const lines = splitMarkdownLines(markdownText || '')
  const out: string[] = []
  let inVClicks = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    if (!inVClicks) {
      if (/^<v-clicks\b[^>]*>\s*$/i.test(trimmed)) {
        inVClicks = true
      }
      out.push(line)
      continue
    }

    if (/^<\/v-clicks>\s*$/i.test(trimmed)) {
      inVClicks = false
      out.push(line)
      continue
    }

    out.push(trimmed ? line : '<!--kg:keep-->')
  }
  return out.join('\n')
}

export const addLineRangesToTokens = (tokens: Token[], lineOffset: number): TokenWithLines[] => {
  const out: TokenWithLines[] = []
  let cursorLine = 1
  for (const t of tokens) {
    const existingStart = (t as unknown as { startLine?: number }).startLine
    const existingEnd = (t as unknown as { endLine?: number }).endLine

    if (typeof existingStart === 'number' && existingStart > 0 && typeof existingEnd === 'number' && existingEnd >= existingStart) {
      out.push(Object.assign({}, t, { startLine: existingStart, endLine: existingEnd }) as TokenWithLines)
      cursorLine += Math.max(0, existingEnd - existingStart)
      continue
    }

    const raw = String((t as unknown as { raw?: unknown }).raw || '')
    const lineCount = raw ? raw.split('\n').length : 0

    if (typeof existingStart === 'number' && existingStart > 0) {
      const endLine = typeof existingEnd === 'number' ? existingEnd : existingStart + Math.max(0, lineCount - 1)
      out.push(Object.assign({}, t, { startLine: existingStart, endLine }) as TokenWithLines)
      cursorLine += Math.max(0, lineCount - 1)
      continue
    }

    const startLine = cursorLine + lineOffset
    const endLine = Math.max(startLine, startLine + Math.max(0, lineCount - 1))
    out.push(Object.assign({}, t, { startLine, endLine }) as TokenWithLines)
    cursorLine += Math.max(0, lineCount - 1)
  }
  return out
}

export const splitTextIntoTextAndMath = (raw: string): Token[] => {
  const src = String(raw || '')
  if (!src) return []
  const out: Token[] = []
  const pushText = (text: string) => {
    if (!text) return
    const t: TokensText = {
      type: 'text',
      raw: text,
      text,
    }
    out.push(t)
  }
  const pushMath = (tex: string, display: boolean) => {
    const m: MathToken = {
      type: 'math',
      raw: tex,
      tex,
      display,
    }
    out.push(m)
  }
  const len = src.length
  let i = 0
  let textStart = 0
  while (i < len) {
    const ch = src[i]
    if (ch === '$') {
      const prev = i > 0 ? src[i - 1] : ''
      if (prev === '\\') {
        i += 1
        continue
      }
      let delimCount = 1
      if (i + 1 < len && src[i + 1] === '$') {
        delimCount = 2
      }
      const startContent = i + delimCount
      let j = startContent
      let found = -1
      while (j < len) {
        if (src[j] === '$') {
          let k = j
          let count = 0
          while (k < len && src[k] === '$') {
            count += 1
            k += 1
          }
          if ((delimCount === 2 && count >= 2) || (delimCount === 1 && count >= 1)) {
            found = j
            break
          }
          j = k
          continue
        }
        j += 1
      }
      if (found < 0) {
        break
      }
      if (textStart < i) {
        pushText(src.slice(textStart, i))
      }
      const tex = src.slice(startContent, found)
      pushMath(tex, delimCount === 2)
      i = found + delimCount
      textStart = i
      continue
    }
    if (ch === '\\' && i + 1 < len && (src[i + 1] === '(' || src[i + 1] === '[')) {
      const isDisplay = src[i + 1] === '['
      const endChar = isDisplay ? ']' : ')'
      const startContent = i + 2
      let j = startContent
      let found = -1
      while (j < len - 1) {
        if (src[j] === '\\' && src[j + 1] === endChar) {
          found = j
          break
        }
        j += 1
      }
      if (found < 0) {
        break
      }
      if (textStart < i) {
        pushText(src.slice(textStart, i))
      }
      const tex = src.slice(startContent, found)
      pushMath(tex, isDisplay)
      i = found + 2
      textStart = i
      continue
    }
    i += 1
  }
  if (textStart < len) {
    pushText(src.slice(textStart, len))
  }
  if (!out.length) {
    const t: TokensText = {
      type: 'text',
      raw: src,
      text: src,
    }
    return [t]
  }
  return out
}
