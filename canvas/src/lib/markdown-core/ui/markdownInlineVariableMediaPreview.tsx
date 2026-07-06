import React from 'react'
import {
  buildMarkdownVariableSsotAnchorId,
  collectMarkdownVariableBrowseRows,
} from '@/features/markdown/ui/markdownVariableReferences'
import type { InlineRenderOpts } from '@/features/markdown/ui/MarkdownRendererTypes'
import { isSafeHref, isSafeMediaSrc, resolveHref } from '@/features/markdown/ui/markdownPreviewLinks'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { resolveRenderableMediaResource } from '@/lib/graph/mediaUrlKind'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const normalizePreviewKey = (key: string): string => String(key || '').trim().toLowerCase()

export const buildMarkdownVariablePreviewByKey = (sourceMarkdownText: string): Record<string, { value: string | null }> => {
  const rows = collectMarkdownVariableBrowseRows({ sourceLines: String(sourceMarkdownText || '').split(/\r?\n/), draftText: '' })
  const out: Record<string, { value: string | null }> = {}
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (row?.key) out[normalizePreviewKey(row.key)] = { value: row.value }
  }
  return out
}

function resolveVariableMediaPreview(
  key: string,
  opts: InlineRenderOpts,
): { kind: InlineMediaKind; thumbnailUrl?: string } | null {
  const rawUrl = String(opts.markdownVariablePreviewByKey?.[normalizePreviewKey(key)]?.value || '').trim()
  if (!rawUrl) return null
  const resolvedUrl = resolveHref(rawUrl, opts.activeDocumentPath)
  if (!resolvedUrl || !isSafeHref(resolvedUrl) || !isSafeMediaSrc(resolvedUrl)) return null
  const resource = resolveRenderableMediaResource(resolvedUrl)
  if (!resource || (resource.kind !== 'image' && resource.kind !== 'svg' && resource.kind !== 'video' && resource.kind !== 'audio')) return null
  const kind: InlineMediaKind = resource.kind === 'audio' ? 'audio' : resource.kind === 'video' ? 'video' : 'image'
  const thumbnailUrl = resource.thumbnailUrl || (kind === 'image' ? resource.url : '')
  return { kind, thumbnailUrl: thumbnailUrl || undefined }
}

export function renderMarkdownVariableReferenceChip(args: {
  baseKey: string
  key: string
  raw: string
  opts: InlineRenderOpts
}): React.ReactElement {
  const mediaPreview = resolveVariableMediaPreview(args.key, args.opts)
  return (
    <a
      key={args.baseKey}
      href={`#${buildMarkdownVariableSsotAnchorId(args.key)}`}
      data-kg-var-key={args.key}
      data-kg-var-raw={args.raw}
      className={mediaPreview ? `${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} no-underline` : `${UI_THEME_TOKENS.text.secondary} underline decoration-dotted underline-offset-2`}
    >
      {mediaPreview ? (
        <>
          <InlineMediaCommandThumbnail kind={mediaPreview.kind} thumbnailUrl={mediaPreview.thumbnailUrl} variant="inline" />
          <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{args.key}</span>
        </>
      ) : args.raw}
    </a>
  )
}
