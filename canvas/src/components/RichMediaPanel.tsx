import React from 'react'
import RichMediaIframe, { type RichMediaIframeMode } from '@/components/RichMediaIframe'
import { applyMediaProxySrc } from '@/lib/url'

export type RichMediaPanelProps = {
  title: string
  url: string
  kind?: 'iframe' | 'image' | 'svg' | 'video'
  interactive?: boolean
  iframeMode?: RichMediaIframeMode
  showHeader?: boolean
  className?: string
  style?: React.CSSProperties
  onPointerDownCapture?: React.PointerEventHandler<HTMLDivElement>
  onPointerUpCapture?: React.PointerEventHandler<HTMLDivElement>
  onWheelCapture?: React.WheelEventHandler<HTMLDivElement>
  onClickCapture?: React.MouseEventHandler<HTMLDivElement>
  onDoubleClickCapture?: React.MouseEventHandler<HTMLDivElement>
  onContextMenuCapture?: React.MouseEventHandler<HTMLDivElement>
}

const Panel = React.forwardRef<HTMLDivElement, RichMediaPanelProps>(function Panel(props, ref) {
  const title = String(props.title || '').trim() || 'Media node'
  const mode: RichMediaIframeMode = props.iframeMode === 'proxy-url' ? 'proxy-url' : 'srcdoc-when-needed'
  const showHeader = props.showHeader !== false
  const kind: 'iframe' | 'image' | 'svg' | 'video' = props.kind === 'image' || props.kind === 'svg' || props.kind === 'video' ? props.kind : 'iframe'
  const proxiedUrl = React.useMemo(() => applyMediaProxySrc(String(props.url || '').trim()), [props.url])

  return (
    <div
      ref={ref}
      className={props.className}
      style={{
        boxSizing: 'border-box',
        overflow: 'hidden',
        borderRadius: 'var(--kg-media-panel-radius, 10px)',
        border: 'var(--kg-media-panel-border-w, 1px) solid var(--kg-border)',
        background: 'var(--kg-panel-bg, rgba(255,255,255,0.92))',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        pointerEvents: props.interactive === false ? 'none' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        ...(props.style || null),
      }}
      onPointerDownCapture={props.onPointerDownCapture}
      onPointerUpCapture={props.onPointerUpCapture}
      onWheelCapture={props.onWheelCapture}
      onClickCapture={props.onClickCapture}
      onDoubleClickCapture={props.onDoubleClickCapture}
      onContextMenuCapture={props.onContextMenuCapture}
    >
      {showHeader ? (
        <header
          aria-hidden={true}
          style={{
            height: 'var(--kg-media-panel-header-h, 28px)',
            minHeight: 'var(--kg-media-panel-header-h, 28px)',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 'var(--kg-media-panel-padding, 6px)',
            paddingRight: 'var(--kg-media-panel-padding, 6px)',
            background: 'var(--kg-panel-bg, rgba(255,255,255,0.96))',
            borderBottom: 'var(--kg-media-panel-border-w, 1px) solid var(--kg-border)',
            color: 'var(--kg-text-primary, var(--kg-text))',
            fontSize: 'var(--kg-media-panel-title-size, 12px)',
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={title}
        >
          {title}
        </header>
      ) : null}
      <section style={{ flex: 1, padding: 'var(--kg-media-panel-padding, 6px)', boxSizing: 'border-box', minHeight: 0 }}>
        {kind === 'iframe' ? (
          <RichMediaIframe
            title={title}
            url={props.url}
            mode={mode}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
            }}
          />
        ) : kind === 'video' ? (
          <video
            src={proxiedUrl}
            playsInline
            muted
            controls
            preload="metadata"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
              objectFit: 'cover',
              background: 'transparent',
            }}
          />
        ) : (
          <img
            src={proxiedUrl}
            alt={title}
            loading="lazy"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
              objectFit: 'cover',
              background: 'transparent',
            }}
          />
        )}
      </section>
    </div>
  )
})

export default React.memo(Panel)
