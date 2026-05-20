import React from 'react'
import RichMediaPanel from '@/components/RichMediaPanel'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import { AnchorOverlay } from '@/lib/ui/overlay'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function MarkdownBlockContainerCommentPreviewOverlay(props: {
  show: boolean
  anchorRef: React.RefObject<HTMLSpanElement | null>
  text: string
  onClose: () => void
}) {
  const panel = React.useMemo(
    () => buildStaticRichMediaPanelOverlayState({ activeTab: 'text', text: props.text }),
    [props.text],
  )
  const panelStyle = React.useMemo<React.CSSProperties>(() => ({
    width: '100%',
    height: '100%',
    boxShadow: 'none',
    ['--kg-media-panel-padding' as never]: '0px',
    ['--kg-media-panel-radius' as never]: '8px',
  }), [])
  if (!props.show || !props.text.trim()) return null
  return (
    <AnchorOverlay
      anchorRef={props.anchorRef}
      open
      onClose={props.onClose}
      align="bottom-center"
      autoFocus={false}
      className={[
        'w-[280px] max-w-[calc(100vw-1rem)] overflow-hidden rounded border shadow-lg',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
      ].join(' ')}
    >
      <section
        data-kg-comment-rich-media-preview="1"
        data-kg-canvas-pointer-ignore="true"
        data-kg-canvas-wheel-ignore="true"
        style={{ width: 280, maxWidth: 'calc(100vw - 1rem)', height: 156 }}
      >
        <RichMediaPanel
          title="Comment"
          url=""
          kind="iframe"
          interactive={false}
          panel={panel}
          style={panelStyle}
        />
      </section>
    </AnchorOverlay>
  )
}
