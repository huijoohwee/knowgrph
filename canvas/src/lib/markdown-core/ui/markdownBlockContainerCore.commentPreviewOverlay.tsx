import React from 'react'
import { StaticRichMediaPanelTextAnchorOverlay } from '@/lib/ui/StaticRichMediaPanelTextAnchorOverlay'

export function MarkdownBlockContainerCommentPreviewOverlay(props: {
  show: boolean
  anchorRef: React.RefObject<HTMLSpanElement | null>
  text: string
  onClose: () => void
}) {
  return (
    <StaticRichMediaPanelTextAnchorOverlay
      show={props.show}
      anchorRef={props.anchorRef}
      onClose={props.onClose}
      text={props.text}
      title="Comment"
      widthPx={280}
      heightPx={156}
      containerProps={{ 'data-kg-comment-rich-media-preview': '1' }}
    />
  )
}
