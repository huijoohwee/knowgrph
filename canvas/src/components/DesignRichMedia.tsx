import React from 'react'
import { applyMediaProxySrc } from '@/lib/url'
import { buildIframeSrcDocForUrl, buildWebpageProxyUrl, isIframeDirectEmbedUrl } from '@/lib/render/richMediaEmbed'

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
  if (tag === 'IFRAME') return buildWebpageProxyUrl(url)
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
  } = props

  const normalizedUrl = React.useMemo(() => normalizeMediaUrl(tag, url), [tag, url])
  const [iframeSrcDoc, setIframeSrcDoc] = React.useState<string>('')

  React.useEffect(() => {
    if (tag !== 'IFRAME') return
    const raw = String(url || '').trim()
    if (!raw || isIframeDirectEmbedUrl(raw)) {
      setIframeSrcDoc('')
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    void (async () => {
      try {
        const { srcDoc } = await buildIframeSrcDocForUrl({ url: raw, signal: ctrl.signal })
        if (cancelled) return
        setIframeSrcDoc(srcDoc)
      } catch {
        if (cancelled) return
        setIframeSrcDoc('')
      }
    })()
    return () => {
      cancelled = true
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
  }, [tag, url])

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
          onPointerDownCapture={stopEvent}
          onPointerUpCapture={stopEvent}
          onWheelCapture={stopEvent}
          onClickCapture={stopEvent}
          onDoubleClickCapture={stopEvent}
          onContextMenuCapture={stopEvent}
        >
          <section
            style={{
              width: '100%',
              height: '100%',
              borderRadius: `${mediaCorner}px`,
              overflow: 'hidden',
              background: 'transparent',
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          >
            <video
              src={normalizedUrl}
              playsInline
              muted
              controls
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </section>
        </foreignObject>
      ) : null}

      {tag === 'IFRAME' ? (
        <foreignObject
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          style={{ overflow: 'hidden', pointerEvents: interactive ? 'auto' : 'none' }}
          onPointerDownCapture={stopEvent}
          onPointerUpCapture={stopEvent}
          onWheelCapture={stopEvent}
          onClickCapture={stopEvent}
          onDoubleClickCapture={stopEvent}
          onContextMenuCapture={stopEvent}
        >
          <section
            style={{
              width: '100%',
              height: '100%',
              borderRadius: `${mediaCorner}px`,
              overflow: 'hidden',
              background: 'transparent',
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          >
            <iframe
              src={iframeSrcDoc ? undefined : normalizedUrl}
              srcDoc={iframeSrcDoc || undefined}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox={iframeSrcDoc ? 'allow-scripts allow-presentation' : 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </section>
        </foreignObject>
      ) : null}

      {showBorder ? (
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
