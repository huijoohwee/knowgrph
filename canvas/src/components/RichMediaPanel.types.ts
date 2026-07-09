import type React from 'react'
import type { RichMediaPanelTab } from '@/lib/render/richMediaPanelState'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'

export type RichMediaKind = 'iframe' | 'image' | 'svg' | 'video' | 'audio'

export type RichMediaPanelProps = {
  overlayId?: string
  title: string
  url: string
  srcDoc?: string
  openUrl?: string
  kind?: RichMediaKind
  interactive?: boolean
  videoControls?: boolean
  videoPoster?: string
  hideUntilReady?: boolean
  headerPassthrough?: boolean
  resizable?: boolean
  forwardWheelTo?: () => Element | null
  forwardWheelBeforeScrollableTarget?: boolean
  forwardPointerTo?: () => Element | null
  shouldForwardPointerDown?: (event: PointerEvent) => boolean
  shouldStartHeaderDrag?: (event: PointerEvent) => boolean
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
  panelChrome?: 'none' | 'storyboardWidget'
  canvasOverlayPinned?: boolean
  onMediaElement?: (element: HTMLMediaElement | null) => void
  onVideoElement?: (element: HTMLVideoElement | null) => void
  onMediaDrop?: (payload: MediaDragPayload) => void
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
  storyboardWidgetInteractionMode?: boolean
  storyboardWidgetFrontmatterDocumentMode?: boolean
  storyboardWidgetSurfaceId?: string
  onPanelChange?: (next: {
    activeTab: RichMediaPanelTab
    freezeConnectedOutput: boolean
    text?: string
  }) => void
}
