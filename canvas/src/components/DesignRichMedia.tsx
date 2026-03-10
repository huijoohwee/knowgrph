import React from 'react'
import { applyMediaProxySrc } from '@/lib/url'
import RichMediaPanel from '@/components/RichMediaPanel'

export type DesignRichMediaTag = 'IMG' | 'VIDEO' | 'IFRAME'

const stopEvent = (event: React.SyntheticEvent) => {
  try {
    event.stopPropagation()
  } catch {
    void 0
  }
}

const normalizeMediaUrl = (tag: DesignRichMediaTag, rawUrl: string): string => {
  const url = String(rawUrl || '').trim()
  if (!url) return ''
  if (tag === 'VIDEO') return applyMediaProxySrc(url)
  if (/^data:image\//i.test(url)) return url
  return applyMediaProxySrc(url)
}

export function DesignRichMediaPreview(props: {
  tag: DesignRichMediaTag
  url: string
  titleChip: string
  clipId: string
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
    clipId,
    innerX,
    innerY,
    innerW,
    innerH,
    opacity = 0.92,
    showBorder = true,
    interactive = true,
    forwardWheelTo,
    onOverlayPanStart,
    onOverlayPan,
    onOverlayPanEnd,
  } = props

  const normalizedUrl = React.useMemo(() => normalizeMediaUrl(tag, url), [tag, url])

  const titleW = Math.min(innerW, Math.max(64, (titleChip.length + 6) * 6))
  const mediaCorner = 6

  return (
    <g opacity={opacity}>
      {tag === 'IMG' ? (
        <g style={{ pointerEvents: 'none' }}>
          <defs>
            <clipPath id={clipId}>
              <rect x={innerX} y={innerY} width={innerW} height={innerH} rx={mediaCorner} />
            </clipPath>
          </defs>
          <image
            x={innerX}
            y={innerY}
            width={innerW}
            height={innerH}
            href={normalizedUrl}
            crossOrigin="anonymous"
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#${clipId})`}
            opacity={/^data:image\//i.test(normalizedUrl) ? 0.92 : 0.9}
          />
        </g>
      ) : null}

      {tag === 'VIDEO' ? (
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
            kind="video"
            interactive={interactive}
            iframeMode="srcdoc-when-needed"
            showHeader={false}
            forwardWheelTo={forwardWheelTo}
            onOverlayPanStart={onOverlayPanStart}
            onOverlayPan={onOverlayPan}
            onOverlayPanEnd={onOverlayPanEnd}
            style={
              {
                width: '100%',
                height: '100%',
                boxShadow: 'none',
                ['--kg-media-panel-padding' as never]: '0px',
                ['--kg-media-panel-radius' as never]: `${mediaCorner}px`,
              } as React.CSSProperties
            }
          />
        </foreignObject>
      ) : null}

      {tag === 'IFRAME' ? (
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
            interactive={interactive}
            iframeMode="srcdoc-when-needed"
            showHeader={false}
            forwardWheelTo={forwardWheelTo}
            onOverlayPanStart={onOverlayPanStart}
            onOverlayPan={onOverlayPan}
            onOverlayPanEnd={onOverlayPanEnd}
            style={
              {
                width: '100%',
                height: '100%',
                boxShadow: 'none',
                ['--kg-media-panel-padding' as never]: '0px',
                ['--kg-media-panel-radius' as never]: `${mediaCorner}px`,
              } as React.CSSProperties
            }
          />
        </foreignObject>
      ) : null}

      {showBorder && tag === 'IMG' ? (
        <rect
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          rx={mediaCorner}
          fill="rgba(0,0,0,0)"
          stroke="var(--kg-border)"
          strokeWidth={1}
          strokeDasharray="5 4"
          style={{ pointerEvents: 'none' }}
        />
      ) : null}

      <rect
        x={innerX}
        y={innerY}
        width={titleW}
        height={18}
        rx={5}
        fill="var(--kg-panel-bg)"
        stroke="var(--kg-border)"
        strokeWidth={1}
        strokeOpacity={0.7}
        style={{ pointerEvents: 'none' }}
      />
      <text x={innerX + 10} y={innerY + 13} fill="var(--kg-text-tertiary)" fontSize={10} fontWeight={600} style={{ pointerEvents: 'none' }}>
        {titleChip}
      </text>
    </g>
  )
}
