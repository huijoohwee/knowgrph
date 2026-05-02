import React from 'react'
import { NodeOverlayEditorActionsToolbar } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import RichMediaIframe from '@/components/RichMediaIframe'
import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'
import { applyImageLikeProxySrc } from '@/lib/url'
import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'
import { isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
import type { RichMediaPanelTab } from '@/lib/render/richMediaPanelState'
import {
  resolveRichMediaPanelSelectedTab,
  shouldShowRichMediaFloatingToolbar,
} from '@/lib/render/richMediaSsot'
import {
  readLatestGrabMapsPoiRichMediaPreview,
  subscribeGrabMapsPoiRichMediaPreview,
} from '@/features/geospatial/grabMapsPoiRichMedia'
import { installWheelForwardingAndBrowserZoomGuards } from 'grph-shared/dom/wheelGuards'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { resolveIframeEmbed, resolveIframeSandbox, shouldForceSnapshotIframeUrl } from 'grph-shared/rich-media/iframe'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import {
  PANEL_FRAME_BODY_STYLE,
  PANEL_FRAME_ROOT_STYLE,
} from '@/lib/ui/panelFrame'

const EMPTY_STRING_ARRAY: string[] = []
const MarkdownPreviewLazy = React.lazy(() => import('@/features/markdown/ui/MarkdownPreview'))

export type RichMediaPanelProps = {
  overlayId?: string
  title: string
  url: string
  srcDoc?: string
  openUrl?: string
  kind?: 'iframe' | 'image' | 'svg' | 'video'
  interactive?: boolean
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
    activeTab: RichMediaPanelTab
    freezeConnectedOutput: boolean
    hasText: boolean
    hasImage: boolean
    hasVideo: boolean
    hasPoi: boolean
    text: string
    connectedText: string
    isLoading?: boolean
    loadingLabel?: string
  }
  flowEditorInteractionMode?: boolean
  flowEditorFrontmatterDocumentMode?: boolean
  flowEditorSurfaceId?: string
  richMediaViewToggle?: {
    visible: boolean
    isKtvRows: boolean
    onToggle: () => void
  }
  richMediaMediaSelector?: {
    visible: boolean
    selectedMode: RichMediaPanelTab
    onSelect: (next: RichMediaPanelTab) => void
  }
  richMediaAspectToggle?: {
    visible: boolean
    selected: '16:9' | '9:16' | null
    onToggle: () => void
  }
  onPanelChange?: (next: { activeTab: RichMediaPanelTab; freezeConnectedOutput: boolean; text?: string }) => void
}

const RICH_MEDIA_SKELETON_STYLE_ID = 'kg-rich-media-skeleton-style'
const RICH_MEDIA_FLOATING_TOOLBAR_SIDE_OFFSET_PX = 8

type RichMediaPlaceholderMode = 'text' | 'image' | 'video' | 'undefined'

type RichMediaSkeletonVariant = RichMediaPlaceholderMode | 'iframe'

function useRichMediaSkeletonStyles() {
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(RICH_MEDIA_SKELETON_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = RICH_MEDIA_SKELETON_STYLE_ID
    style.textContent = `
      @keyframes kgRichMediaSkeletonShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .kg-rich-media-skeleton-block {
        background-image: linear-gradient(
          90deg,
          rgba(148, 163, 184, 0.14) 0%,
          rgba(148, 163, 184, 0.22) 25%,
          rgba(255, 255, 255, 0.40) 50%,
          rgba(148, 163, 184, 0.22) 75%,
          rgba(148, 163, 184, 0.14) 100%
        );
        background-size: 220% 100%;
        animation: kgRichMediaSkeletonShimmer 1.35s linear infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .kg-rich-media-skeleton-block {
          animation: none;
          background-position: 50% 0;
        }
      }
    `
    document.head.appendChild(style)
  }, [])
}

