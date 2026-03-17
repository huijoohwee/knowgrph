import MarkdownIt from 'markdown-it'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import markdownItMark from 'markdown-it-mark'
import markdownItAnchor from 'markdown-it-anchor'
import { parseMarkdownFrontmatter, splitMarkdownLines, type MarkdownFrontmatter } from '@/lib/markdown'
import { hashText } from '@/features/parsers/hash'
import { slugify } from 'grph-shared/markdown/slugify'
import { normalizeMarkdownWikiLinksAndBlockIds } from 'grph-shared/markdown/wikiLinks'
import { normalizeMarkdownAsciiBlocks } from 'grph-shared/markdown/asciiBlocks'
import { normalizeHtmlHrefLikeValue } from 'grph-shared/markdown/mediaHtml'
import {
  MdToken,
  TokenWithLines,
  normalizeVClicksHtmlBlocks,
} from './markdownPreviewLexUtils'
import { buildBlockTokens } from './markdownPreviewLexBlock'

// Re-export TokenWithLines as it was originally exported from here
export type { TokenWithLines } from './markdownPreviewLexUtils'
export { addLineRangesToTokens } from './markdownPreviewLexUtils'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
})
  .use(markdownItFootnote)
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItMark)
  .use(markdownItAnchor, {
    permalink: false,
    slugify: (s: string) => slugify(s),
  })

const allowlistedDataImageRe = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i
const defaultValidateLink = md.validateLink.bind(md)
md.validateLink = (url: string) => {
  const s = String(url || '').trim()
  if (allowlistedDataImageRe.test(s)) return true
  return defaultValidateLink(s)
}

const LARGE_DOC_FAST_MODE_CHARS = 200_000

const normalizeAtxHeadingWhitespaceForParser = (text: string): string => {
  const raw = String(text || '')
  if (!raw) return raw
  const needsNormalize = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF\u200B\u200C\u200D]/.test(raw) || /^#{1,6}\S/m.test(raw)
  if (!needsNormalize) return raw
  const lines = raw.split(/\r?\n/g)
  let inFence = false
  let fence = ''
  let changed = false
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    const mFence = trimmed.match(/^(```+|~~~+)(.*)$/)
    if (mFence) {
      if (!inFence) {
        inFence = true
        fence = mFence[1] || '```'
      } else if (trimmed.startsWith(fence)) {
        inFence = false
        fence = ''
      }
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    if (/^[ \t]{4,}/.test(line)) {
      out.push(line)
      continue
    }
    const m = line.match(
      /^([ \t]{0,3})([\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF\u200B\u200C\u200D]*)(#{1,6})([ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*)(.*)$/,
    )
    if (!m) {
      out.push(line)
      continue
    }
    const indent = m[1] || ''
    const prefix = m[2] || ''
    const hashes = m[3] || '#'
    const ws = m[4] || ''
    const rest = m[5] || ''
    if (rest.trim() === '') {
      out.push(line)
      continue
    }
    const hadWeirdWs = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/.test(ws)
    const hasAnyWs = ws.length > 0
    if (prefix || !hasAnyWs || hadWeirdWs) {
      const next = `${indent}${hashes} ${rest.replace(/^\s+/, '')}`
      if (next !== line) changed = true
      out.push(next)
      continue
    }
    out.push(line)
  }
  return changed ? out.join('\n') : raw
}

const normalizeStandaloneHtmlHeadingsToAtx = (text: string): string => {
  const raw = String(text || '')
  if (!raw) return raw
  if (!/<h[1-6]\b/i.test(raw)) return raw
  const lines = raw.split(/\r?\n/g)
  let inFence = false
  let fence = ''
  let changed = false
  const out: string[] = []
  const simplifyInlineHtml = (s: string): string => {
    let x = String(s || '')
    x = x.replace(/<\s*br\s*\/?\s*>/gi, '\n')
    x = x.replace(/<\s*(strong|b)\s*>/gi, '**').replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    x = x.replace(/<\s*(em|i)\s*>/gi, '_').replace(/<\s*\/\s*(em|i)\s*>/gi, '_')
    x = x.replace(/<[^>]+>/g, '')
    x = x.replace(/&nbsp;/gi, ' ')
    x = x.replace(/\s+/g, ' ').trim()
    return x
  }
  for (const line of lines) {
    const trimmed = line.trim()
    const mFence = trimmed.match(/^(```+|~~~+)(.*)$/)
    if (mFence) {
      if (!inFence) {
        inFence = true
        fence = mFence[1] || '```'
      } else if (trimmed.startsWith(fence)) {
        inFence = false
        fence = ''
      }
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }
    const m = trimmed.match(/^<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>\s*$/i)
    if (!m) {
      out.push(line)
      continue
    }
    const depth = Number(m[1]) || 1
    const inner = simplifyInlineHtml(m[2] || '')
    if (!inner) {
      out.push(line)
      continue
    }
    out.push(`${'#'.repeat(Math.min(6, Math.max(1, depth)))} ${inner}`)
    changed = true
  }
  return changed ? out.join('\n') : raw
}

