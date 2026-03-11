import React from 'react'
import RichMediaIframe, { type RichMediaIframeMode } from '@/components/RichMediaIframe'
import { applyMediaProxySrc } from '@/lib/url'
import { lockGlobalUserSelect, unlockGlobalUserSelect } from '@/lib/canvas/interaction-user-select'

export type RichMediaPanelProps = {
  title: string
  url: string
  kind?: 'iframe' | 'image' | 'svg' | 'video'
  interactive?: boolean
  iframeMode?: RichMediaIframeMode
  showHeader?: boolean
  hideUntilReady?: boolean
  headerPassthrough?: boolean
  forwardWheelTo?: () => Element | null
  forwardPointerTo?: () => Element | null
  shouldForwardPointerDown?: (e: PointerEvent) => boolean
  shouldStartHeaderDrag?: (e: PointerEvent) => boolean
  onOverlayPanStart?: (args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => void
  onOverlayPan?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number; buttons: number; shiftKey: boolean }) => void
  onOverlayPanEnd?: (args: { pointerId: number; clientX: number; clientY: number; buttons: number; shiftKey: boolean }) => void
  className?: string
  style?: React.CSSProperties
  onHeaderDragStart?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onHeaderDrag?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onHeaderDragEnd?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onPointerDownCapture?: React.PointerEventHandler<HTMLDivElement>
  onPointerUpCapture?: React.PointerEventHandler<HTMLDivElement>
  onWheelCapture?: React.WheelEventHandler<HTMLDivElement>
  onClickCapture?: React.MouseEventHandler<HTMLDivElement>
  onDoubleClickCapture?: React.MouseEventHandler<HTMLDivElement>
  onContextMenuCapture?: React.MouseEventHandler<HTMLDivElement>
}