function getRichMediaSkeletonBlocks(variant: RichMediaSkeletonVariant, labelWidth: string) {
  if (variant === 'text') {
    return [
      { width: labelWidth, height: 12, radius: 999 },
      { width: '100%', height: 18, radius: 8 },
      { width: '92%', height: 18, radius: 8 },
      { width: '96%', height: 18, radius: 8 },
      { width: '100%', height: '100%', minHeight: 84, flex: 1, radius: 12 },
    ] as const
  }
  if (variant === 'image') {
    return [
      { width: labelWidth, height: 12, radius: 999 },
      { width: '100%', height: '100%', minHeight: 112, flex: 1, radius: 14 },
      { width: '52%', height: 12, radius: 999 },
    ] as const
  }
  if (variant === 'video') {
    return [
      { width: labelWidth, height: 12, radius: 999 },
      { width: '100%', height: '100%', minHeight: 112, flex: 1, radius: 14 },
      { width: '36%', height: 10, radius: 999 },
      { width: '58%', height: 10, radius: 999 },
    ] as const
  }
  return [
    { width: labelWidth, height: 12, radius: 999 },
    { width: '100%', height: '100%', minHeight: 112, flex: 1, radius: 14 },
    { width: '70%', height: 12, radius: 999 },
    { width: '46%', height: 12, radius: 999 },
  ] as const
}

function RichMediaLoadingSkeleton({
  label,
  variant,
}: {
  label: string
  variant: RichMediaSkeletonVariant
}) {
  useRichMediaSkeletonStyles()
  const safeLabel = String(label || '').trim() || 'Generating output...'
  const labelWidth = `${Math.min(72, Math.max(28, Math.round(safeLabel.length * 2.6)))}%`
  const blocks = getRichMediaSkeletonBlocks(variant, labelWidth)

  return (
    <section
      aria-label="Rich media loading state"
      aria-live="polite"
      className="w-full h-full"
      data-kg-rich-media-loading-surface="1"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 14,
        borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
        background: 'rgba(15, 23, 42, 0.04)',
        color: 'var(--kg-muted-foreground, rgba(0,0,0,0.62))',
        fontSize: 12,
        userSelect: 'none',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <section
        aria-hidden="true"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
          minHeight: 0,
        }}
      >
        {blocks.map((block, index) => (
          <span
            key={`${variant}-${index}`}
            className="kg-rich-media-skeleton-block"
            style={{
              display: 'block',
              width: block.width,
              height: block.height,
              minHeight: block.minHeight,
              flex: block.flex,
              borderRadius: block.radius,
            }}
          />
        ))}
      </section>
      <span
        style={{
          display: 'block',
          fontSize: 11,
          lineHeight: 1.3,
          color: 'var(--kg-muted-foreground, rgba(0,0,0,0.62))',
        }}
      >
        {safeLabel}
      </span>
    </section>
  )
}

function getRichMediaEmptyCardBlocks(variant: RichMediaPlaceholderMode) {
  if (variant === 'text') {
    return [
      { width: '46%', height: 12, radius: 999 },
      { width: '100%', height: 16, radius: 8 },
      { width: '92%', height: 16, radius: 8 },
      { width: '96%', minHeight: 58, flex: 1, radius: 12 },
      { width: '64%', height: 10, radius: 999 },
    ] as const
  }
  if (variant === 'image') {
    return [
      { width: '34%', height: 12, radius: 999 },
      { width: '100%', minHeight: 80, flex: 1, radius: 14 },
      { width: '48%', height: 10, radius: 999 },
      { width: '66%', height: 10, radius: 999 },
    ] as const
  }
  if (variant === 'video') {
    return [
      { width: '38%', height: 12, radius: 999 },
      { width: '100%', minHeight: 80, flex: 1, radius: 14 },
      { width: '28%', height: 8, radius: 999 },
      { width: '52%', height: 8, radius: 999 },
      { width: '40%', height: 8, radius: 999 },
    ] as const
  }
  return [
    { width: '42%', height: 12, radius: 999 },
    { width: '100%', minHeight: 76, flex: 1, radius: 14 },
    { width: '72%', height: 10, radius: 999 },
    { width: '56%', height: 10, radius: 999 },
  ] as const
}

function getRichMediaEmptyCardStatusLabel(variant: RichMediaPlaceholderMode) {
  if (variant === 'text') return 'Waiting for text content'
  if (variant === 'image') return 'Waiting for image content'
  if (variant === 'video') return 'Waiting for video content'
  return 'Waiting for rich media content'
}