const normalizeRedditEmbedHtmlBlocks = (text: string): string => {
  const raw = String(text || '')
  if (!raw) return raw
  if (!/reddit-embed-bq|embed\.reddit\.com\/widgets\.js/i.test(raw)) return raw

  const lines = raw.split(/\r?\n/g)
  let inFence = false
  let fence = ''
  const out: string[] = []

  const extractFirstAbsoluteAnchorHref = (html: string): string => {
    const m = String(html || '').match(/<a\b[^>]*\bhref\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const href = normalizeHtmlHrefLikeValue(String(m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim())
    if (!href) return ''
    if (/^https?:\/\//i.test(href)) return href
    if (/^\/\//.test(href)) return `https:${href}`
    if (/^www\./i.test(href)) return `https://${href}`
    if (href.startsWith('/')) return `https://www.reddit.com${href}`
    return ''
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const mFence = trimmed.match(/^(```+|~~~+)(.*)$/)
    if (mFence) {
      if (!inFence) {
        inFence = true
        fence = mFence[1] || '```'
      } else if (trimmed.startsWith(fence)) {
        inFence = false
        fence = ''
      }
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    if (/<\s*blockquote\b/i.test(line) && /reddit-embed-bq/i.test(line)) {
      let buf = line
      let j = i
      while (j + 1 < lines.length && !/<\s*\/\s*blockquote\b/i.test(buf)) {
        j += 1
        buf += `\n${lines[j] ?? ''}`
      }

      let k = j
      while (k + 1 < lines.length) {
        const nextLine = String(lines[k + 1] ?? '')
        if (!/<\s*script\b/i.test(nextLine) || !/embed\.reddit\.com\/widgets\.js/i.test(nextLine)) break
        k += 1
        buf += `\n${lines[k] ?? ''}`
        if (/<\s*\/\s*script\b/i.test(nextLine)) break
      }

      const href = extractFirstAbsoluteAnchorHref(buf)
      if (href) {
        out.push(href)
      }
      i = k
      continue
    }

    out.push(line)
  }

  const next = out.join('\n')
  return next === raw ? raw : next
}

const mdFast = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false,
})

const mdFastHtml = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
})

const defaultValidateLinkFastHtml = mdFastHtml.validateLink.bind(mdFastHtml)
mdFastHtml.validateLink = (url: string) => {
  const s = String(url || '').trim()
  if (allowlistedDataImageRe.test(s)) return true
  return defaultValidateLinkFastHtml(s)
}

export const lexMarkdown = (
  markdownText: string,
): { tokens: TokenWithLines[]; startLineOffset: number; meta: MarkdownFrontmatter } => {
  const text = String(markdownText || '')
  if (!text.startsWith('---')) {
    const { tokens } = lexMarkdownContent(text, 0)
    return { tokens, startLineOffset: 0, meta: {} }
  }

  const lines = splitMarkdownLines(text)
  const { startIndex, meta } = parseMarkdownFrontmatter(lines)
  const content = lines.slice(startIndex).join('\n')
  const { tokens } = lexMarkdownContent(content, startIndex)
  return { tokens, startLineOffset: startIndex, meta }
}

export const buildMarkdownTokensKey = (markdownText: string): string => {
  const text = String(markdownText || '')
  return `${text.length}|${hashText(text)}`
}

export const lexMarkdownContent = (
  markdownText: string,
  lineOffset: number,
): { tokens: TokenWithLines[] } => {
  const input = String(markdownText || '')
  const base0 = input.includes('<v-clicks') ? normalizeVClicksHtmlBlocks(input) : input
  const base = /reddit-embed-bq|embed\.reddit\.com\/widgets\.js/i.test(base0) ? normalizeRedditEmbedHtmlBlocks(base0) : base0
  const asciiNormalized = normalizeMarkdownAsciiBlocks(base)
  const content =
    asciiNormalized.includes('[[') || asciiNormalized.includes('^') ? normalizeMarkdownWikiLinksAndBlockIds(asciiNormalized) : asciiNormalized
  const normalized = normalizeAtxHeadingWhitespaceForParser(normalizeStandaloneHtmlHeadingsToAtx(content))

  const largeMode = normalized.length > LARGE_DOC_FAST_MODE_CHARS
  const srcLines = largeMode ? [] : splitMarkdownLines(normalized)
  const parser = (() => {
    if (!largeMode) return md
    const wantsHtml = /<\s*(table|img|picture|iframe|video|audio|svg|v-clicks|div|section|main|article|aside|nav|header|footer|ul|ol|details|figure|pre)\b/i.test(normalized)
    return wantsHtml ? mdFastHtml : mdFast
  })()
  const mdTokens = parser.parse(normalized, {}) as unknown as MdToken[]
  const tokens = buildBlockTokens(mdTokens, lineOffset, srcLines)
  return { tokens }
}
