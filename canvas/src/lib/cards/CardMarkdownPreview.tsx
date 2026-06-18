import React from 'react'
import { DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME } from '@/features/markdown/ui/dataViewChipStyles'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
  hasCardMarkdownPreviewSyntax,
  readCardMarkdownPreviewMediaLabel,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'

const MarkdownPreviewLazy = React.lazy(() => import('@/features/markdown/ui/MarkdownPreview'))

const CARD_MARKDOWN_CONTENT_CLASS_NAME = 'w-full max-w-none mx-0 min-w-0 px-0 box-border'
const MARKDOWN_IMAGE_LINE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/
const INLINE_MEDIA_TOKEN_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<(audio|video)\b([^>]*)>\s*(?:<\/\3>)?/gi
const HTML_ATTR_RE = /\s([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g

type CardMarkdownPreviewInlineMedia = {
  kind: 'image' | 'audio' | 'video'
  url: string
  label: string
}

type CardMarkdownPreviewInlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'media'; media: CardMarkdownPreviewInlineMedia }

function readHtmlAttr(attrs: string, name: string): string {
  HTML_ATTR_RE.lastIndex = 0
  for (const match of attrs.matchAll(HTML_ATTR_RE)) {
    if (String(match[1] || '').toLowerCase() !== name.toLowerCase()) continue
    return String(match[2] ?? match[3] ?? match[4] ?? '').trim()
  }
  return ''
}

function parseInlineMediaToken(match: RegExpExecArray): CardMarkdownPreviewInlineMedia | null {
  if (match[2]) {
    const url = String(match[2] || '').trim()
    if (!url) return null
    return {
      kind: 'image',
      url,
      label: readCardMarkdownPreviewMediaLabel(match[1], 'Image'),
    }
  }
  const kind = String(match[3] || '').toLowerCase()
  if (kind !== 'audio' && kind !== 'video') return null
  const attrs = String(match[4] || '')
  const url = readHtmlAttr(attrs, 'src')
  if (!url) return null
  return {
    kind,
    url,
    label: readCardMarkdownPreviewMediaLabel(readHtmlAttr(attrs, 'title'), kind === 'audio' ? 'Audio' : 'Video'),
  }
}

function splitCardMarkdownPreviewInlineParts(markdownText: string): {
  text: string
  parts: CardMarkdownPreviewInlinePart[]
  hasMedia: boolean
} {
  const source = String(markdownText || '')
  const parts: CardMarkdownPreviewInlinePart[] = []
  let text = ''
  let cursor = 0
  INLINE_MEDIA_TOKEN_RE.lastIndex = 0
  for (const match of source.matchAll(INLINE_MEDIA_TOKEN_RE)) {
    const media = parseInlineMediaToken(match)
    if (!media) continue
    const index = match.index ?? 0
    if (index > cursor) {
      const before = source.slice(cursor, index)
      parts.push({ kind: 'text', text: before })
      text += before
    }
    parts.push({ kind: 'media', media })
    text += ' '
    cursor = index + String(match[0] || '').length
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
  return (
    <a
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
      <CardMediaPreview
        kind={media.kind}
        url={media.url}
        title={media.label}
        interactive={false}
        fit="cover"
        mediaThumbnailDataAttr
        mediaClassName={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_CLASS_NAME}
      />
      <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{media.label}</span>
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
  const splitPreview = React.useMemo(() => splitCardMarkdownPreviewInlineParts(sourceText), [sourceText])
  const previewText = splitPreview.text
  const renderPlainPreviewText = previewText && !hasCardMarkdownPreviewSyntax(previewText)
  const renderInlineMediaPreview = splitPreview.hasMedia && !hasCardMarkdownPreviewSyntax(previewText)
  const rootClassName = ['min-w-0 w-full text-xs leading-5', className].filter(Boolean).join(' ')
  return (
    <section
      data-kg-card-markdown-preview="1"
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
      ) : null}
    </section>
  )
}
