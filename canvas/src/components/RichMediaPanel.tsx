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
  hideUntilReady?: boolean
  headerPassthrough?: boolean
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
  const hideUntilReady = props.hideUntilReady === true
  const headerPassthrough = props.headerPassthrough === true
  const [ready, setReady] = React.useState<boolean>(() => !hideUntilReady)
  React.useEffect(() => {
    setReady(!hideUntilReady)
  }, [hideUntilReady, proxiedUrl, kind, mode])
  const contentInteractive = props.interactive !== false && (!hideUntilReady || ready)

  return (
    <div
      ref={ref}
      className={props.className}
      style={{
        boxSizing: 'border-box',
        overflow: 'hidden',
        contain: 'layout paint',
        isolation: 'isolate',
        borderRadius: 'var(--kg-media-panel-radius, 10px)',
        border: 'var(--kg-media-panel-border-w, 1px) solid var(--kg-border)',
        background: 'var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.92)))',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        willChange: 'left, top, transform, width, height',
        pointerEvents: headerPassthrough ? 'none' : (contentInteractive ? 'auto' : 'none'),
        display: 'flex',
        flexDirection: 'column',
        opacity: hideUntilReady && !ready ? 0 : 1,
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
            background: 'var(--kg-media-panel-header-bg, var(--kg-media-panel-bg, var(--kg-panel-bg, rgba(255,255,255,0.96))))',
            borderBottom: 'var(--kg-media-panel-border-w, 1px) solid var(--kg-border)',
            color: 'var(--kg-text-primary, var(--kg-text))',
            fontSize: 'var(--kg-media-panel-title-size, 12px)',
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: headerPassthrough ? 'none' : 'auto',
          }}
          title={title}
        >
          {title}
        </header>
      ) : null}
      <section
        style={{
          flex: 1,
          padding: 'var(--kg-media-panel-padding, 6px)',
          boxSizing: 'border-box',
          minHeight: 0,
          pointerEvents: headerPassthrough ? (contentInteractive ? 'auto' : 'none') : undefined,
        }}
      >
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
              background: 'transparent',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            onLoad={() => setReady(true)}
          />
        ) : kind === 'video' ? (
          <video
            src={proxiedUrl}
            playsInline
            muted
            controls
            preload="metadata"
            onLoadedData={() => setReady(true)}
            onError={() => setReady(true)}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
              objectFit: 'cover',
              background: 'transparent',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          />
        ) : (
          <img
            src={proxiedUrl}
            alt={title}
            loading="lazy"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
              objectFit: 'cover',
              background: 'transparent',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          />
        )}
      </section>
    </div>
  )
})

export default React.memo(Panel)
