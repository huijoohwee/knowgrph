import React from 'react'
import { getMarkdownIt } from '@/features/markdown/markdownIt'
import { buildMarkdownTokensKey } from '@/features/markdown/ui/markdownPreviewLex'
import { buildMarkdownHtmlViewerDocument } from '@/features/markdown/htmlViewerCss'
import { buildWebpageHtmlSrcdoc } from '@/lib/websites/webpageIframeSrcdoc'
import { LRUCache } from '@/lib/cache/LRUCache'
import { UI_VIEW_EDIT_SURFACE_AREA_CLASS_NAME, UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES } from '@/lib/ui/surfaceClasses'

const md = getMarkdownIt()
const HTML_VIEWER_SRCDOC_CACHE = new LRUCache<string, string>(40)

export function MarkdownWorkspaceHtmlViewerPane(props: {
  markdownText: string
  title?: string
  onIframeRef?: (el: HTMLIFrameElement | null) => void
}) {
  const renderKey = React.useMemo(() => buildMarkdownTokensKey(props.markdownText), [props.markdownText])

  const srcDoc = React.useMemo(() => {
    const title = String(props.title || 'HTML Viewer')
    const cacheKey = `${renderKey}::${title}`
    const cached = HTML_VIEWER_SRCDOC_CACHE.get(cacheKey)
    if (cached) return cached
    const body = md.render(props.markdownText)
    const html = buildMarkdownHtmlViewerDocument({ title, bodyHtml: body })
    const baseHref = (() => {
      try {
        return typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string'
          ? `${window.location.origin}/`
          : 'https://example.invalid/'
      } catch {
        return 'https://example.invalid/'
      }
    })()
    const next = buildWebpageHtmlSrcdoc({ html, baseHref, scriptPolicy: 'strip' })
    HTML_VIEWER_SRCDOC_CACHE.set(cacheKey, next)
    return next
  }, [props.markdownText, props.title, renderKey])

  return (
    <section className={UI_VIEW_EDIT_SURFACE_AREA_CLASS_NAME} aria-label="HTML viewer" {...UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES}>
      <iframe
        ref={props.onIframeRef}
        title="HTML viewer"
        className={UI_VIEW_EDIT_SURFACE_AREA_CLASS_NAME}
        sandbox=""
        srcDoc={srcDoc}
      />
    </section>
  )
}
