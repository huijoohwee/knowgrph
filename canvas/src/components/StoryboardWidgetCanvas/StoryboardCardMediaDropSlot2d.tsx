import React from 'react'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import { InlineMediaCommandThumbnail } from '@/lib/command-menu/InlineMediaCommandThumbnail'
import type { InlineMediaKind } from '@/lib/command-menu/inlineCommandMenuCatalog'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import {
  MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE,
  MEDIA_POINTER_DRAG_DROP_EVENT,
  claimMediaPointerDragDrop,
  clearMediaPointerDragPayload,
  hasMediaDragPayload,
  isMediaDragPointInsideElement,
  isMediaPointerDragDropClaimed,
  readMediaDragPayload,
  readMediaPointerDragPayload,
  type MediaDragPayload,
  type MediaPointerDragDropDetail,
} from '@/lib/ui/mediaDragPayload'
import { cn } from '@/lib/utils'
import type { StoryboardCardMedia, StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'

type StoryboardCardMediaDropSlot2dProps = {
  card: StoryboardCardModel
  displayMedia: StoryboardCardModel['media']
  onDropMedia: (card: StoryboardCardModel, payload: MediaDragPayload) => void
}

const toInlineMediaKind2d = (kind: StoryboardCardMedia['kind'] | null | undefined): InlineMediaKind | null => {
  if (kind === 'image' || kind === 'svg') return 'image'
  if (kind === 'audio' || kind === 'video') return kind
  return null
}

const readMediaFileLabel2d = (url: string, fallback: string): string => {
  const raw = String(url || '').split(/[?#]/)[0]?.split('/').filter(Boolean).pop() || ''
  try {
    return decodeURIComponent(raw).trim() || fallback
  } catch {
    return raw || fallback
  }
}

export function StoryboardCardMediaDropSlot2d({ card, displayMedia, onDropMedia }: StoryboardCardMediaDropSlot2dProps) {
  const mediaUrl = displayMedia?.url || displayMedia?.thumbnailUrl || ''
  const mediaPoster = displayMedia?.thumbnailUrl || undefined
  const inlineMediaKind = toInlineMediaKind2d(displayMedia?.kind)
  const mediaChipLabel = inlineMediaKind ? readMediaFileLabel2d(displayMedia?.sourceUrl || mediaUrl, card.title || 'Media') : ''
  const mediaChipThumbnailUrl = inlineMediaKind === 'image' ? mediaUrl : mediaPoster
  const mediaDropRef = React.useRef<HTMLElement | null>(null)
  const handleMediaDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasMediaDragPayload(event.dataTransfer) && !readMediaPointerDragPayload()) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }, [])
  const handleMediaDrop = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = readMediaDragPayload(event.dataTransfer) || readMediaPointerDragPayload()
    if (!payload) return
    event.preventDefault()
    event.stopPropagation()
    onDropMedia(card, payload)
    clearMediaPointerDragPayload()
  }, [card, onDropMedia])
  const handlePointerMediaDrop = React.useCallback((event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
    const payload = readMediaPointerDragPayload()
    if (!payload) return
    event.preventDefault()
    event.stopPropagation()
    onDropMedia(card, payload)
    clearMediaPointerDragPayload()
  }, [card, onDropMedia])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePointerDragDrop = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail as Partial<MediaPointerDragDropDetail> | null
      if (isMediaPointerDragDropClaimed(detail as MediaPointerDragDropDetail | null | undefined)) return
      const payload = detail?.payload
      const clientX = Number(detail?.clientX)
      const clientY = Number(detail?.clientY)
      const element = mediaDropRef.current
      if (!payload || !Number.isFinite(clientX) || !Number.isFinite(clientY) || !element) return
      if (!isMediaDragPointInsideElement(element, clientX, clientY)) return
      claimMediaPointerDragDrop(detail as MediaPointerDragDropDetail | null | undefined)
      onDropMedia(card, payload)
      clearMediaPointerDragPayload()
      try {
        event.preventDefault()
        event.stopPropagation()
        ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
    }
    window.addEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, handlePointerDragDrop)
    return () => window.removeEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, handlePointerDragDrop)
  }, [card, onDropMedia])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const isInsideDropSlot = (clientX: number, clientY: number): boolean => isMediaDragPointInsideElement(mediaDropRef.current, clientX, clientY)
    const handleDocumentDragOver = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !hasMediaDragPayload(dataTransfer) || !isInsideDropSlot(event.clientX, event.clientY)) return
      event.preventDefault()
      event.stopPropagation()
      dataTransfer.dropEffect = 'copy'
    }
    const handleDocumentDrop = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !hasMediaDragPayload(dataTransfer) || !isInsideDropSlot(event.clientX, event.clientY)) return
      const payload = readMediaDragPayload(dataTransfer)
      if (!payload) return
      event.preventDefault()
      event.stopPropagation()
      ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      onDropMedia(card, payload)
      clearMediaPointerDragPayload()
    }
    document.addEventListener('dragover', handleDocumentDragOver, true)
    document.addEventListener('drop', handleDocumentDrop, true)
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver, true)
      document.removeEventListener('drop', handleDocumentDrop, true)
    }
  }, [card, onDropMedia])

  return (
    <figure
      ref={mediaDropRef}
      className={cn('relative m-0 flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded border bg-[color:var(--kg-input-bg)]')}
      {...{ [MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE]: '1' }}
      data-kg-storyboard-card-media-drop="1"
      data-kg-storyboard-card-id={card.id}
      onDragEnter={handleMediaDragOver}
      onDragOver={handleMediaDragOver}
      onDrop={handleMediaDrop}
      onPointerUp={handlePointerMediaDrop}
      onMouseUp={handlePointerMediaDrop}
      style={{ borderColor: 'var(--kg-border)' }}
    >
      {mediaUrl ? (
        <CardMediaPreview
          title={card.title}
          kind={displayMedia?.kind || null}
          url={mediaUrl}
          href={card.href || displayMedia?.sourceUrl || mediaUrl}
          srcDoc={displayMedia?.srcDoc}
          interactive={false}
          fit="cover"
          videoPoster={mediaPoster}
          className="h-full w-full"
          mediaClassName="h-full w-full"
          mediaThumbnailDataAttr
        />
      ) : null}
      {mediaUrl && inlineMediaKind ? (
        <figcaption className="pointer-events-none absolute bottom-1 left-1 right-1 z-10 flex min-w-0">
          <span className={`${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME} max-w-full bg-[color:var(--kg-panel-bg)]/90 shadow-sm backdrop-blur`} data-kg-storyboard-card-media-chip="1">
            <InlineMediaCommandThumbnail kind={inlineMediaKind} thumbnailUrl={mediaChipThumbnailUrl} variant="inline" />
            <span className={CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}>{mediaChipLabel}</span>
          </span>
        </figcaption>
      ) : null}
      {!mediaUrl ? (
        <span className="text-[18px] font-semibold text-[color:var(--kg-text-tertiary)]">+</span>
      ) : null}
    </figure>
  )
}
