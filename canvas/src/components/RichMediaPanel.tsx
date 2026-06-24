import React from 'react'
import RichMediaIframe from '@/components/RichMediaIframe'
import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'
import { useShallow } from 'zustand/react/shallow'
import { applyImageLikeProxySrc } from '@/lib/url'
import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'
import { isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import type { RichMediaPanelTab } from '@/lib/render/richMediaPanelState'
import {
  resolveRichMediaPanelSelectedTab,
} from '@/lib/render/richMediaSsot'
import {
  readLatestGrabMapsPoiRichMediaPreview,
  subscribeGrabMapsPoiRichMediaPreview,
} from '@/features/geospatial/grabMapsPoiRichMedia'
import {
  CardMediaEmptyPlaceholder,
  CardMediaLoadingSkeleton,
  CardMediaPreview,
} from '@/lib/cards/CardMediaPreview'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import { FlowEditorPanelChromeHeader } from '@/components/FlowEditor/FlowEditorPanelChrome'
import { getFlowEditorPanelChromeClassName } from '@/components/FlowEditor/flowEditorPanelChromeClassName'
import {
  normalizeRichMediaPanelInlineSrcDoc,
  RICH_MEDIA_PANEL_SRCDOC_SIZE_MESSAGE,
} from '@/lib/render/richMediaPanelSrcDoc'
import {
  isDirectPlayableCardMedia,
  type CardMediaPlaceholderVariant,
  type CardMediaSkeletonVariant,
} from '@/lib/cards/cardMediaPreviewUtils'
import {
  CARD_MARKDOWN_PREVIEW_CODE_SURFACE_INSET_CSS_VALUE,
  CARD_MARKDOWN_PREVIEW_EMBEDDED_MEDIA_SURFACE_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import {
  readOverlayPointerTargetState,
  shouldBlockOverlayPanTarget,
} from 'grph-shared/dom/overlayPointerGuards'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { resolveIframeEmbed, shouldForceSnapshotIframeUrl } from 'grph-shared/rich-media/iframe'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  PANEL_FRAME_BODY_STYLE,
  PANEL_FRAME_ROOT_STYLE,
} from '@/lib/ui/panelFrame'
import {
  handleRichMediaPanelOverlayDragStartCapture,
  startRichMediaPanelHeaderDrag,
} from './RichMediaPanelOverlayDrag'

type RichMediaKind = 'iframe' | 'image' | 'svg' | 'video' | 'audio'

export type RichMediaPanelProps = {
  overlayId?: string
  title: string
  url: string
  srcDoc?: string
  openUrl?: string
  kind?: RichMediaKind
  interactive?: boolean
  videoControls?: boolean
  hideUntilReady?: boolean
  headerPassthrough?: boolean
  resizable?: boolean
  forwardWheelTo?: () => Element | null
  forwardWheelBeforeScrollableTarget?: boolean
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
  onPointerDownCapture?: React.PointerEventHandler<HTMLElement>
  onPointerUpCapture?: React.PointerEventHandler<HTMLElement>
  onWheelCapture?: React.WheelEventHandler<HTMLElement>
  onClickCapture?: React.MouseEventHandler<HTMLElement>
  onDoubleClickCapture?: React.MouseEventHandler<HTMLElement>
  onContextMenuCapture?: React.MouseEventHandler<HTMLElement>
  widgetToolbarActive?: boolean
  headerPinned?: boolean
  headerMinimized?: boolean
  onHeaderValidate?: () => void
  onHeaderTogglePinned?: (event: React.MouseEvent) => void
  onHeaderPinnedPointerDown?: (event: React.PointerEvent) => void
  onHeaderToggleMinimized?: () => void
  frameMode?: 'panel' | 'surface'
  resizeHandlePlacement?: 'root' | 'external'
  scrollOwner?: 'media' | 'panel'
  onInlineContentSize?: (size: { width: number; height: number }) => void
  panelChrome?: 'none' | 'flowEditor'
  panel?: {
    activeTab: RichMediaPanelTab
    freezeConnectedOutput: boolean
    hasText: boolean
    hasImage: boolean
    hasVideo: boolean
    hasAudio?: boolean
    hasPoi: boolean
    text: string
    connectedText: string
    isLoading?: boolean
    loadingLabel?: string
  }
  flowEditorInteractionMode?: boolean
  flowEditorFrontmatterDocumentMode?: boolean
  flowEditorSurfaceId?: string
  onPanelChange?: (next: { activeTab: RichMediaPanelTab; freezeConnectedOutput: boolean; text?: string }) => void
}

export type RichMediaPanelResizeHandlers = {
  onResizeStart?: (args: { pointerId: number; clientX: number; clientY: number }) => void
  onResize?: (args: { pointerId: number; clientX: number; clientY: number; dx: number; dy: number }) => void
  onResizeEnd?: (args: { pointerId: number; clientX: number; clientY: number }) => void
}

export function beginRichMediaPanelResizeDrag(args: RichMediaPanelResizeHandlers & {
  event: React.PointerEvent<HTMLElement>
  onBeforeStart?: (event: PointerEvent) => void
}): boolean {
  const e = args.event
  if (e.button !== 0) return false
  const native = e.nativeEvent
  const pointerId = native.pointerId
  const x0 = native.clientX
  const y0 = native.clientY
  try {
    args.onBeforeStart?.(native)
  } catch {
    void 0
  }
  try {
    e.preventDefault()
    e.stopPropagation()
  } catch {
    void 0
  }
  try {
    args.onResizeStart?.({ pointerId, clientX: x0, clientY: y0 })
  } catch {
    void 0
  }
  startPointerDrag({
    ev: native,
    cursor: 'nwse-resize',
    onMove: ev => {
      try {
        args.onResize?.({
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
        args.onResizeEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
      } catch {
        void 0
      }
    },
    onCancel: ev => {
      try {
        args.onResizeEnd?.({ pointerId: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY })
      } catch {
        void 0
      }
    },
  })
  return true
}

export function RichMediaPanelResizeHandle(props: {
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>
  placement?: 'root' | 'panel'
  style?: React.CSSProperties
}) {
  return (
    <button
      type="button"
      aria-label="Resize"
      data-kg-resize-handle="se"
      data-kg-rich-media-resize-handle="1"
      data-kg-rich-media-resize-placement={props.placement || 'root'}
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 22,
        height: 22,
        background: 'transparent',
        cursor: 'nwse-resize',
        pointerEvents: 'auto',
        zIndex: 20,
        ...(props.style || null),
      }}
      onPointerDown={props.onPointerDown}
    >
      <span
        aria-hidden="true"
        data-kg-rich-media-resize-handle-shape="corner"
        style={{
          position: 'absolute',
          right: 5,
          bottom: 5,
          width: 9,
          height: 9,
          borderRadius: 0,
          background: 'transparent',
          borderRight: '1px solid var(--kg-text-tertiary, rgba(100, 116, 139, 0.6))',
          borderBottom: '1px solid var(--kg-text-tertiary, rgba(100, 116, 139, 0.6))',
          boxShadow: 'none',
          opacity: 0.72,
          transition: 'var(--kg-transition-group-resize-dot)',
        }}
      />
    </button>
  )
}

const Panel = React.forwardRef<HTMLElement, RichMediaPanelProps>(function Panel(props, ref) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const inlineSrcDocFrameRef = React.useRef<HTMLIFrameElement | null>(null)
  const lastPointerDownAtRef = React.useRef(0)
  const forwardWheelTo = props.forwardWheelTo
  const onPanelChange = props.onPanelChange
  const title = String(props.title || '').trim() || 'Media node'
  const panelChrome = props.panelChrome === 'flowEditor' ? 'flowEditor' : 'none'
  const showFlowEditorChrome = panelChrome === 'flowEditor'
  const headerControlsActive = props.widgetToolbarActive !== false
  const frameMode = props.frameMode === 'surface' ? 'surface' : 'panel'
  const useSurfaceFrame = frameMode === 'surface' && !showFlowEditorChrome
  const resizeHandlePlacement = props.resizeHandlePlacement === 'external' ? 'external' : 'root'
  const scrollOwner = props.scrollOwner === 'panel' ? 'panel' : 'media'
  const onInlineContentSize = props.onInlineContentSize
  const kind: RichMediaKind = props.kind === 'image' || props.kind === 'svg' || props.kind === 'video' || props.kind === 'audio' ? props.kind : 'iframe'
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
  const [grabMapsPoiPreviewSrcDoc, setGrabMapsPoiPreviewSrcDoc] = React.useState<string>(() => {
    const payload = readLatestGrabMapsPoiRichMediaPreview()
    if (!payload) return ''
    const targetNodeId = String(payload.targetNodeId || '').trim()
    const overlayId = String(props.overlayId || '').trim()
    if (targetNodeId && overlayId && !isCanonicalNodeIdEqual(targetNodeId, overlayId)) return ''
    return String(payload.srcDoc || '').trim()
  })
  const [grabMapsPoiPreviewLabel, setGrabMapsPoiPreviewLabel] = React.useState<string>(() => {
    const payload = readLatestGrabMapsPoiRichMediaPreview()
    if (!payload) return ''
    const targetNodeId = String(payload.targetNodeId || '').trim()
    const overlayId = String(props.overlayId || '').trim()
    if (targetNodeId && overlayId && !isCanonicalNodeIdEqual(targetNodeId, overlayId)) return ''
    return String(payload.label || '').trim()
  })
  React.useEffect(() => {
    const applyPayload = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return
      const next = payload as { targetNodeId?: unknown; srcDoc?: unknown; label?: unknown }
      const targetNodeId = String(next.targetNodeId || '').trim()
      const overlayId = String(props.overlayId || '').trim()
      if (targetNodeId && overlayId && !isCanonicalNodeIdEqual(targetNodeId, overlayId)) return
      const srcDoc = typeof next.srcDoc === 'string' ? next.srcDoc.trim() : ''
      const label = typeof next.label === 'string' ? next.label.trim() : ''
      setGrabMapsPoiPreviewSrcDoc(srcDoc)
      setGrabMapsPoiPreviewLabel(label)
    }
    applyPayload(readLatestGrabMapsPoiRichMediaPreview())
    return subscribeGrabMapsPoiRichMediaPreview(payload => {
      applyPayload(payload)
    })
  }, [props.overlayId])
  const effectiveInlineSrcDoc = inlineSrcDoc || grabMapsPoiPreviewSrcDoc
  const normalizedInlineSrcDoc = React.useMemo(() => {
    return normalizeRichMediaPanelInlineSrcDoc({
      srcDoc: effectiveInlineSrcDoc,
      title,
    })
  }, [effectiveInlineSrcDoc, title])
  const [inlineSrcDocContentSize, setInlineSrcDocContentSize] = React.useState<{ width: number; height: number } | null>(null)
  React.useEffect(() => {
    setInlineSrcDocContentSize(null)
  }, [normalizedInlineSrcDoc])
  React.useEffect(() => {
    if (!normalizedInlineSrcDoc) return
    if (scrollOwner !== 'panel') return
    const onMessage = (event: MessageEvent) => {
      const frame = inlineSrcDocFrameRef.current
      if (!frame || event.source !== frame.contentWindow) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      const payload = data as { type?: unknown; width?: unknown; height?: unknown }
      if (payload.type !== RICH_MEDIA_PANEL_SRCDOC_SIZE_MESSAGE) return
      const width = typeof payload.width === 'number' && Number.isFinite(payload.width) ? Math.ceil(payload.width) : 0
      const height = typeof payload.height === 'number' && Number.isFinite(payload.height) ? Math.ceil(payload.height) : 0
      if (!(width > 0) || !(height > 0)) return
      const nextSize = { width, height }
      setInlineSrcDocContentSize(prev => (
        prev && Math.abs(prev.width - width) <= 1 && Math.abs(prev.height - height) <= 1
          ? prev
          : nextSize
      ))
      onInlineContentSize?.(nextSize)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [normalizedInlineSrcDoc, onInlineContentSize, scrollOwner])

  const panel = props.panel || null
  const panelActiveTab = panel ? panel.activeTab : 'auto'
  const panelFreezeConnectedOutput = panel ? panel.freezeConnectedOutput : false
  const panelHasPoi = panel ? panel.hasPoi : Boolean(grabMapsPoiPreviewSrcDoc.trim() || grabMapsPoiPreviewLabel.trim())
  const panelSelectedTab = resolveRichMediaPanelSelectedTab({
    activeTab: panelActiveTab,
    hasText: panel?.hasText === true,
    hasImage: panel?.hasImage === true,
    hasVideo: panel?.hasVideo === true,
    hasAudio: panel?.hasAudio === true,
    hasPoi: panelHasPoi,
    renderKind: kind,
    hasRenderableUrl: !!rawUrl,
    hasInlineSrcDoc: !!effectiveInlineSrcDoc,
  })
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
  const panelDisplayText = React.useMemo(() => {
    if (!panel || panelSelectedTab !== 'text') return ''
    if (panelFreezeConnectedOutput) return panelDraftText || panel.text || panel.connectedText || ''
    return panel.connectedText || panel.text || ''
  }, [panel, panelDraftText, panelFreezeConnectedOutput, panelSelectedTab])
  const panelMarkdownCommandContextText = React.useMemo(() => {
    return [
      kind === 'image' || kind === 'svg' ? `imageUrl: "${rawUrl}"` : '',
      kind === 'video' ? `videoUrl: "${rawUrl}"` : '',
      openUrl && openUrl !== rawUrl ? `sourceUrl: "${openUrl}"` : '',
      effectiveInlineSrcDoc ? `srcDoc: "${title}"` : '',
    ].filter(Boolean).join('\n')
  }, [effectiveInlineSrcDoc, kind, openUrl, rawUrl, title])
  const panelMarkdownDocumentPath = React.useMemo(() => {
    const base = String(props.overlayId || title || 'rich-media-panel').trim() || 'rich-media-panel'
    return `/__rich_media_panel/${encodeURIComponent(base)}.md`
  }, [props.overlayId, title])

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
  const {
    richMediaPanelMode,
    infiniteCanvasInteractionMode,
    workspaceViewMode,
    workspaceCanvasPaneOpen,
    uiPanelTextFontClass,
    uiPanelMonospaceTextClass,
    isFlowEditorRenderer,
    flowEditorFrontmatterDocumentModeFromStore,
  } = useGraphStore(
    useShallow(s => ({
      richMediaPanelMode: s.richMediaPanelMode,
      infiniteCanvasInteractionMode: s.infiniteCanvasInteractionMode,
      workspaceViewMode: s.workspaceViewMode,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
      uiPanelTextFontClass: s.uiPanelTextFontClass || 'font-sans',
      uiPanelMonospaceTextClass: s.uiPanelMonospaceTextClass || 'font-mono text-xs',
      isFlowEditorRenderer: String(s.canvas2dRenderer || '') === 'flowEditor',
      flowEditorFrontmatterDocumentModeFromStore: isFlowEditorFrontmatterDocumentModeRequested({
        canvas2dRenderer: String(s.canvas2dRenderer || ''),
        frontmatterModeEnabled: s.frontmatterModeEnabled === true,
        documentSemanticMode: String(s.documentSemanticMode || ''),
      }),
    })),
  )
  const flowEditorFrontmatterDocumentMode =
    props.flowEditorFrontmatterDocumentMode === true || flowEditorFrontmatterDocumentModeFromStore
  const flowEditorOverlayProxyMode = props.flowEditorInteractionMode === true
  const flowEditorInteractionMode = flowEditorOverlayProxyMode || flowEditorFrontmatterDocumentMode
  const panelControlsHidden = isFlowEditorRenderer !== true
  const canInlineEditPanelText = Boolean(
    panel
    && panelSelectedTab === 'text'
    && typeof onPanelChange === 'function',
  )
  const showPanelTextSurface = Boolean(
    panel
    && panelSelectedTab === 'text'
    && (canInlineEditPanelText || panelDisplayText.trim()),
  )
  const showPanelInlineTextEditor = showPanelTextSurface && canInlineEditPanelText
  const showPanelMarkdownPreview = Boolean(showPanelTextSurface && !showPanelInlineTextEditor && panelDisplayText.trim())
  const hasDirectRenderableUrl = !!rawUrl
  const isTextPanelEmpty = kind === 'iframe' && !hasDirectRenderableUrl && !effectiveInlineSrcDoc && !showPanelTextSurface
  const isStaticMediaPanelEmpty = (kind === 'image' || kind === 'svg' || kind === 'video' || kind === 'audio') && !hasDirectRenderableUrl
  const isEmptyPanel = isTextPanelEmpty || isStaticMediaPanelEmpty
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
  const allowPanelContentPointerEvents = !workspaceEditorOverlayOpen || flowEditorInteractionMode === true || isFlowEditorRenderer === true
  const allowEmbedFromStore = richMediaPanelMode === 'embed' || infiniteCanvasInteractionMode === 'interactive'
  const preferEmbed = allowEmbedFromStore && props.interactive !== false
  const playableCardMedia = isDirectPlayableCardMedia({ kind, url: rawUrl }) && props.interactive !== false
  const installWheelForwarding =
    typeof props.forwardWheelTo === 'function'
    && (
      props.forwardWheelBeforeScrollableTarget === true
      || (
        !preferEmbed
        || flowEditorFrontmatterDocumentMode === true
      )
    )
  const forwardModifierWheelZoomOnly = installWheelForwarding && flowEditorFrontmatterDocumentMode === true
  const forwardingEnabled =
    !playableCardMedia
    && (
    !preferEmbed
    && flowEditorFrontmatterDocumentMode !== true
    && (typeof props.forwardWheelTo === 'function' || typeof props.forwardPointerTo === 'function')
    )
  const [ready, setReady] = React.useState<boolean>(() => !hideUntilReady)
  React.useEffect(() => {
    setReady(!hideUntilReady)
  }, [hideUntilReady, proxiedUrl, kind])
  React.useEffect(() => {
    if (!hideUntilReady) return
    if (ready) return
    const t = window.setTimeout(() => {
      setReady(true)
    }, 1400)
    return () => {
      window.clearTimeout(t)
    }
  }, [hideUntilReady, ready, proxiedUrl, kind])

  React.useEffect(() => {
    if (!isEmptyPanel) return
    setReady(true)
  }, [isEmptyPanel])
  const installOverlayPan = !!(props.onOverlayPanStart || props.onOverlayPan || props.onOverlayPanEnd)
  const installHeaderDrag = !!(props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd)
  const installResize = props.resizable === true && (!!props.onResizeStart || !!props.onResize || !!props.onResizeEnd)
  const canvasOverlayProxyEnabled =
    !!installOverlayPan
    || !!installHeaderDrag
    || typeof props.forwardWheelTo === 'function'
  const flowEditorRichMediaOverlayRoot = flowEditorInteractionMode || canvasOverlayProxyEnabled
  const fallbackToRawSrc = React.useCallback(() => {
    if (!rawUrl || rawUrl === mediaSrc) return false
    setMediaSrc(rawUrl)
    return true
  }, [mediaSrc, rawUrl])
  const isSnapshotIframe =
    kind === 'iframe'
    && !!(iframeEmbed && !iframeEmbed.direct)
    && (!preferEmbed || forceSnapshotIframe)
  const isSnapshotVideo = false
  const isSnapshotStaticMedia = !preferEmbed && (kind === 'image' || kind === 'svg')
  const contentInteractive =
    (preferEmbed || playableCardMedia || (props.interactive !== false && !isSnapshotIframe && !isSnapshotVideo && !isSnapshotStaticMedia))
    && (!hideUntilReady || ready)
  const canClickToOpen = !headerPassthrough && kind !== 'video' && kind !== 'audio' && kind !== 'image' && kind !== 'svg' && !contentInteractive && !!safeOpenUrl
  const allowClickToOpenOverlay = canClickToOpen && !workspaceEditorOverlayOpen

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
      forwardWheelTo: installWheelForwarding ? forwardWheelTo : undefined,
      forwardWheelBeforeScrollableTarget: props.forwardWheelBeforeScrollableTarget === true,
      shouldForwardWheel: forwardModifierWheelZoomOnly ? e => e.ctrlKey === true || e.metaKey === true : undefined,
      stopPropagationOnForward: true,
      stopPropagationOnPreventZoom: false,
      forwardedFlagKey: '__kgForwarded',
    })
  }, [forwardModifierWheelZoomOnly, forwardWheelTo, installWheelForwarding, props.forwardWheelBeforeScrollableTarget])

  const selectSelf = React.useCallback((native: PointerEvent | null) => {
    if (!flowEditorInteractionMode) return
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
  }, [flowEditorInteractionMode, props.overlayId])

  const onResizePointerDown = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!installResize) return
    beginRichMediaPanelResizeDrag({
      event: e,
      onBeforeStart: selectSelf,
      onResizeStart: props.onResizeStart,
      onResize: props.onResize,
      onResizeEnd: props.onResizeEnd,
    })
  }, [installResize, props.onResize, props.onResizeEnd, props.onResizeStart, selectSelf])

  const startHeaderDrag = React.useCallback((native: PointerEvent | MouseEvent) => {
    if (!installHeaderDrag) return false
    selectSelf(native as PointerEvent)
    return startRichMediaPanelHeaderDrag(native, props)
  }, [installHeaderDrag, props, selectSelf])
  const handleRootDragStartCapture = React.useCallback((e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>): boolean => {
    const targetEl = e.target instanceof Element ? e.target : null
    const isHeaderTarget = !!targetEl?.closest('[data-kg-rich-media-flow-editor-header="1"]')
    const pointerTarget = readOverlayPointerTargetState(targetEl)
    const scrollSurfaceCanForwardPointer = forwardModifierWheelZoomOnly || props.forwardWheelBeforeScrollableTarget === true
    const nativePointerEvent = e.nativeEvent as PointerEvent | undefined
    const canForwardPointerDown =
      typeof props.forwardPointerTo === 'function'
      && typeof props.shouldForwardPointerDown === 'function'
      && typeof nativePointerEvent === 'object'
      && nativePointerEvent !== null
      && props.shouldForwardPointerDown(nativePointerEvent)
    if (!isHeaderTarget && shouldBlockOverlayPanTarget(pointerTarget, { scrollSurfaceCanForwardPointer }) && !canForwardPointerDown) return false
    return handleRichMediaPanelOverlayDragStartCapture({ event: e, installHeaderDrag, installOverlayPan, selectSelf, startHeaderDrag, handlers: props })
  }, [forwardModifierWheelZoomOnly, installHeaderDrag, installOverlayPan, props, selectSelf, startHeaderDrag])
  const onRootPointerDownCapture = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    const handled = handleRootDragStartCapture(e)
    if (!handled) return
    lastPointerDownAtRef.current = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  }, [handleRootDragStartCapture])
  const onRootMouseDownCapture = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
    if (now - lastPointerDownAtRef.current < 400) return
    handleRootDragStartCapture(e)
  }, [handleRootDragStartCapture])
  const panelIsLoading = panel?.isLoading === true
  const panelLoadingLabel = String(panel?.loadingLabel || '').trim() || 'Generating output...'
  const loadingSkeletonVariant: CardMediaSkeletonVariant =
    panelSelectedTab === 'text' ? 'text' : (kind === 'image' || kind === 'video' || kind === 'audio' ? kind : 'iframe')
  const expectedEmptyPlaceholderVariant: CardMediaPlaceholderVariant =
    panelSelectedTab === 'text' || panelSelectedTab === 'image' || panelSelectedTab === 'video' || panelSelectedTab === 'audio'
      ? panelSelectedTab
      : kind === 'audio'
        ? 'audio'
      : panel
        ? panel.hasImage && !panel.hasText && !panel.hasVideo && !panel.hasAudio
          ? 'image'
          : panel.hasVideo && !panel.hasText && !panel.hasImage && !panel.hasAudio
            ? 'video'
            : panel.hasAudio && !panel.hasText && !panel.hasImage && !panel.hasVideo
              ? 'audio'
              : panel.hasText && !panel.hasImage && !panel.hasVideo && !panel.hasAudio
              ? 'text'
              : 'undefined'
        : 'undefined'
  const shouldHideSurfaceUntilReady = hideUntilReady && !ready && !isEmptyPanel && !panelIsLoading
  const panelOwnsInlineSrcDocScroll = useSurfaceFrame && scrollOwner === 'panel' && kind === 'iframe' && !!effectiveInlineSrcDoc
  const inlineSrcDocPanelContentHeight =
    panelOwnsInlineSrcDocScroll && inlineSrcDocContentSize && inlineSrcDocContentSize.height > 0
      ? Math.ceil(inlineSrcDocContentSize.height)
      : 0
  const inlineSrcDocEmbeddedSurfaceHeight = inlineSrcDocPanelContentHeight > 0
    ? `calc(${inlineSrcDocPanelContentHeight}px + ${CARD_MARKDOWN_PREVIEW_CODE_SURFACE_INSET_CSS_VALUE} + ${CARD_MARKDOWN_PREVIEW_CODE_SURFACE_INSET_CSS_VALUE})`
    : ''
  const rootStyle: React.CSSProperties = {
    ...PANEL_FRAME_ROOT_STYLE,
    position: panelOwnsInlineSrcDocScroll ? 'relative' : (flowEditorInteractionMode ? 'absolute' : 'relative'),
    ...(!useSurfaceFrame && flowEditorFrontmatterDocumentMode
      ? {
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)',
          background: 'var(--kg-panel-bg, rgba(255,255,255,0.92))',
        }
      : null),
    ...(useSurfaceFrame
      ? {
          border: 0,
          borderRadius: 0,
          background: 'transparent',
          boxShadow: 'none',
          overflow: panelOwnsInlineSrcDocScroll ? 'visible' : undefined,
        }
      : null),
    pointerEvents: shouldHideSurfaceUntilReady ? 'none' : (headerPassthrough ? 'none' : (workspaceEditorOverlayOpen || canvasOverlayProxyEnabled ? 'auto' : ((contentInteractive || canClickToOpen) ? 'auto' : 'none'))),
    opacity: shouldHideSurfaceUntilReady ? 0 : 1,
    transition: 'opacity 180ms ease-out',
    ...(props.style || null),
    ...(inlineSrcDocPanelContentHeight > 0
      ? {
          height: inlineSrcDocEmbeddedSurfaceHeight,
          minHeight: '100%',
        }
      : null),
  }
  const bodySurfaceStyle: React.CSSProperties = {
    ...PANEL_FRAME_BODY_STYLE,
    position: panelOwnsInlineSrcDocScroll ? 'relative' : (flowEditorInteractionMode ? 'absolute' : 'relative'),
    padding: 0,
    overflow: panelOwnsInlineSrcDocScroll ? 'visible' : undefined,
    pointerEvents: headerPassthrough ? (contentInteractive ? 'auto' : 'none') : undefined,
  }
  const chromeBodySurfaceStyle: React.CSSProperties = {
    ...PANEL_FRAME_BODY_STYLE,
    position: 'relative',
    padding: 'var(--kg-media-panel-padding, 6px)',
    pointerEvents: headerPassthrough ? (contentInteractive ? 'auto' : 'none') : undefined,
  }
  const iframeSurfaceStyle = React.useMemo<React.CSSProperties>(() => ({
    display: 'block',
    width: '100%',
    height: '100%',
    border: 0,
    borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
    background: 'transparent',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : undefined) : 'none',
    touchAction: 'auto',
  }), [allowPanelContentPointerEvents, forwardingEnabled])
  const buildDirectMediaStyle = (display: 'block' | 'flex', background: string): React.CSSProperties => ({
    display, width: '100%', height: '100%', border: 0,
    borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
    background, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : undefined) : 'none',
  })
  const inlineSrcDocSurfaceStyle = React.useMemo<React.CSSProperties>(() => ({
    ...iframeSurfaceStyle,
    borderRadius: 0,
    ...(panelOwnsInlineSrcDocScroll
      ? {
          pointerEvents: 'none',
          touchAction: 'pan-y',
        }
      : null),
    ...(inlineSrcDocPanelContentHeight > 0
      ? {
          height: `${inlineSrcDocPanelContentHeight}px`,
          minHeight: '100%',
        }
      : null),
  }), [iframeSurfaceStyle, inlineSrcDocPanelContentHeight, panelOwnsInlineSrcDocScroll])
  const inlineSrcDocEmbeddedSurfaceStyle = React.useMemo<React.CSSProperties>(() => ({
    display: 'block',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
    pointerEvents: 'auto',
    touchAction: panelOwnsInlineSrcDocScroll ? 'pan-y' : 'auto',
    ...(inlineSrcDocPanelContentHeight > 0
      ? {
          height: inlineSrcDocEmbeddedSurfaceHeight,
          minHeight: '100%',
        }
      : null),
  }), [inlineSrcDocEmbeddedSurfaceHeight, inlineSrcDocPanelContentHeight, panelOwnsInlineSrcDocScroll])
  const resizeHandle = installResize && resizeHandlePlacement === 'root'
    ? <RichMediaPanelResizeHandle placement="root" onPointerDown={onResizePointerDown} />
    : null
  const renderSurfaceChildren = (
    <>
      {showPanelInlineTextEditor ? (
        <section
          aria-label="Rich media markdown preview"
          data-kg-rich-media-markdown-preview="1"
          data-kg-rich-media-inline-edit="1"
          data-kg-canvas-wheel-ignore="true"
          className={CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME}
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehaviorY: 'contain',
            overscrollBehaviorX: 'none',
            scrollbarGutter: 'stable',
            borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
            pointerEvents: 'auto',
            touchAction: 'pan-y',
          }}
          data-kg-media-scroll-surface="1"
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
          <CardInlineTextEditor
            value={panelDisplayText}
            ariaLabel={`${title} text`}
            placeholder="Add text"
            canEdit={true}
            editActivation="click"
            multiline
            rows={8}
            markdownPreview="auto"
            markdownCommandMenus
            markdownCommandContextText={panelMarkdownCommandContextText}
            onCommit={nextValue => {
              const next = String(nextValue || '')
              setPanelDraftText(next)
              props.onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: true, text: next })
            }}
            displayClassName="block h-full min-h-full w-full overflow-y-auto overflow-x-hidden"
            editorClassName="block h-full min-h-full w-full overflow-y-auto overflow-x-hidden font-mono text-xs leading-5"
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
      {showPanelMarkdownPreview ? (
        <section
          aria-label="Rich media markdown preview"
          data-kg-rich-media-markdown-preview="1"
          data-kg-canvas-wheel-ignore="true"
          className={CARD_MARKDOWN_PREVIEW_EMBEDDED_SURFACE_CLASS_NAME}
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehaviorY: 'contain',
            overscrollBehaviorX: 'none',
            scrollbarGutter: 'stable',
            borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
            pointerEvents: 'auto',
            touchAction: 'pan-y',
          }}
          data-kg-media-scroll-surface="1"
        >
          <CardMarkdownPreview
            markdownText={panelDisplayText}
            activeDocumentPath={panelMarkdownDocumentPath}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            richMediaDataAttrs
          />
        </section>
      ) : panelIsLoading ? (
        <CardMediaLoadingSkeleton
          label={panelLoadingLabel}
          variant={loadingSkeletonVariant}
          richMediaDataAttrs
        />
      ) : isEmptyPanel ? (
        <CardMediaEmptyPlaceholder variant={expectedEmptyPlaceholderVariant} richMediaDataAttrs />
      ) : kind === 'iframe' ? (
        effectiveInlineSrcDoc ? (
          <section
            aria-label="Rich media embedded preview"
            data-kg-rich-media-embedded-preview="1"
            className={CARD_MARKDOWN_PREVIEW_EMBEDDED_MEDIA_SURFACE_CLASS_NAME}
            style={inlineSrcDocEmbeddedSurfaceStyle}
          >
            <SharedWebpageSurface
              renderMode="iframe"
              webpageUrl={proxiedUrl}
              title={title}
              iframeSrc="about:blank"
              iframeSrcDoc={normalizedInlineSrcDoc}
              iframeAllow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              iframeRef={inlineSrcDocFrameRef}
              iframeScrolling={panelOwnsInlineSrcDocScroll ? 'no' : undefined}
              iframeReferrerPolicy="no-referrer"
              style={inlineSrcDocSurfaceStyle}
              onLoad={() => setReady(true)}
            />
          </section>
        ) : iframeEmbed?.direct ? (
          <CardMediaPreview
            kind="iframe"
            url={rawUrl}
            title={title}
            interactive={contentInteractive}
            fit="contain"
            mediaStyle={iframeSurfaceStyle}
            onReady={() => setReady(true)}
          />
        ) : iframeEmbed && !iframeEmbed.direct && (hideUntilReady || forceSnapshotIframe) && (!preferEmbed || forceSnapshotIframe) ? (
          <SharedWebpageSurface
            renderMode="snapshot"
            webpageUrl={proxiedUrl}
            title={title}
            className="w-full h-full"
            style={{ ...iframeSurfaceStyle, overflow: 'hidden', touchAction: undefined }}
          />
        ) : (
          <SharedWebpageSurface
            renderMode="iframe"
            webpageUrl={proxiedUrl}
            title={title}
            style={iframeSurfaceStyle}
            iframeRenderer={frameProps => (
              <RichMediaIframe
                title={frameProps.title}
                url={proxiedUrl}
                className={frameProps.className}
                style={frameProps.style}
                onLoad={frameProps.onLoad}
              />
            )}
            onLoad={() => setReady(true)}
          />
        )
      ) : kind === 'video' || kind === 'audio' ? (
        <CardMediaPreview
          kind={kind}
          url={mediaSrc}
          title={title}
          interactive={contentInteractive}
          fit="contain"
          videoControls={kind === 'video' ? props.videoControls ?? true : undefined}
          onReady={() => setReady(true)}
          onError={() => {
            if (!fallbackToRawSrc()) setReady(true)
          }}
          mediaStyle={buildDirectMediaStyle(kind === 'video' ? 'block' : 'flex', kind === 'video' ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.06)')}
        />
      ) : (
        <CardMediaPreview
          kind={kind === 'svg' ? 'svg' : 'image'}
          url={mediaSrc}
          title={title}
          interactive={false}
          fit="contain"
          onReady={() => setReady(true)}
          onError={() => {
            if (!fallbackToRawSrc()) setReady(true)
          }}
          mediaStyle={buildDirectMediaStyle('block', 'rgba(15, 23, 42, 0.06)')}
        />
      )}
    </>
  )

  const renderedSurface = showFlowEditorChrome ? (
    <>
      <FlowEditorPanelChromeHeader
        active={headerControlsActive}
        title={title}
        minimized={props.headerMinimized === true}
        showFieldToggle={false}
        showPinToggle={true}
        pinned={props.headerPinned === true}
        richMediaHeader={true}
        dragHandle={installHeaderDrag}
        onValidate={props.onHeaderValidate}
        onTogglePinned={props.onHeaderTogglePinned}
        onPinnedPointerDown={props.onHeaderPinnedPointerDown}
        onToggleMinimized={props.onHeaderToggleMinimized}
      />
      <section
        className="kg-mediaCardBody relative min-h-0 overflow-hidden"
        data-kg-widget-body="1"
        data-kg-rich-media-flow-editor-body="1"
        style={chromeBodySurfaceStyle}
      >
        {renderSurfaceChildren}
      </section>
    </>
  ) : renderSurfaceChildren

  return (
    <section
      ref={setRefs}
      className={[
        'kg-media',
        'kg-mediaBody',
        showFlowEditorChrome ? getFlowEditorPanelChromeClassName(uiPanelTextFontClass) : '',
        props.className,
      ].filter(Boolean).join(' ')}
      data-kg-rich-media-panel="1"
      data-node-id={props.overlayId}
      data-kg-kind={kind}
      data-kg-url={rawUrl}
      data-kg-open-url={openUrl}
      data-kg-rich-media-render-surface="1"
      data-kg-rich-media-overlay={flowEditorRichMediaOverlayRoot ? '1' : undefined}
      data-kg-canvas-overlay-pinned={canvasOverlayProxyEnabled ? '1' : undefined}
      data-kg-canvas-wheel-ignore={canvasOverlayProxyEnabled ? 'true' : undefined}
      data-kg-flow-editor-mode={flowEditorInteractionMode ? '1' : undefined}
      data-kg-flow-editor-surface={flowEditorInteractionMode ? (props.flowEditorSurfaceId || undefined) : undefined}
      data-kg-frontmatter-document-mode={flowEditorFrontmatterDocumentMode ? '1' : undefined}
      data-kg-resize-enabled={installResize ? '1' : undefined}
      data-kg-canvas-overlay-drag-handle={installHeaderDrag ? 'true' : undefined}
      data-kg-rich-media-flow-editor-chrome={showFlowEditorChrome ? '1' : undefined}
      data-kg-rich-media-frame-mode={useSurfaceFrame ? 'surface' : undefined}
      style={{
        ...rootStyle,
        ...(showFlowEditorChrome
          ? {
              display: 'flex',
              flexDirection: 'column',
            }
          : bodySurfaceStyle),
      }}
      onPointerDownCapture={onRootPointerDownCapture}
      onMouseDownCapture={onRootMouseDownCapture}
      onPointerUpCapture={props.onPointerUpCapture}
      onWheelCapture={props.onWheelCapture}
      onClickCapture={props.onClickCapture}
      onDoubleClickCapture={props.onDoubleClickCapture}
      onContextMenuCapture={props.onContextMenuCapture}
    >
      {renderedSurface}
      {resizeHandle}
    </section>
  )
})

export default React.memo(Panel)