function RichMediaEmptyCardPlaceholder({
  variant,
}: {
  variant: RichMediaPlaceholderMode
}) {
  useRichMediaSkeletonStyles()
  const blocks = getRichMediaEmptyCardBlocks(variant)
  const statusLabel = getRichMediaEmptyCardStatusLabel(variant)

  return (
    <section
      aria-label="Rich media empty state"
      role="status"
      className="w-full h-full"
      data-kg-rich-media-empty-card-placeholder="1"
      data-kg-rich-media-empty-card-variant={variant}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
        background: 'transparent',
        userSelect: 'none',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <section
        aria-hidden="true"
        style={{
          width: '100%',
          maxWidth: 260,
          minHeight: 132,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(148, 163, 184, 0.24)',
          background: 'rgba(15, 23, 42, 0.035)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {blocks.map((block, index) => (
          <span
            key={`${variant}-${index}`}
            className="kg-rich-media-skeleton-block"
            style={{
              display: 'block',
              width: block.width,
              height: block.height,
              minHeight: block.minHeight,
              flex: block.flex,
              borderRadius: block.radius,
            }}
          />
        ))}
      </section>
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {statusLabel}
      </span>
    </section>
  )
}

const Panel = React.forwardRef<HTMLElement, RichMediaPanelProps>(function Panel(props, ref) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const overlayId = props.overlayId
  const forwardWheelTo = props.forwardWheelTo
  const onPanelChange = props.onPanelChange
  const title = String(props.title || '').trim() || 'Media node'
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

  const panel = props.panel || null
  const panelActiveTab = panel ? panel.activeTab : 'auto'
  const panelFreezeConnectedOutput = panel ? panel.freezeConnectedOutput : false
  const panelHasPoi = panel ? panel.hasPoi : Boolean(grabMapsPoiPreviewSrcDoc.trim() || grabMapsPoiPreviewLabel.trim())
  const panelAvailableTabCount = panel
    ? [panel.hasText, panel.hasImage, panel.hasVideo, panelHasPoi].filter(Boolean).length
    : 0
  const panelHasMultiKinds = panelAvailableTabCount > 1
  const panelSelectedTab = resolveRichMediaPanelSelectedTab({
    activeTab: panelActiveTab,
    hasText: panel?.hasText === true,
    hasImage: panel?.hasImage === true,
    hasVideo: panel?.hasVideo === true,
    hasPoi: panelHasPoi,
    renderKind: kind,
    hasRenderableUrl: !!rawUrl,
    hasInlineSrcDoc: !!effectiveInlineSrcDoc,
  })
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
  const panelDisplayText = React.useMemo(() => {
    if (!panel || panelSelectedTab !== 'text') return ''
    if (panelFreezeConnectedOutput) return panelDraftText || panel.text || panel.connectedText || ''
    return panel.connectedText || panel.text || ''
  }, [panel, panelDraftText, panelFreezeConnectedOutput, panelSelectedTab])
  const showPanelMarkdownPreview = Boolean(panel && panelSelectedTab === 'text' && !showTextEditor && panelDisplayText.trim())
  const panelMarkdownDocumentPath = React.useMemo(() => {
    const base = String(props.overlayId || title || 'rich-media-panel').trim() || 'rich-media-panel'
    return `/__rich_media_panel/${encodeURIComponent(base)}.md`
  }, [props.overlayId, title])
  const hasDirectRenderableUrl = !!rawUrl
  const isTextPanelEmpty = kind === 'iframe' && !hasDirectRenderableUrl && !effectiveInlineSrcDoc && !showPanelMarkdownPreview
  const isStaticMediaPanelEmpty = (kind === 'image' || kind === 'svg' || kind === 'video') && !hasDirectRenderableUrl
  const isEmptyPanel = isTextPanelEmpty || isStaticMediaPanelEmpty

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
  const workspaceCanvasPaneOpen = useGraphStore(s => s.workspaceCanvasPaneOpen)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelMonospaceTextClass = useGraphStore(s => s.uiPanelMonospaceTextClass || 'font-mono text-xs')
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const isFlowEditorRenderer = useGraphStore(s => String(s.canvas2dRenderer || '') === 'flowEditor')
  const flowEditorFrontmatterDocumentModeFromStore = useGraphStore(s => isFlowEditorFrontmatterDocumentModeRequested({
    canvas2dRenderer: String(s.canvas2dRenderer || ''),
    frontmatterModeEnabled: s.frontmatterModeEnabled === true,
    documentSemanticMode: String(s.documentSemanticMode || ''),
  }))
  const flowEditorFrontmatterDocumentMode =
    props.flowEditorFrontmatterDocumentMode === true || flowEditorFrontmatterDocumentModeFromStore
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds ?? EMPTY_STRING_ARRAY)
  const flowEditorOverlayProxyMode = props.flowEditorInteractionMode === true
  const flowEditorInteractionMode = flowEditorOverlayProxyMode || flowEditorFrontmatterDocumentMode
  const panelControlsHidden = isFlowEditorRenderer !== true
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
  const allowPanelContentPointerEvents = !workspaceEditorOverlayOpen || flowEditorInteractionMode === true || isFlowEditorRenderer === true
  const allowEmbedFromStore = richMediaPanelMode === 'embed' || infiniteCanvasInteractionMode === 'interactive'
  const preferEmbed = allowEmbedFromStore && props.interactive !== false
  const installWheelForwarding =
    typeof props.forwardWheelTo === 'function'
    && (
      !preferEmbed
      || flowEditorFrontmatterDocumentMode === true
    )
  const forwardModifierWheelZoomOnly = installWheelForwarding && flowEditorFrontmatterDocumentMode === true
  const forwardingEnabled =
    !preferEmbed
    && flowEditorFrontmatterDocumentMode !== true
    && (typeof props.forwardWheelTo === 'function' || typeof props.forwardPointerTo === 'function')
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
  const installOverlayPan = props.onOverlayPanStart || props.onOverlayPan || props.onOverlayPanEnd
  const installHeaderDrag = props.onHeaderDragStart || props.onHeaderDrag || props.onHeaderDragEnd
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
    (preferEmbed || (props.interactive !== false && !isSnapshotIframe && !isSnapshotVideo && !isSnapshotStaticMedia))
    && (!hideUntilReady || ready)
  const canClickToOpen = !headerPassthrough && kind !== 'video' && kind !== 'image' && kind !== 'svg' && !contentInteractive && !!safeOpenUrl
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
      shouldForwardWheel: forwardModifierWheelZoomOnly ? e => e.ctrlKey === true || e.metaKey === true : undefined,
      stopPropagationOnForward: true,
      stopPropagationOnPreventZoom: false,
      forwardedFlagKey: '__kgForwarded',
    })
  }, [forwardModifierWheelZoomOnly, forwardWheelTo, installWheelForwarding])

  const overlayAlreadySelected = React.useMemo(() => {
    const canonicalOverlayId = String(overlayId || '').trim()
    if (!canonicalOverlayId) return false
    if (isCanonicalNodeIdEqual(selectedNodeId, canonicalOverlayId)) return true
    if (!Array.isArray(selectedNodeIds)) return false
    for (let i = 0; i < selectedNodeIds.length; i += 1) {
      if (isCanonicalNodeIdEqual(selectedNodeIds[i], canonicalOverlayId)) return true
    }
    return false
  }, [overlayId, selectedNodeId, selectedNodeIds])
  const showWidgetLikeToolbar = shouldShowRichMediaFloatingToolbar({
    hasPanelState: !!panel,
    hasMultiKinds: panelHasMultiKinds,
    selectedTab: panelSelectedTab,
    safeOpenUrl,
  })
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const handleToggleRichMediaTextMode = React.useCallback(() => {
    if (!panel || panelSelectedTab !== 'text') return
    if (panelFreezeConnectedOutput) {
      onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: false })
      return
    }
    const base = panel.connectedText || panel.text
    onPanelChange?.({ activeTab: 'text', freezeConnectedOutput: true, text: base })
  }, [onPanelChange, panel, panelFreezeConnectedOutput, panelSelectedTab])
  const floatingWidgetLikeToolbar = showWidgetLikeToolbar ? (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        top: '50%',
        left: '100%',
        marginLeft: `${RICH_MEDIA_FLOATING_TOOLBAR_SIDE_OFFSET_PX}px`,
        transform: 'translateY(-50%)',
      }}
    >
      <NodeOverlayEditorActionsToolbar
        visible={true}
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={uiIconStrokeWidth}
        active={true}
        enableHandlesDisabled={true}
        convertToLoopDisabled={true}
        duplicateDisabled={true}
        actionVisibility={{
          run: false,
          updateKvEntry: false,
          openInSidepane: false,
          enableHandles: false,
          convertToLoop: false,
          duplicate: false,
          clearOutput: false,
          help: false,
          remove: false,
        }}
        richMediaViewToggle={showWidgetLikeToolbar ? props.richMediaViewToggle : undefined}
        richMediaMediaSelector={showWidgetLikeToolbar ? {
          visible: props.richMediaMediaSelector?.visible ?? panelHasMultiKinds,
          selectedMode: props.richMediaMediaSelector?.selectedMode ?? panelActiveTab,
          onSelect: props.richMediaMediaSelector?.onSelect
            || (next => onPanelChange?.({ activeTab: next, freezeConnectedOutput: panelFreezeConnectedOutput })),
        } : undefined}
        richMediaAspectToggle={showWidgetLikeToolbar ? props.richMediaAspectToggle : undefined}
        richMediaTextModeToggle={showWidgetLikeToolbar && panelSelectedTab === 'text' ? {
          visible: true,
          freezeConnectedOutput: panelFreezeConnectedOutput,
          onToggle: handleToggleRichMediaTextMode,
        } : undefined}
        openExternalAction={showWidgetLikeToolbar && safeOpenUrl ? {
          visible: true,
          label: 'Open source',
          onOpen: openSafeUrl,
        } : undefined}
        onRun={() => void 0}
        onDuplicate={() => void 0}
        onClearOutput={() => void 0}
        onHelp={() => void 0}
        onRemove={() => void 0}
        onEnableHandlesForAllInputs={() => void 0}
        onConvertToLoopNode={() => void 0}
      />
    </div>
  ) : null

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

  const startHeaderDrag = React.useCallback((native: PointerEvent) => {
    if (!installHeaderDrag) return false
    selectSelf(native)
    if (native && typeof props.shouldStartHeaderDrag === 'function') {
      try {
        if (props.shouldStartHeaderDrag(native) !== true) return false
      } catch {
        return false
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
    return true
  }, [installHeaderDrag, props, selectSelf])
  const onRootPointerDownCapture = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const native = e.nativeEvent
    selectSelf(native)
    const targetEl = (() => {
      const t = (native as unknown as { target?: unknown }).target
      return t instanceof Element ? t : null
    })()
    const isResizeHandleTarget = !!targetEl?.closest('[data-kg-resize-handle]')
    const isScrollableSurfaceTarget = !!targetEl?.closest('[data-kg-media-scroll-surface="1"]')
    const isInteractiveControlTarget = !!targetEl?.closest('textarea,input,select,button,a,[contenteditable="true"]')
    const allowPointerButtons = (() => {
      const b = typeof native.buttons === 'number' ? native.buttons : 0
      return (b & 1) === 1 || (b & 4) === 4
    })()
    const blockOverlayPanForTarget =
      isResizeHandleTarget
      || isScrollableSurfaceTarget
      || isInteractiveControlTarget
    if (!blockOverlayPanForTarget && startHeaderDrag(native)) {
      try {
        e.preventDefault()
        e.stopPropagation()
      } catch {
        void 0
      }
      return
    }
    if (
      overlayAlreadySelected
      && !blockOverlayPanForTarget
      && installOverlayPan
      && allowPointerButtons
      && native
      && typeof native === 'object'
    ) {
      const pointerId = native.pointerId
      const x0 = native.clientX
      const y0 = native.clientY
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
  }, [installHeaderDrag, installOverlayPan, overlayAlreadySelected, props, selectSelf, startHeaderDrag])
  const panelIsLoading = panel?.isLoading === true
  const panelLoadingLabel = String(panel?.loadingLabel || '').trim() || 'Generating output...'
  const loadingSkeletonVariant: RichMediaSkeletonVariant =
    panelSelectedTab === 'text' ? 'text' : (kind === 'image' || kind === 'video' ? kind : 'iframe')
  const expectedEmptyPlaceholderVariant: RichMediaPlaceholderMode =
    panelSelectedTab === 'text' || panelSelectedTab === 'image' || panelSelectedTab === 'video'
      ? panelSelectedTab
      : panel
        ? panel.hasImage && !panel.hasText && !panel.hasVideo
          ? 'image'
          : panel.hasVideo && !panel.hasText && !panel.hasImage
            ? 'video'
            : panel.hasText && !panel.hasImage && !panel.hasVideo
              ? 'text'
              : 'undefined'
        : 'undefined'
  const shouldHideSurfaceUntilReady = hideUntilReady && !ready && !isEmptyPanel && !panelIsLoading
  const rootStyle: React.CSSProperties = {
    ...PANEL_FRAME_ROOT_STYLE,
    position: 'relative',
    ...(flowEditorFrontmatterDocumentMode
      ? {
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)',
          background: 'var(--kg-panel-bg, rgba(255,255,255,0.92))',
        }
      : null),
    pointerEvents: shouldHideSurfaceUntilReady ? 'none' : (headerPassthrough ? 'none' : (workspaceEditorOverlayOpen ? 'auto' : ((contentInteractive || canClickToOpen) ? 'auto' : 'none'))),
    opacity: shouldHideSurfaceUntilReady ? 0 : 1,
    transition: 'opacity 180ms ease-out',
    ...(props.style || null),
  }
  const bodySurfaceStyle: React.CSSProperties = {
    ...PANEL_FRAME_BODY_STYLE,
    position: 'relative',
    padding: 0,
    pointerEvents: headerPassthrough ? (contentInteractive ? 'auto' : 'none') : undefined,
  }
  const renderSurfaceChildren = (
    <>
      {showTextEditor && !panelControlsHidden ? (
        <section
          style={{
            position: 'absolute',
            inset: 10,
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'auto',
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
      {showPanelMarkdownPreview ? (
        <section
          aria-label="Rich media markdown preview"
          data-kg-rich-media-markdown-preview="1"
          data-kg-canvas-wheel-ignore="true"
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
            background: 'transparent',
            pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : 'auto') : 'none',
            touchAction: 'pan-x pan-y',
          }}
          data-kg-media-scroll-surface="1"
        >
          <React.Suspense fallback={<RichMediaLoadingSkeleton label="Rendering markdown..." variant="text" />}>
            <MarkdownPreviewLazy
              markdownText={panelDisplayText}
              activeDocumentPath={panelMarkdownDocumentPath}
              markdownTokenStoreSync={false}
              highlightedLineRange={null}
              markdownWordWrap
              markdownPresentationMode={false}
              markdownTextHighlight={false}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
              previewOverlayScope="container"
              previewOverlayPortalTarget={null}
              previewScrollable
              showSidebar={false}
              markdownViewerWidthMode="wide"
            />
          </React.Suspense>
        </section>
      ) : panelIsLoading ? (
        <RichMediaLoadingSkeleton
          label={panelLoadingLabel}
          variant={loadingSkeletonVariant}
        />
      ) : isEmptyPanel ? (
        <RichMediaEmptyCardPlaceholder variant={expectedEmptyPlaceholderVariant} />
      ) : kind === 'iframe' ? (
        effectiveInlineSrcDoc ? (
          <iframe
            src="about:blank"
            srcDoc={effectiveInlineSrcDoc}
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
              pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : undefined) : 'none',
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
              pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : undefined) : 'none',
            }}
          />
        ) : (
          <RichMediaIframe
            title={title}
            url={proxiedUrl}
            style={{
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
            }}
            onLoad={() => setReady(true)}
          />
        )
        )
      ) : kind === 'video' ? (
        <video
          src={mediaSrc}
          playsInline
          muted
          controls
          preload="metadata"
          onLoadedMetadata={() => setReady(true)}
          onLoadedData={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          onError={() => {
            if (!fallbackToRawSrc()) setReady(true)
          }}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            border: 0,
            borderRadius: 'calc(var(--kg-media-panel-radius, 10px) * 0.8)',
            objectFit: 'contain',
            background: 'rgba(2, 6, 23, 0.72)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : undefined) : 'none',
          }}
        />
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
            objectFit: 'contain',
            background: 'rgba(15, 23, 42, 0.06)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            pointerEvents: allowPanelContentPointerEvents ? (forwardingEnabled ? 'none' : undefined) : 'none',
          }}
        />
      )}
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
            background: 'transparent',
            cursor: 'nwse-resize',
            pointerEvents: 'auto',
            zIndex: 20,
          }}
          onPointerDown={onResizePointerDown}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: 'transparent',
              border: '2px solid var(--kg-canvas-accent)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              transition: 'var(--kg-transition-group-resize-dot)',
            }}
          />
        </button>
      ) : null}
    </>
  )

  return (
    <section
      ref={setRefs}
      className={['kg-media', 'kg-mediaBody', props.className].filter(Boolean).join(' ')}
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
      style={{
        ...rootStyle,
        ...bodySurfaceStyle,
      }}
      onPointerDownCapture={onRootPointerDownCapture}
      onPointerUpCapture={props.onPointerUpCapture}
      onWheelCapture={props.onWheelCapture}
      onClickCapture={props.onClickCapture}
      onDoubleClickCapture={props.onDoubleClickCapture}
      onContextMenuCapture={props.onContextMenuCapture}
    >
      {floatingWidgetLikeToolbar}
      {renderSurfaceChildren}
    </section>
  )
})

export default React.memo(Panel)
