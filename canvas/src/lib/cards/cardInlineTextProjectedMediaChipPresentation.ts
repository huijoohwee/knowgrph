import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { normalizeRuntimeStorageMediaAccessUrl } from '@/lib/storage/runtimeMediaUrl'
import { CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME } from '@/lib/cards/cardMarkdownPreviewUtils'

export const CARD_INLINE_TEXT_PROJECTED_MEDIA_CHIP_CLASS_NAME =
  `inline-flex bg-[color:var(--kg-panel-bg)] ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME}`

export function readCardInlineTextProjectedMediaChipPresentation(chip: {
  displayLabel: string
  mediaKind: InlineMediaKind
  sourceUrl?: string
  thumbnailUrl?: string
}): {
  className: string
  label: string
  mediaLabel: string
  source: string
  thumbnailUrl: string
  title: string
} {
  const source = String(chip.sourceUrl || chip.thumbnailUrl || '').trim()
  const label = String(chip.displayLabel || '').trim().replace(/^@+/, '')
  const thumbnailSource = String(chip.thumbnailUrl || (chip.mediaKind === 'image' ? chip.sourceUrl : '') || '').trim()
  const thumbnailUrl = normalizeRuntimeStorageMediaAccessUrl({ url: thumbnailSource })
  return {
    className: CARD_INLINE_TEXT_PROJECTED_MEDIA_CHIP_CLASS_NAME,
    label,
    mediaLabel: `${chip.mediaKind} media`,
    source,
    thumbnailUrl,
    title: [
      `${label} - ${chip.mediaKind}`,
      source ? `Source: ${source}` : '',
    ].filter(Boolean).join('\n'),
  }
}
