import { getMarkdownItFast } from '@/features/markdown/markdownIt'
import { buildMarkdownHtmlViewerDocument } from '@/features/markdown/htmlViewerCss'
import { LRUCache } from '@/lib/cache/LRUCache'
import { hashSignatureParts } from '@/lib/hash/signature'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import {
  RICH_MEDIA_PANEL_SRCDOC_SCROLL_OWNER_ATTR,
  RICH_MEDIA_PANEL_SRCDOC_SIZE_MODE_ATTR,
  RICH_MEDIA_PANEL_SRCDOC_SIZE_MODE_VIEWPORT,
} from '@/lib/render/richMediaPanelSrcDoc'
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
  scrollOwner?: 'media' | 'panel'
}): string {
  const title = String(args.title || '').trim() || 'Widget Card Output'
  const text = typeof args.text === 'string' ? args.text : String(args.text ?? '')
  const textHash = hashStringToHexCached(`rich-media-text-srcdoc:${title.slice(0, 120)}`, text)
  const requestedScrollOwner = args.scrollOwner === 'media' || args.scrollOwner === 'panel' ? args.scrollOwner : ''
  const cacheKey = hashSignatureParts(['rich-media-text-srcdoc', title, requestedScrollOwner, text.length, textHash])
  const cached = textWidgetOutputSrcDocCache.get(cacheKey)
  if (cached) return cached
  const websiteCrawlTable = isWebsiteCrawlTablePanelMarkdown(text)
  const renderedMarkdownHtml = text.trim() ? md.render(text) : `<pre>${escapeHtml(text)}</pre>`
  const markdownHtml = websiteCrawlTable
    ? enhanceWebsiteCrawlTableRenderedMarkdownHtml(renderedMarkdownHtml)
    : renderedMarkdownHtml
  const scrollOwner = websiteCrawlTable ? 'media' : requestedScrollOwner
  const scrollOwnerAttrs = scrollOwner
    ? ` ${RICH_MEDIA_PANEL_SRCDOC_SCROLL_OWNER_ATTR}="${scrollOwner}"${scrollOwner === 'media' ? ` ${RICH_MEDIA_PANEL_SRCDOC_SIZE_MODE_ATTR}="${RICH_MEDIA_PANEL_SRCDOC_SIZE_MODE_VIEWPORT}"` : ''}`
    : ''
  const html = buildMarkdownHtmlViewerDocument({
    title,
    bodyHtml: `<section data-kg-rich-media-markdown-srcdoc="1"${websiteCrawlTable ? ' data-kg-website-crawl-table-panel="1"' : ''}${scrollOwnerAttrs}>${markdownHtml}</section>`,
  })
  textWidgetOutputSrcDocCache.set(cacheKey, html)
  return html
}
