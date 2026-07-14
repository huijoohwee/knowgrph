import React from 'react'
import { CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME } from '@/lib/cards/cardMarkdownPreviewUtils'
import { readCardInlineTextProjectedMediaChipPresentation } from '@/lib/cards/cardInlineTextProjectedMediaChipPresentation'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { TextareaInvocationProjectedMediaChip } from '@/lib/ui/textareaInvocationProjection'

export function CardInlineTextProjectedMediaChip(props: {
  chip: TextareaInvocationProjectedMediaChip
  index: number
}) {
  const { chip, index } = props
  const presentation = readCardInlineTextProjectedMediaChipPresentation(chip)
  return (
    <span
      className={presentation.className}
      data-kg-card-inline-display-media-chip="1"
      data-kg-card-inline-display-media-index={index}
      data-kg-card-inline-display-media-virtual={chip.virtual ? '1' : undefined}
      data-kg-chat-input-media-chip="1"
      data-kg-chat-input-media-source={presentation.source || undefined}
      data-kg-chat-input-media-token={chip.displayLabel}
      title={presentation.title}
    >
      <span
        aria-label={presentation.mediaLabel}
        className="inline-flex"
        data-kg-card-inline-display-media-thumbnail="1"
      >
        <InlineMediaCommandThumbnail
          kind={chip.mediaKind}
          thumbnailUrl={presentation.thumbnailUrl || undefined}
          variant="inline"
        />
      </span>
      <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{chip.displayLabel}</span>
    </span>
  )
}
