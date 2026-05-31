import React from 'react'
import RichMediaPanel from '@/components/RichMediaPanel'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'

export type StaticRichMediaPanelPreviewTag = 'IMG' | 'VIDEO' | 'IFRAME'

const stopEvent = (event: React.SyntheticEvent) => {
  try {
    event.stopPropagation()
  } catch {
    void 0
  }
}

export function StaticRichMediaPanelPreview(props: {
  tag: StaticRichMediaPanelPreviewTag
  url: string
  titleChip: string
  innerX: number
  innerY: number
  innerW: number
  innerH: number
  opacity?: number
  showBorder?: boolean
  interactive?: boolean
  forwardWheelTo?: () => Element | null
  onOverlayPanStart?: (args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => void
  onOverlayPan?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => void
  onOverlayPanEnd?: (args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => void
}) {
  const {
    tag,
    url,
    titleChip,
    innerX,
    innerY,
    innerW,
    innerH,
    opacity = 0.92,
    interactive = true,
    forwardWheelTo,
    onOverlayPanStart,
    onOverlayPan,
    onOverlayPanEnd,
  } = props

  const mediaCorner = 6
  const kind = tag === 'IMG' ? 'image' : tag === 'VIDEO' ? 'video' : 'iframe'
  const panel = React.useMemo(
    () => buildStaticRichMediaPanelOverlayState({ renderKind: kind }),
    [kind],
  )
  const panelStyle = {
    width: '100%',
    height: '100%',
    boxShadow: 'none',
    ['--kg-media-panel-padding' as never]: '0px',
    ['--kg-media-panel-radius' as never]: `${mediaCorner}px`,
  } as React.CSSProperties

  return (
    <g opacity={opacity}>
      {!interactive && String(url || '').trim() ? (
        <rect
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          rx={mediaCorner}
          fill="rgba(0,0,0,0)"
          style={{ cursor: 'pointer' }}
          onPointerDown={stopEvent}
          onPointerMove={stopEvent}
          onPointerUp={stopEvent}
          onClick={(event) => {
            stopEvent(event)
            try {
              const openUrl = String(url || '').trim()
              if (!openUrl) return
              if (typeof window === 'undefined') return
              window.open(openUrl, '_blank', 'noopener,noreferrer')
            } catch {
              void 0
            }
          }}
        />
      ) : null}

      <foreignObject
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        style={{ overflow: 'hidden', pointerEvents: interactive ? 'auto' : 'none' }}
      >
        <RichMediaPanel
          title={titleChip}
          url={url}
          openUrl={url}
          kind={kind}
          panelChrome="flowEditor"
          interactive={interactive}
          panel={panel}
          forwardWheelTo={forwardWheelTo}
          onOverlayPanStart={onOverlayPanStart}
          onOverlayPan={onOverlayPan}
          onOverlayPanEnd={onOverlayPanEnd}
          style={panelStyle}
        />
      </foreignObject>
    </g>
  )
}
