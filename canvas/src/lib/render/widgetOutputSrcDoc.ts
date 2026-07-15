import { getMarkdownItFast } from '@/features/markdown/markdownIt'
import { buildMarkdownHtmlViewerDocument } from '@/features/markdown/htmlViewerCss'
import { LRUCache } from '@/lib/cache/LRUCache'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import {
  enhanceWebsiteCrawlTableRenderedMarkdownHtml,
  isWebsiteCrawlTablePanelMarkdown,
} from '@/lib/websites/websiteCrawlTablePanel'

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const md = getMarkdownItFast()
const textWidgetOutputSrcDocCache = new LRUCache<string, string>(48, 2 * 60_000)

export function buildTextWidgetOutputSrcDoc(args: {
  title?: unknown
  text?: unknown
}): string {
  const title = String(args.title || '').trim() || 'Widget Card Output'
  const text = typeof args.text === 'string' ? args.text : String(args.text ?? '')
  const textHash = hashStringToHexCached(`rich-media-text-srcdoc:${title.slice(0, 120)}`, text)
  const cacheKey = hashSignatureParts(['rich-media-text-srcdoc', title, text.length, textHash])
  const cached = textWidgetOutputSrcDocCache.get(cacheKey)
  if (cached) return cached
  const websiteCrawlTable = isWebsiteCrawlTablePanelMarkdown(text)
  const renderedMarkdownHtml = text.trim() ? md.render(text) : `<pre>${escapeHtml(text)}</pre>`
  const markdownHtml = websiteCrawlTable
    ? enhanceWebsiteCrawlTableRenderedMarkdownHtml(renderedMarkdownHtml)
    : renderedMarkdownHtml
  const html = buildMarkdownHtmlViewerDocument({
    title,
    bodyHtml: `<section data-kg-rich-media-markdown-srcdoc="1"${websiteCrawlTable ? ' data-kg-website-crawl-table-panel="1" data-kg-rich-media-panel-size="viewport" data-kg-rich-media-panel-scroll-owner="media"' : ''}>${markdownHtml}</section>`,
  })
  textWidgetOutputSrcDocCache.set(cacheKey, html)
  return html
}
