import React from 'react'
import { Download } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { buildMarkdownMediaDownloadHref, deriveMarkdownMediaDownloadFilename, type MarkdownMediaDownloadKind } from './mediaDownload'

const DOWNLOAD_CLASS = [
  'absolute right-1 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded border shadow-sm',
  UI_THEME_TOKENS.panel.border,
  UI_THEME_TOKENS.panel.bg,
  UI_THEME_TOKENS.text.primary,
  'opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100',
].join(' ')

const CARD_PREVIEW_DOWNLOAD_CLASS = [
  'absolute right-1 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded',
  UI_THEME_TOKENS.panel.bg,
  UI_THEME_TOKENS.text.primary,
  'opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100',
].join(' ')

export const renderInlineMediaWithDownload = (args: {
  children: React.ReactElement
  insideLink: boolean
  kind: MarkdownMediaDownloadKind
  nodeKey: React.Key
  src: string
  cardPreviewMode?: boolean
}): React.ReactNode => {
  const href = args.insideLink ? '' : buildMarkdownMediaDownloadHref(args.src)
  if (!href) return args.children
  return (
    <span key={args.nodeKey} className="relative inline-block group align-middle max-w-full">
      {args.children}
      <a
        href={href}
        download={deriveMarkdownMediaDownloadFilename(args.src, args.kind) || undefined}
        title="Download media"
        aria-label="Download media"
        className={args.cardPreviewMode === true ? CARD_PREVIEW_DOWNLOAD_CLASS : DOWNLOAD_CLASS}
        onClick={event => {
          try { event.stopPropagation() } catch { void 0 }
        }}
      >
        <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </a>
    </span>
  )
}
