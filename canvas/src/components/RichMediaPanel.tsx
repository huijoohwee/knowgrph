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
  resizable?: boolean
  forwardWheelTo?: () => Element | null
  forwardPointerTo?: () => Element | null
  shouldForwardPointerDown?: (e: PointerEvent) => boolean
  shouldStartHeaderDrag?: (e: PointerEvent) => boolean
  onResizeStart?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onResize?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onResizeEnd?: (args: { pointerId: number; clientX: number; clientY: number }) => void
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
  panel?: {
    activeTab: 'auto' | 'text' | 'image' | 'video'
    freezeConnectedOutput: boolean
    hasText: boolean
    hasImage: boolean
    hasVideo: boolean
    text: string
    connectedText: string
  }
  onPanelChange?: (next: { activeTab: 'auto' | 'text' | 'image' | 'video'; freezeConnectedOutput: boolean; text?: string }) => void
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

  const isEmptyPanel = kind === 'iframe' && !rawUrl && !inlineSrcDoc

  const panel = props.panel || null
  const panelActiveTab = panel ? panel.activeTab : 'auto'
  const panelFreezeConnectedOutput = panel ? panel.freezeConnectedOutput : false
  const panelHasMultiKinds = panel ? Boolean(panel.hasText && (panel.hasImage || panel.hasVideo)) : false
  const panelSelectedTab: 'text' | 'image' | 'video' | null =
    panelActiveTab === 'text' || panelActiveTab === 'image' || panelActiveTab === 'video'
      ? panelActiveTab
      : panelActiveTab === 'auto'
        ? kind === 'video'
          ? 'video'
          : kind === 'image' || kind === 'svg'
            ? 'image'
            : kind === 'iframe' && !rawUrl
              ? 'text'
              : null
        : null
  const showPanelControls = Boolean(panel && panelHasMultiKinds)
  const showTextEditor = Boolean(panel && panelSelectedTab === 'text' && panelFreezeConnectedOutput)
  const [panelDraftText, setPanelDraftText] = React.useState<string>('')
  React.useEffect(() => {
    if (!panel) {
      setPanelDraftText('')
      return
    }
    if (panelSelectedTab !== 'text') return
    const base = panelFreezeConnectedOutput ? panel.text : (panel.connectedText || panel.text)
    setPanelDraftText(prev => (prev === base ? prev : base))
  }, [panel, panelFreezeConnectedOutput, panelSelectedTab])

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
  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const isFlowEditorRenderer = useGraphStore(s => String(s.canvas2dRenderer || '') === 'flowEditor')
  const flowEditorFrontmatterDocumentMode = useGraphStore(s => {
    if (String(s.canvas2dRenderer || '') !== 'flowEditor') return false
    if (s.frontmatterModeEnabled !== true) return false
    return String(s.documentSemanticMode || '').trim().toLowerCase() === 'document'
  })
  const panelControlsHidden = isFlowEditorRenderer !== true
  const editorMode = workspaceViewMode === 'editor'
  const allowEmbedFromStore = richMediaPanelMode === 'embed' || infiniteCanvasInteractionMode === 'interactive'
  const preferEmbed = allowEmbedFromStore && props.interactive !== false
  const [videoThumb, setVideoThumb] = React.useState<string>('')
  const forwardingEnabled =
    !preferEmbed
    && flowEditorFrontmatterDocumentMode !== true
    && (typeof props.forwardWheelTo === 'function' || typeof props.forwardPointerTo === 'function')
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

  React.useEffect(() => {
    if (!isEmptyPanel) return
    setReady(true)
  }, [isEmptyPanel])
  const installOverlayPan = props.onOverlayPanStart || props.onOverlayPan || props.onOverlayPanEnd
  const installHeaderDrag = props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd
  const installResize = props.resizable === true && (!!props.onResizeStart || !!props.onResize || !!props.onResizeEnd)
  const canvasOverlayProxyEnabled =
    !!installOverlayPan
    || !!installHeaderDrag
    || typeof props.forwardWheelTo === 'function'
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
  const allowClickToOpenOverlay = canClickToOpen && !editorMode

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

  const selectSelf = React.useCallback((native: PointerEvent | null) => {
    if (!flowEditorFrontmatterDocumentMode) return
    const id = String(props.overlayId || '').trim()
    if (!id) return
    if (native && native.button !== 0) return
    try {
      const st = useGraphStore.getState() as unknown as {
        selectNode?: (id: string | null) => void
        selectEdge?: (id: string | null) => void
        setSelectionSource?: (src: string) => void
      }
      st.setSelectionSource?.('canvas')
      st.selectEdge?.(null)
      st.selectNode?.(id)
    } catch {
      void 0
    }
  }, [flowEditorFrontmatterDocumentMode, props.overlayId])

  const onResizePointerDown = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!installResize) return
    if (e.button !== 0) return
    selectSelf(e.nativeEvent)
    try {
      e.preventDefault()
      e.stopPropagation()
    } catch {
      void 0
    }
    const native = e.nativeEvent
    const pointerId = native.pointerId
    const x0 = native.clientX
    const y0 = native.clientY
    try {
      props.onResizeStart?.({ pointerId, clientX: x0, clientY: y0 })
    } catch {
      void 0
    }
    startPointerDrag({
      ev: native,
      cursor: 'nwse-resize',
      onMove: ev => {
        try {
          props.onResize?.({
            pointerId: ev.pointerId,
            clientX: ev.clientX,
            clientY: ev.clientY,
            dx: ev.clientX - x0,
            dy: ev.clientY - y0,
          })
        } catch {
          void 0
        }
      },
      onEnd: ev => {
        try {
          props.onResizeEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
        } catch {
          void 0
        }
      },
      onCancel: ev => {
        try {
          props.onResizeEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
        } catch {
          void 0
        }
      },
    })
  }, [installResize, props, selectSelf])

  const onHeaderPointerDown = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!installHeaderDrag) return
    const native = e.nativeEvent
    selectSelf(native)
    if (native && typeof props.shouldStartHeaderDrag === 'function') {
      try {
        if (props.shouldStartHeaderDrag(native) !== true) return
      } catch {
        return
      }
    }
    const pointerId = native.pointerId
    const x0 = native.clientX
    const y0 = native.clientY
    try {
      props.onHeaderDragStart?.({ pointerId, clientX: x0, clientY: y0 })
    } catch {
      void 0
    }

    startPointerDrag({
      ev: native,
      cursor: 'grabbing',
      onMove: ev => {
        try {
          props.onHeaderDrag?.({
            pointerId: ev.pointerId,
            clientX: ev.clientX,
            clientY: ev.clientY,
            dx: ev.clientX - x0,
            dy: ev.clientY - y0,
          })
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
  }, [installHeaderDrag, props, selectSelf])
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
    selectSelf(native)
    const isHeaderTarget = (() => {
      const t = (native as unknown as { target?: unknown }).target
      if (!(t instanceof Element)) return false
      return !!t.closest('[data-kg-media-panel-header="1"]')
    })()
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
    const allowPointerButtons = (() => {
      const b = typeof native.buttons === 'number' ? native.buttons : 0
      return (b & 1) === 1 || (b & 4) === 4
    })()
    if (allowHeaderOverlayPan && installOverlayPan && allowPointerButtons && native && typeof native === 'object') {
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
          try {
            props.onOverlayPan?.({
              pointerId: ev.pointerId,
              clientX: ev.clientX,
              clientY: ev.clientY,
              dx: ev.clientX - x0,
              dy: ev.clientY - y0,
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
  }, [installHeaderDrag, installOverlayPan, props, selectSelf])

  return (
    <article
      ref={setRefs}
      className={['kg-media', props.className].filter(Boolean).join(' ')}
      data-kg-rich-media-panel="1"
      data-node-id={props.overlayId}
      data-kg-kind={kind}
      data-kg-url={rawUrl}
      data-kg-open-url={openUrl}
      data-kg-rich-media-overlay={canvasOverlayProxyEnabled ? '1' : undefined}
      data-kg-canvas-overlay-pinned={canvasOverlayProxyEnabled ? '1' : undefined}
      data-kg-canvas-wheel-ignore={canvasOverlayProxyEnabled ? 'true' : undefined}
      data-kg-canvas-pointer-ignore={canvasOverlayProxyEnabled ? 'true' : undefined}
      style={{
        ...PANEL_FRAME_ROOT_STYLE,
        position: 'relative',
        ...(flowEditorFrontmatterDocumentMode
          ? {
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)',
              background: 'var(--kg-panel-bg, rgba(255,255,255,0.92))',
            }
          : null),
        pointerEvents: hideUntilReady && !ready ? 'none' : (headerPassthrough ? 'none' : (editorMode ? 'auto' : ((contentInteractive || canClickToOpen) ? 'auto' : 'none'))),
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
          data-kg-canvas-overlay-drag-handle={installHeaderDrag ? 'true' : undefined}
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
            {showPanelControls && !panelControlsHidden ? (
              <li className="list-none flex items-center gap-1" aria-label="Render mode">
                {panel?.hasText ? (
                  <button
                    type="button"
                    data-kg-panel-action="1"
                    style={PANEL_FRAME_HEADER_ACTION_STYLE}
                    aria-label="Show text"
                    onPointerDownCapture={onHeaderActionPointerDownCapture}
                    onClick={() => props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: panelFreezeConnectedOutput })}
                  >
                    T
                  </button>
                ) : null}
                {panel?.hasImage ? (
                  <button
                    type="button"
                    data-kg-panel-action="1"
                    style={PANEL_FRAME_HEADER_ACTION_STYLE}
                    aria-label="Show image"
                    onPointerDownCapture={onHeaderActionPointerDownCapture}
                    onClick={() => props.onPanelChange?.({ activeTab: 'image', freezeConnectedOutput: panelFreezeConnectedOutput })}
                  >
                    I
                  </button>
                ) : null}
                {panel?.hasVideo ? (
                  <button
                    type="button"
                    data-kg-panel-action="1"
                    style={PANEL_FRAME_HEADER_ACTION_STYLE}
                    aria-label="Show video"
                    onPointerDownCapture={onHeaderActionPointerDownCapture}
                    onClick={() => props.onPanelChange?.({ activeTab: 'video', freezeConnectedOutput: panelFreezeConnectedOutput })}
                  >
                    V
                  </button>
                ) : null}
              </li>
            ) : null}
            {panelSelectedTab === 'text' && !panelControlsHidden ? (
              <li className="list-none">
                <button
                  type="button"
                  data-kg-panel-action="1"
                  style={PANEL_FRAME_HEADER_ACTION_STYLE}
                  aria-label={panelFreezeConnectedOutput ? 'View connected output' : 'Edit output'}
                  onPointerDownCapture={onHeaderActionPointerDownCapture}
                  onClick={() => {
                    if (!panel) return
                    if (panelFreezeConnectedOutput) {
                      props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: false })
                      return
                    }
                    const base = panel.connectedText || panel.text
                    props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: true, text: base })
                  }}
                >
                  {panelFreezeConnectedOutput ? 'View' : 'Edit'}
                </button>
              </li>
            ) : null}
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
        {showTextEditor && !panelControlsHidden ? (
          <section
            style={{
              position: 'absolute',
              inset: 10,
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              pointerEvents: editorMode ? 'auto' : 'auto',
            }}
            onPointerDownCapture={e => {
              try {
                e.stopPropagation()
              } catch {
                void 0
              }
            }}
            onWheelCapture={e => {
              try {
                e.stopPropagation()
              } catch {
                void 0
              }
            }}
          >
            <textarea
              value={panelDraftText}
              onChange={e => {
                const next = String(e.target.value || '')
                setPanelDraftText(next)
                props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: true, text: next })
              }}
              style={{
                flex: 1,
                width: '100%',
                resize: 'none',
                borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.6)',
                border: '1px solid var(--kg-border)',
                padding: 10,
                fontSize: 13,
                lineHeight: 1.35,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                background: 'rgba(255,255,255,0.94)',
                color: 'var(--kg-foreground, rgba(0,0,0,0.86))',
              }}
            />
          </section>
        ) : null}
        {allowClickToOpenOverlay ? (
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
        {isEmptyPanel ? (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
              background: 'transparent',
              color: 'var(--kg-muted-foreground, rgba(0,0,0,0.5))',
              fontSize: 12,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            Connect media to render
          </div>
        ) : kind === 'iframe' ? (
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
                pointerEvents: editorMode ? 'none' : (forwardingEnabled ? 'none' : undefined),
                touchAction: 'auto',
              }}
              onLoad={() => setReady(true)}
            />
          ) : (
          iframeEmbed && !iframeEmbed.direct && (hideUntilReady || forceSnapshotIframe) && (!preferEmbed || forceSnapshotIframe) ? (
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
                pointerEvents: editorMode ? 'none' : (forwardingEnabled ? 'none' : undefined),
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
                pointerEvents: editorMode ? 'none' : (forwardingEnabled ? 'none' : undefined),
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
                pointerEvents: editorMode ? 'none' : (forwardingEnabled ? 'none' : undefined),
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
                pointerEvents: editorMode ? 'none' : (forwardingEnabled ? 'none' : undefined),
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
                pointerEvents: editorMode ? 'none' : (forwardingEnabled ? 'none' : undefined),
            }}
          />
        )}
      </section>

      {installResize ? (
        <button
          type="button"
          aria-label="Resize"
          data-kg-resize-handle="se"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            background: 'transparent',
            cursor: 'nwse-resize',
            pointerEvents: 'auto',
            zIndex: 20,
            paddingRight: 2,
            paddingBottom: 2,
          }}
          onPointerDown={onResizePointerDown}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: 'transparent',
              border: '2px solid rgba(59, 130, 246, 1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              transition: 'var(--kg-transition-group-resize-dot)',
            }}
          />
        </button>
      ) : null}
    </article>
  )
})

export default React.memo(Panel)
