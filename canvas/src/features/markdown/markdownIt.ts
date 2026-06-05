import MarkdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItMark from 'markdown-it-mark'
import markdownItSub from 'markdown-it-sub'
import { markdownItSuperscript } from '@/features/markdown/markdownItSuperscript'
import { slugify } from 'grph-shared/markdown/slugify'

let cached: MarkdownIt | null = null
let cachedFast: MarkdownIt | null = null
let cachedFastHtml: MarkdownIt | null = null

export const ALLOWLISTED_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i

export function getMarkdownIt(): MarkdownIt {
  if (cached) return cached

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  })
    .use(markdownItFootnote)
    .use(markdownItSub)
    .use(markdownItSuperscript)
    .use(markdownItMark)
    .use(markdownItAnchor, {
      permalink: false,
      level: [1, 2, 3, 4, 5, 6],
      slugify: (s: string) => slugify(s),
    })

  const defaultValidateLink = md.validateLink.bind(md)
  md.validateLink = (url: string) => {
    const s = String(url || '').trim()
    if (ALLOWLISTED_DATA_IMAGE_RE.test(s)) return true
    return defaultValidateLink(s)
  }

  cached = md
  return md
}

export function getMarkdownItFast(): MarkdownIt {
  if (cachedFast) return cachedFast
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
    breaks: false,
  })
  cachedFast = md
  return md
}

export function getMarkdownItFastHtml(): MarkdownIt {
  if (cachedFastHtml) return cachedFastHtml
  const md = new MarkdownIt({
    html: true,
    linkify: false,
    typographer: false,
    breaks: false,
  })

  const defaultValidateLink = md.validateLink.bind(md)
  md.validateLink = (url: string) => {
    const s = String(url || '').trim()
    if (ALLOWLISTED_DATA_IMAGE_RE.test(s)) return true
    return defaultValidateLink(s)
  }

  cachedFastHtml = md
  return md
}
