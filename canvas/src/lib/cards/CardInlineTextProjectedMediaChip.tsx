import React from 'react'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { TextareaInvocationProjectedMediaChip } from '@/lib/ui/textareaInvocationProjection'

export function CardInlineTextProjectedMediaChip(props: {
  chip: TextareaInvocationProjectedMediaChip
  index: number
}) {
  const { chip, index } = props
  const source = chip.sourceUrl || chip.thumbnailUrl || ''
  const title = [
    `${chip.displayLabel} - ${chip.mediaKind}`,
    source ? `Source: ${source}` : '',
  ].filter(Boolean).join('\n')
  return (
    <span
      className={`inline-flex bg-[color:var(--kg-panel-bg)] ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME}`}
      data-kg-card-inline-display-media-chip="1"
      data-kg-card-inline-display-media-index={index}
      data-kg-card-inline-display-media-virtual={chip.virtual ? '1' : undefined}
      data-kg-chat-input-media-chip="1"
      data-kg-chat-input-media-source={source || undefined}
      data-kg-chat-input-media-token={chip.displayLabel}
      title={title}
    >
      <span
        aria-label={`${chip.mediaKind} media`}
        className="inline-flex"
        data-kg-card-inline-display-media-thumbnail="1"
      >
        <InlineMediaCommandThumbnail
          kind={chip.mediaKind}
          thumbnailUrl={chip.thumbnailUrl || (chip.mediaKind === 'image' ? chip.sourceUrl : undefined)}
          variant="inline"
        />
      </span>
      <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{chip.displayLabel}</span>
    </span>
  )
}
