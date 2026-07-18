import React from 'react'
import { DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME } from '@/features/markdown/ui/dataViewChipStyles'
import { CardMediaHoverPreview, useCardMediaHoverPreview } from '@/lib/cards/CardMediaHoverPreview'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { readCardInlineMediaTokens, type CardInlineMediaToken } from '@/lib/cards/cardInlineMediaTokens'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
  hasCardMarkdownPreviewSyntax,
  normalizeCardInlineMediaSoftLineBreaks,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'

const MarkdownPreviewLazy = React.lazy(() => import('@/features/markdown/ui/MarkdownPreview'))

const CARD_MARKDOWN_CONTENT_CLASS_NAME = 'w-full max-w-none mx-0 min-w-0 px-0 box-border'
const MARKDOWN_IMAGE_LINE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/

type CardMarkdownPreviewInlineMedia = Pick<CardInlineMediaToken, 'kind' | 'url' | 'label'>

type CardMarkdownPreviewInlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'media'; media: CardMarkdownPreviewInlineMedia }

function splitCardMarkdownPreviewInlineParts(markdownText: string): {
  text: string
  parts: CardMarkdownPreviewInlinePart[]
  hasMedia: boolean
} {
  const source = String(markdownText || '')
  const parts: CardMarkdownPreviewInlinePart[] = []
  let text = ''
  let cursor = 0
  for (const token of readCardInlineMediaTokens(source)) {
    if (token.start > cursor) {
      const before = source.slice(cursor, token.start)
      parts.push({ kind: 'text', text: before })
      text += before
    }
    parts.push({ kind: 'media', media: token })
    text += ' '
    cursor = token.end
  }
  if (cursor < source.length) {
    const after = source.slice(cursor)
    parts.push({ kind: 'text', text: after })
    text += after
  }
  return {
    text: text.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim(),
    parts,
    hasMedia: parts.some(part => part.kind === 'media'),
  }
}

function CardMarkdownPreviewInlineMediaChip({ media }: { media: CardMarkdownPreviewInlineMedia }) {
  const hoverPreview = useCardMediaHoverPreview<HTMLAnchorElement>()
  return (
    <a
      ref={hoverPreview.anchorRef}
      {...hoverPreview.anchorProps}
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME}
      title={media.label}
      draggable={false}
      data-kg-card-inline-media-pill="1"
      onClick={event => {
        event.stopPropagation()
      }}
      onDragStart={event => {
        event.preventDefault()
      }}
    >
      <InlineMediaCommandThumbnail
        kind={media.kind}
        thumbnailUrl={media.kind === 'image' ? media.url : undefined}
        variant="inline"
      />
      <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{media.label}</span>
      <CardMediaHoverPreview
        anchorRef={hoverPreview.anchorRef}
        kind={media.kind}
        open={hoverPreview.show}
        title={media.label}
        tooltipId={hoverPreview.tooltipId}
        url={media.url}
        onClose={hoverPreview.close}
      />
    </a>
  )
}

function renderCardMarkdownPreviewText(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const lines = String(text || '').split('\n')
  lines.forEach((line, index) => {
    if (index > 0) nodes.push(<br key={`${keyPrefix}:br:${index}`} />)
    if (line) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}:text:${index}`}>
          {renderMarkdownSigilInlineText(line, { keywordChipClassName: DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME })}
        </React.Fragment>,
      )
    }
  })
  return nodes
}

function CardMarkdownPreviewInlineRun({ parts }: { parts: CardMarkdownPreviewInlinePart[] }) {
  return (
    <p className="m-0 min-w-0">
      {parts.map((part, index) => {
        if (part.kind === 'media') {
          return <CardMarkdownPreviewInlineMediaChip key={`media:${index}:${part.media.url}`} media={part.media} />
        }
        return renderCardMarkdownPreviewText(part.text, `text:${index}`)
      })}
    </p>
  )
}

function CardMarkdownPreviewPlainText({ text }: { text: string }) {
  return (
    <p className="m-0 min-w-0">
      {renderCardMarkdownPreviewText(text, 'plain')}
    </p>
  )
}

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
  inlineChipDensity = 'regular',
  markdownPresentationMode = false,
}: {
  markdownText: string
  activeDocumentPath: string
  className?: string
  style?: React.CSSProperties
  uiPanelTextFontClass?: string
  uiPanelMonospaceTextClass?: string
  richMediaDataAttrs?: boolean
  previewScrollable?: boolean
  inlineChipDensity?: 'regular' | 'compact'
  markdownPresentationMode?: boolean
}) {
  const sourceText = inlineChipDensity === 'compact'
    ? normalizeCardInlineMediaSoftLineBreaks(String(markdownText || '')).trim()
    : String(markdownText || '')
  const splitPreview = React.useMemo(() => splitCardMarkdownPreviewInlineParts(sourceText), [sourceText])
  const previewText = splitPreview.text
  const renderPlainPreviewText = previewText && !hasCardMarkdownPreviewSyntax(previewText)
  const renderInlineMediaPreview = splitPreview.hasMedia && !hasCardMarkdownPreviewSyntax(previewText)
  const rootTextMetricsClassName = inlineChipDensity === 'compact'
    ? 'min-w-0 w-full [font-size:inherit] [line-height:inherit]'
    : 'min-w-0 w-full text-xs leading-5'
  const rootClassName = [rootTextMetricsClassName, className].filter(Boolean).join(' ')
  return (
    <section
      data-kg-card-markdown-preview="1"
      data-kg-card-inline-chip-density={inlineChipDensity === 'compact' ? 'compact' : undefined}
      data-kg-rich-media-markdown-preview={richMediaDataAttrs ? '1' : undefined}
      className={rootClassName}
      style={style}
    >
      {renderInlineMediaPreview ? (
        <CardMarkdownPreviewInlineRun parts={splitPreview.parts} />
      ) : renderPlainPreviewText ? (
        <CardMarkdownPreviewPlainText text={previewText} />
      ) : previewText ? (
        <React.Suspense fallback={<CardMarkdownPreviewFallback markdownText={previewText} />}>
          <MarkdownPreviewLazy
            markdownText={previewText}
            activeDocumentPath={activeDocumentPath}
            markdownTokenStoreSync={false}
            highlightedLineRange={null}
            markdownWordWrap
            markdownPresentationMode={markdownPresentationMode}
            markdownTextHighlight={false}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            previewOverlayScope="container"
            previewOverlayPortalTarget={null}
            previewScrollable={previewScrollable}
            showSidebar={false}
            markdownViewerWidthMode="wide"
            contentClassName={CARD_MARKDOWN_CONTENT_CLASS_NAME}
            markdownCardPreviewMode={!markdownPresentationMode}
            markdownForcePlainTables
          />
        </React.Suspense>
      ) : null}
    </section>
  )
}
