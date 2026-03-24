import React from 'react'
import RichMediaIframe, { type RichMediaIframeMode } from '@/components/RichMediaIframe'
import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'
import { applyImageLikeProxySrc } from '@/lib/url'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { resolveIframeEmbed, resolveIframeSandbox, shouldForceSnapshotIframeUrl } from 'grph-shared/rich-media/iframe'
import { getOrCreateVideoThumbnail } from 'grph-shared/rich-media/videoThumbnail'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ExternalLink } from 'lucide-react'
import {
  PANEL_FRAME_BODY_STYLE,
  PANEL_FRAME_HEADER_ACTION_STYLE,
  PANEL_FRAME_HEADER_STYLE,
  PANEL_FRAME_HEADER_TITLE_STYLE,
  PANEL_FRAME_ROOT_STYLE,
} from '@/lib/ui/panelFrame'

export type RichMediaPanelProps = {
  overlayId?: string
  title: string
  url: string
  srcDoc?: string
  openUrl?: string
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

const Panel = React.forwardRef<HTMLElement, RichMediaPanelProps>(function Panel(props, ref) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const title = String(props.title || '').trim() || 'Media node'
  const mode: RichMediaIframeMode = props.iframeMode === 'proxy-url' ? 'proxy-url' : 'srcdoc-when-needed'
  const showHeader = props.showHeader !== false
  const kind: 'iframe' | 'image' | 'svg' | 'video' = props.kind === 'image' || props.kind === 'svg' || props.kind === 'video' ? props.kind : 'iframe'
  const rawUrl = String(props.url || '').trim()
  const openUrl = String(props.openUrl || '').trim() || rawUrl
  const safeOpenUrl = React.useMemo(() => {
    const raw = String(openUrl || '').trim()
    if (!raw) return ''
    try {
      const base = typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string' ? window.location.origin : 'http://localhost'
      const u = new URL(raw, base)
      const proto = String(u.protocol || '').toLowerCase()
      if (proto === 'http:' || proto === 'https:' || proto === 'mailto:' || proto === 'tel:') return u.toString()
      return ''
    } catch {
      return ''
    }
  }, [openUrl])
  const openSafeUrl = React.useCallback(() => {
    if (!safeOpenUrl) return
    try {
      window.open(safeOpenUrl, '_blank', 'noopener,noreferrer')
    } catch {
      void 0
    }
  }, [safeOpenUrl])
  const proxiedUrl = React.useMemo(() => {
    if (kind === 'iframe') return rawUrl
    return applyImageLikeProxySrc(rawUrl)
  }, [kind, rawUrl])

  const iframeEmbed = React.useMemo(() => {
    if (kind !== 'iframe') return null
    return resolveIframeEmbed({ url: rawUrl })
  }, [kind, rawUrl])

  const inlineSrcDoc = React.useMemo(() => {
    if (kind !== 'iframe') return ''
    const s = typeof props.srcDoc === 'string' ? props.srcDoc.trim() : ''
    return s
  }, [kind, props.srcDoc])

  const forceSnapshotIframe = React.useMemo(() => {
    if (kind !== 'iframe') return false
    return shouldForceSnapshotIframeUrl(rawUrl)
  }, [kind, rawUrl])
  const [mediaSrc, setMediaSrc] = React.useState<string>(proxiedUrl)
  React.useEffect(() => {
    setMediaSrc(proxiedUrl)
  }, [proxiedUrl])
  const hideUntilReady = props.hideUntilReady === true
  const headerPassthrough = props.headerPassthrough === true
  const richMediaPanelMode = useGraphStore(s => s.richMediaPanelMode)
  const preferEmbed = richMediaPanelMode === 'embed'
  const [videoThumb, setVideoThumb] = React.useState<string>('')
  const forwardingEnabled =
    !preferEmbed && (typeof props.forwardWheelTo === 'function' || typeof props.forwardPointerTo === 'function')
  const [ready, setReady] = React.useState<boolean>(() => !hideUntilReady)
  React.useEffect(() => {
    setReady(!hideUntilReady)
  }, [hideUntilReady, proxiedUrl, kind, mode])
  React.useEffect(() => {
    if (!hideUntilReady) return
    if (ready) return
    const t = window.setTimeout(() => {
      setReady(true)
    }, 1400)
    return () => {
      window.clearTimeout(t)
    }
  }, [hideUntilReady, ready, proxiedUrl, kind, mode])
  const fallbackToRawSrc = React.useCallback(() => {
    if (!rawUrl || rawUrl === mediaSrc) return false
    setMediaSrc(rawUrl)
    return true
  }, [mediaSrc, rawUrl])
  const isSnapshotIframe =
    kind === 'iframe'
    && !!(iframeEmbed && !iframeEmbed.direct)
    && (!preferEmbed || forceSnapshotIframe)
  const isSnapshotVideo = !preferEmbed && kind === 'video'
  const isSnapshotStaticMedia = !preferEmbed && (kind === 'image' || kind === 'svg' || kind === 'video')
  const contentInteractive =
    (preferEmbed || (props.interactive !== false && !isSnapshotIframe && !isSnapshotVideo && !isSnapshotStaticMedia))
    && (!hideUntilReady || ready)
  const canClickToOpen = !headerPassthrough && !contentInteractive && !!safeOpenUrl

  React.useEffect(() => {
    let cancelled = false
    if (!isSnapshotVideo) {
      setVideoThumb(prev => (prev ? '' : prev))
      return
    }
    const u = rawUrl
    if (!u) return
    void getOrCreateVideoThumbnail(u).then((t) => {
      if (cancelled) return
      const next = String(t || '').trim()
      setVideoThumb(prev => (prev === next ? prev : next))
    })
    return () => {
      cancelled = true
    }
  }, [isSnapshotVideo, rawUrl])
  const setRefs = React.useCallback((el: HTMLElement | null) => {
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

    return installWheelForwardingAndBrowserZoomGuards(el, {
      forwardWheelTo: forwardingEnabled && typeof props.forwardWheelTo === 'function' ? props.forwardWheelTo : undefined,
      stopPropagationOnForward: true,
      stopPropagationOnPreventZoom: false,
      forwardedFlagKey: '__kgForwarded',
    })
  }, [forwardingEnabled, props.forwardWheelTo])

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
    try {
      const st = useGraphStore.getState() as unknown as { selectNode?: (id: string | null) => void; selectEdge?: (id: string | null) => void; setSelectionSource?: (src: string) => void }
      st.setSelectionSource?.('canvas')
      st.selectEdge?.(null)
      st.selectNode?.(null)
    } catch {
      void 0
    }
    const pointerId = native.pointerId
    const x0 = native.clientX
    const y0 = native.clientY
    const thresholdSq = 7 * 7
    let moved = false
    try {
      props.onHeaderDragStart?.({ pointerId, clientX: x0, clientY: y0 })
    } catch {
      void 0
    }

    startPointerDrag({
      ev: native,
      cursor: 'grabbing',
      onMove: ev => {
        const dx = ev.clientX - x0
        const dy = ev.clientY - y0
        if (!moved && dx * dx + dy * dy > thresholdSq) moved = true
        try {
          props.onHeaderDrag?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY, dx, dy })
        } catch {
          void 0
        }
      },
      onEnd: ev => {
        try {
          props.onHeaderDragEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
        } catch {
          void 0
        }
      },
      onCancel: ev => {
        try {
          props.onHeaderDragEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
        } catch {
          void 0
        }
      },
    })
  }, [installHeaderDrag, props, safeOpenUrl])
  const onHeaderActionPointerDownCapture = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    try {
      e.stopPropagation()
    } catch {
      void 0
    }
  }, [])
  const onHeaderActionClick = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
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
    openSafeUrl()
  }, [openSafeUrl])

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
      const pointerId = native.pointerId
      const x0 = native.clientX
      const y0 = native.clientY
      try {
        const st = useGraphStore.getState() as unknown as { selectNode?: (id: string | null) => void; selectEdge?: (id: string | null) => void; setSelectionSource?: (src: string) => void }
        st.setSelectionSource?.('canvas')
        st.selectEdge?.(null)
        st.selectNode?.(null)
      } catch {
        void 0
      }
      try {
        props.onOverlayPanStart?.({
          pointerId,
          clientX: x0,
          clientY: y0,
          buttons: typeof native.buttons === 'number' ? native.buttons : 0,
          shiftKey: native.shiftKey === true,
        })
      } catch {
        void 0
      }

      startPointerDrag({
        ev: native,
        cursor: 'grabbing',
        onMove: ev => {
          const dx = ev.clientX - x0
          const dy = ev.clientY - y0
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
        },
        onEnd: ev => {
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
        },
        onCancel: ev => {
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
        },
      })
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
    <article
      ref={setRefs}
      className={['kg-media', props.className].filter(Boolean).join(' ')}
      data-kg-rich-media-panel="1"
      data-node-id={props.overlayId}
      data-kg-kind={kind}
      data-kg-url={rawUrl}
      data-kg-open-url={openUrl}
      data-kg-canvas-pointer-ignore="true"
      style={{
        ...PANEL_FRAME_ROOT_STYLE,
        pointerEvents: hideUntilReady && !ready ? 'none' : (headerPassthrough ? 'none' : ((contentInteractive || canClickToOpen) ? 'auto' : 'none')),
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
          className="kg-mediaHeader"
          style={{
            ...PANEL_FRAME_HEADER_STYLE,
            borderBottom: 'var(--kg-media-panel-border-w, 1px) solid var(--kg-border)',
            cursor: installHeaderDrag ? 'grab' : undefined,
            pointerEvents: headerPassthrough ? 'none' : 'auto',
          }}
          onPointerDownCapture={e => {
            const target = e.target
            if (target instanceof Element && target.closest('[data-kg-panel-action="1"]')) return
            try {
              e.preventDefault()
            } catch {
              void 0
            }
          }}
          title={title}
          onPointerDown={installHeaderDrag ? onHeaderPointerDown : undefined}
        >
          <h3 className="kg-mediaTitle" style={PANEL_FRAME_HEADER_TITLE_STYLE}>{title}</h3>
          <menu className="m-0 p-0 list-none flex items-center gap-1" aria-label="Panel actions">
            {safeOpenUrl ? (
              <li className="list-none">
                <button
                  type="button"
                  data-kg-panel-action="1"
                  aria-label="Open source"
                  style={PANEL_FRAME_HEADER_ACTION_STYLE}
                  onPointerDownCapture={onHeaderActionPointerDownCapture}
                  onClick={onHeaderActionClick}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                </button>
              </li>
            ) : null}
          </menu>
        </header>
      ) : null}
      <section
        className="kg-mediaBody"
        style={{
          ...PANEL_FRAME_BODY_STYLE,
          pointerEvents: headerPassthrough ? (contentInteractive ? 'auto' : 'none') : undefined,
        }}
      >
        {canClickToOpen ? (
          <a
            href={safeOpenUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={title}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'block',
              pointerEvents: 'auto',
              textDecoration: 'none',
              background: 'transparent',
              cursor: 'pointer',
              touchAction: 'none',
            }}
            onPointerDownCapture={e => {
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
            }}
            onClick={e => {
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
              openSafeUrl()
            }}
          />
        ) : null}
        {kind === 'iframe' ? (
          inlineSrcDoc ? (
            <iframe
              src="about:blank"
              srcDoc={inlineSrcDoc}
              title={title}
              allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              sandbox={resolveIframeSandbox('proxied')}
              referrerPolicy="no-referrer"
              loading="lazy"
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
                touchAction: 'auto',
              }}
              onLoad={() => setReady(true)}
            />
          ) : (
          iframeEmbed && !iframeEmbed.direct && (!preferEmbed || forceSnapshotIframe) ? (
            <WebpageSnapshotPreview
              url={proxiedUrl}
              title={title}
              className="w-full h-full"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                border: 0,
                borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
                overflow: 'hidden',
                background: 'transparent',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                pointerEvents: forwardingEnabled ? 'none' : undefined,
              }}
            />
          ) : (
            <RichMediaIframe
              title={title}
              url={proxiedUrl}
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
                touchAction: 'auto',
              }}
              onLoad={() => setReady(true)}
            />
          )
          )
        ) : kind === 'video' ? (
          preferEmbed ? (
            <video
              src={mediaSrc}
              playsInline
              muted
              controls
              preload="metadata"
              onLoadedData={() => setReady(true)}
              onError={() => {
                if (!fallbackToRawSrc()) setReady(true)
              }}
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
              src={videoThumb || undefined}
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
          )
        ) : (
          <img
            src={mediaSrc}
            alt={title}
            loading="lazy"
            onLoad={() => setReady(true)}
            onError={() => {
              if (!fallbackToRawSrc()) setReady(true)
            }}
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
    </article>
  )
})

export default React.memo(Panel)