const Panel = React.forwardRef<HTMLDivElement, RichMediaPanelProps>(function Panel(props, ref) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const headerDragRef = React.useRef<null | { pointerId: number; x0: number; y0: number }>(null)
  const overlayPanRef = React.useRef<null | { pointerId: number; x0: number; y0: number }>(null)
  const title = String(props.title || '').trim() || 'Media node'
  const mode: RichMediaIframeMode = props.iframeMode === 'proxy-url' ? 'proxy-url' : 'srcdoc-when-needed'
  const showHeader = props.showHeader !== false
  const kind: 'iframe' | 'image' | 'svg' | 'video' = props.kind === 'image' || props.kind === 'svg' || props.kind === 'video' ? props.kind : 'iframe'
  const proxiedUrl = React.useMemo(() => applyMediaProxySrc(String(props.url || '').trim()), [props.url])
  const hideUntilReady = props.hideUntilReady === true
  const headerPassthrough = props.headerPassthrough === true
  const forwardingEnabled = typeof props.forwardWheelTo === 'function' || typeof props.forwardPointerTo === 'function'
  const [ready, setReady] = React.useState<boolean>(() => !hideUntilReady)
  React.useEffect(() => {
    setReady(!hideUntilReady)
  }, [hideUntilReady, proxiedUrl, kind, mode])
  const contentInteractive = props.interactive !== false && (!hideUntilReady || ready)
  const setRefs = React.useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el
    const r = ref as unknown
    if (typeof r === 'function') {
      r(el)
      return
    }
    if (r && typeof r === 'object') {
      try {
        ;(r as { current?: unknown }).current = el
      } catch {
        void 0
      }
    }
  }, [ref])

  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if ((e as unknown as { __kgForwarded?: boolean }).__kgForwarded === true) return
      const forwardTo = typeof props.forwardWheelTo === 'function' ? props.forwardWheelTo() : null
      if (forwardTo) {
        try {
          e.preventDefault()
        } catch {
          void 0
        }
        try {
          e.stopPropagation()
        } catch {
          void 0
        }
        try {
          const ev = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaZ: e.deltaZ,
            deltaMode: e.deltaMode,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
          })
          ;(ev as unknown as { __kgForwarded?: boolean }).__kgForwarded = true
          forwardTo.dispatchEvent(ev)
        } catch {
          void 0
        }
        return
      }
      if (e.ctrlKey !== true && e.metaKey !== true) return
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    const handleGesture = (e: Event) => {
      try {
        e.preventDefault()
      } catch {
        void 0
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    el.addEventListener('gesturestart', handleGesture, { passive: false, capture: true } as AddEventListenerOptions)
    el.addEventListener('gesturechange', handleGesture, { passive: false, capture: true } as AddEventListenerOptions)
    el.addEventListener('gestureend', handleGesture, { passive: false, capture: true } as AddEventListenerOptions)
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions)
      el.removeEventListener('gesturestart', handleGesture, { capture: true } as EventListenerOptions)
      el.removeEventListener('gesturechange', handleGesture, { capture: true } as EventListenerOptions)
      el.removeEventListener('gestureend', handleGesture, { capture: true } as EventListenerOptions)
    }
  }, [])

  const installHeaderDrag = props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd

  const onHeaderPointerDown = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!installHeaderDrag) return
    const native = e.nativeEvent
    if (native && typeof props.shouldStartHeaderDrag === 'function') {
      try {
        if (props.shouldStartHeaderDrag(native) !== true) return
      } catch {
        return
      }
    }
    lockGlobalUserSelect()
    const pointerId = e.pointerId
    const x0 = e.clientX
    const y0 = e.clientY
    headerDragRef.current = { pointerId, x0, y0 }
    try {
      props.onHeaderDragStart?.({ pointerId, clientX: x0, clientY: y0 })
    } catch {
      void 0
    }
    try {
      e.preventDefault()
    } catch {
      void 0
    }
    try {
      e.stopPropagation()
    } catch {
      void 0
    }
    const onMove = (ev: PointerEvent) => {
      const s = headerDragRef.current
      if (!s || ev.pointerId !== s.pointerId) return
      const dx = ev.clientX - s.x0
      const dy = ev.clientY - s.y0
      try {
        props.onHeaderDrag?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY, dx, dy })
      } catch {
        void 0
      }
    }
    const onUp = (ev: PointerEvent) => {
      const s = headerDragRef.current
      if (!s || ev.pointerId !== s.pointerId) return
      headerDragRef.current = null
      unlockGlobalUserSelect()
      try {
        props.onHeaderDragEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
      } catch {
        void 0
      }
      try {
        window.removeEventListener('pointermove', onMove, true)
        window.removeEventListener('pointerup', onUp, true)
        window.removeEventListener('pointercancel', onUp, true)
      } catch {
        void 0
      }
    }
    try {
      window.addEventListener('pointermove', onMove, { passive: true, capture: true })
      window.addEventListener('pointerup', onUp, { passive: true, capture: true })
      window.addEventListener('pointercancel', onUp, { passive: true, capture: true })
    } catch {
      void 0
    }
  }, [installHeaderDrag, props])

  const onRootPointerDownCapture = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const native = e.nativeEvent
    const isHeaderTarget = (() => {
      const t = (native as unknown as { target?: unknown }).target
      if (!(t instanceof Element)) return false
      return !!t.closest('[data-kg-media-panel-header="1"]')
    })()
    const installOverlayPan = props.onOverlayPanStart || props.onOverlayPan || props.onOverlayPanEnd
    const allowHeaderOverlayPan = (() => {
      if (!isHeaderTarget) return true
      if (!installHeaderDrag) return true
      if (typeof props.shouldStartHeaderDrag !== 'function') return false
      try {
        return props.shouldStartHeaderDrag(native) !== true
      } catch {
        return false
      }
    })()
    if (allowHeaderOverlayPan && installOverlayPan && native && typeof native === 'object') {
      lockGlobalUserSelect()
      overlayPanRef.current = { pointerId: native.pointerId, x0: native.clientX, y0: native.clientY }
      try {
        props.onOverlayPanStart?.({
          pointerId: native.pointerId,
          clientX: native.clientX,
          clientY: native.clientY,
          buttons: typeof native.buttons === 'number' ? native.buttons : 0,
          shiftKey: native.shiftKey === true,
        })
      } catch {
        void 0
      }
      try {
        native.preventDefault()
      } catch {
        void 0
      }
      try {
        native.stopPropagation()
      } catch {
        void 0
      }
      const onMove = (ev: PointerEvent) => {
        const s = overlayPanRef.current
        if (!s || ev.pointerId !== s.pointerId) return
        const dx = ev.clientX - s.x0
        const dy = ev.clientY - s.y0
        try {
          props.onOverlayPan?.({
            pointerId: ev.pointerId,
            clientX: ev.clientX,
            clientY: ev.clientY,
            dx,
            dy,
            buttons: typeof ev.buttons === 'number' ? ev.buttons : 0,
            shiftKey: ev.shiftKey === true,
          })
        } catch {
          void 0
        }
      }
      const onUp = (ev: PointerEvent) => {
        const s = overlayPanRef.current
        if (!s || ev.pointerId !== s.pointerId) return
        overlayPanRef.current = null
        unlockGlobalUserSelect()
        try {
          props.onOverlayPanEnd?.({
            pointerId: ev.pointerId,
            clientX: ev.clientX,
            clientY: ev.clientY,
            buttons: typeof ev.buttons === 'number' ? ev.buttons : 0,
            shiftKey: ev.shiftKey === true,
          })
        } catch {
          void 0
        }
        try {
          window.removeEventListener('pointermove', onMove, true)
          window.removeEventListener('pointerup', onUp, true)
          window.removeEventListener('pointercancel', onUp, true)
        } catch {
          void 0
        }
      }
      try {
        window.addEventListener('pointermove', onMove, { passive: true, capture: true })
        window.addEventListener('pointerup', onUp, { passive: true, capture: true })
        window.addEventListener('pointercancel', onUp, { passive: true, capture: true })
      } catch {
        void 0
      }
      return
    }
    if (!(isHeaderTarget && installHeaderDrag)) {
      try {
        props.onPointerDownCapture?.(e)
      } catch {
        void 0
      }
    }
  }, [props])

  return (
    <div
      ref={setRefs}
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
      onPointerDownCapture={onRootPointerDownCapture}
      onPointerUpCapture={props.onPointerUpCapture}
      onWheelCapture={props.onWheelCapture}
      onClickCapture={props.onClickCapture}
      onDoubleClickCapture={props.onDoubleClickCapture}
      onContextMenuCapture={props.onContextMenuCapture}
    >
      {showHeader ? (
        <header
          data-kg-media-panel-header="1"
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
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            cursor: installHeaderDrag ? 'grab' : undefined,
            pointerEvents: headerPassthrough ? 'none' : 'auto',
          }}
          onPointerDownCapture={e => {
            try {
              e.preventDefault()
            } catch {
              void 0
            }
          }}
          title={title}
          onPointerDown={installHeaderDrag ? onHeaderPointerDown : undefined}
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
              pointerEvents: forwardingEnabled ? 'none' : undefined,
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
              pointerEvents: forwardingEnabled ? 'none' : undefined,
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
              pointerEvents: forwardingEnabled ? 'none' : undefined,
            }}
          />
        )}
      </section>
    </div>
  )
})

export default React.memo(Panel)
