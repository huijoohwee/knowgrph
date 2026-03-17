import React from 'react'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import footnote from 'markdown-it-footnote'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import mark from 'markdown-it-mark'
import { buildMarkdownTokensKey } from '@/features/markdown/ui/markdownPreviewLex'
import { buildWebpageHtmlSrcdoc } from '@/lib/websites/webpageIframeSrcdoc'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
})
  .use(footnote)
  .use(sub)
  .use(sup)
  .use(mark)
  .use(anchor, {
    permalink: false,
    level: [1, 2, 3, 4, 5, 6],
  })

export function MarkdownWorkspaceHtmlViewerPane(props: {
  markdownText: string
  title?: string
  onIframeRef?: (el: HTMLIFrameElement | null) => void
}) {
  const renderKey = React.useMemo(() => buildMarkdownTokensKey(props.markdownText), [props.markdownText])

  const srcDoc = React.useMemo(() => {
    const body = md.render(props.markdownText)
    const title = String(props.title || 'HTML Viewer')
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html{color-scheme:dark light}body{margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f14;color:#e5e7eb}main{max-width:980px;margin:0 auto;padding:16px}a{color:#60a5fa}pre,code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}table{border-collapse:collapse}th,td{border:1px solid #1f2937;padding:6px 8px;vertical-align:top}blockquote{border-left:3px solid #1f2937;margin:0;padding:0 0 0 12px;color:#9ca3af}</style></head><body><main>${body}</main></body></html>`
    const baseHref = (() => {
      try {
        return typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string'
          ? `${window.location.origin}/`
          : 'https://example.invalid/'
      } catch {
        return 'https://example.invalid/'
      }
    })()
    return buildWebpageHtmlSrcdoc({ html, baseHref, scriptPolicy: 'strip' })
  }, [props.markdownText, props.title, renderKey])

  return (
    <section className="h-full w-full" aria-label="HTML viewer">
      <iframe
        ref={props.onIframeRef}
        title="HTML viewer"
        className="h-full w-full"
        sandbox=""
        srcDoc={srcDoc}
      />
    </section>
  )
}
