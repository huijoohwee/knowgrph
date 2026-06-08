import React from 'react'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'

const MarkdownPreviewLazy = React.lazy(() => import('@/features/markdown/ui/MarkdownPreview'))

const CARD_MARKDOWN_CONTENT_CLASS_NAME = 'w-full max-w-none mx-0 min-w-0 px-0 box-border'
const MARKDOWN_IMAGE_LINE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/

function CardMarkdownPreviewFallback({ markdownText }: { markdownText: string }) {
  const match = MARKDOWN_IMAGE_LINE_RE.exec(String(markdownText || ''))
  if (!match) return null
  const title = String(match[1] || 'Markdown image').trim() || 'Markdown image'
  const url = String(match[2] || '').trim()
  if (!url) return null
  return (
    <CardMediaPreview
      kind="image"
      url={url}
      title={title}
      fit="contain"
      mediaThumbnailDataAttr
      className="min-h-24 w-full"
    />
  )
}

export function CardMarkdownPreview({
  markdownText,
  activeDocumentPath,
  className,
  style,
  uiPanelTextFontClass = 'font-sans',
  uiPanelMonospaceTextClass = 'font-mono text-xs',
  richMediaDataAttrs = false,
  previewScrollable = false,
}: {
  markdownText: string
  activeDocumentPath: string
  className?: string
  style?: React.CSSProperties
  uiPanelTextFontClass?: string
  uiPanelMonospaceTextClass?: string
  richMediaDataAttrs?: boolean
  previewScrollable?: boolean
}) {
  const sourceText = String(markdownText || '')
  const rootClassName = ['min-w-0 w-full text-xs leading-5', className].filter(Boolean).join(' ')
  return (
    <section
      data-kg-card-markdown-preview="1"
      data-kg-rich-media-markdown-preview={richMediaDataAttrs ? '1' : undefined}
      className={rootClassName}
      style={style}
    >
      <React.Suspense fallback={<CardMarkdownPreviewFallback markdownText={sourceText} />}>
        <MarkdownPreviewLazy
          markdownText={sourceText}
          activeDocumentPath={activeDocumentPath}
          markdownTokenStoreSync={false}
          highlightedLineRange={null}
          markdownWordWrap
          markdownPresentationMode={false}
          markdownTextHighlight={false}
          uiPanelTextFontClass={uiPanelTextFontClass}
          uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
          previewOverlayScope="container"
          previewOverlayPortalTarget={null}
          previewScrollable={previewScrollable}
          showSidebar={false}
          markdownViewerWidthMode="wide"
          contentClassName={CARD_MARKDOWN_CONTENT_CLASS_NAME}
          markdownCardPreviewMode
          markdownForcePlainTables
        />
      </React.Suspense>
    </section>
  )
}
