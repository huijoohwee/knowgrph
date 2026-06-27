import React from 'react'
import { CardMediaPreview } from '@/lib/cards/CardMediaPreview'
import {
  MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE,
  MEDIA_POINTER_DRAG_DROP_EVENT,
  clearMediaPointerDragPayload,
  hasMediaDragPayload,
  readMediaDragPayload,
  readMediaPointerDragPayload,
  type MediaDragPayload,
  type MediaPointerDragDropDetail,
} from '@/lib/ui/mediaDragPayload'
import { cn } from '@/lib/utils'
import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'

type StoryboardCardMediaDropSlot2dProps = {
  card: StoryboardCardModel
  displayMedia: StoryboardCardModel['media']
  onDropMedia: (card: StoryboardCardModel, payload: MediaDragPayload) => void
}

export function StoryboardCardMediaDropSlot2d({ card, displayMedia, onDropMedia }: StoryboardCardMediaDropSlot2dProps) {
  const mediaUrl = displayMedia?.url || displayMedia?.thumbnailUrl || ''
  const mediaPoster = displayMedia?.thumbnailUrl || undefined
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
      const payload = detail?.payload
      const clientX = Number(detail?.clientX)
      const clientY = Number(detail?.clientY)
      const element = mediaDropRef.current
      if (!payload || !Number.isFinite(clientX) || !Number.isFinite(clientY) || !element) return
      const rect = element.getBoundingClientRect()
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return
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
    const isInsideDropSlot = (clientX: number, clientY: number): boolean => {
      const element = mediaDropRef.current
      if (!element || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false
      const rect = element.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }
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
      className={cn('m-0 flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded border bg-[color:var(--kg-input-bg)]')}
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
      ) : (
        <span className="text-[18px] font-semibold text-[color:var(--kg-text-tertiary)]">+</span>
      )}
    </figure>
  )
}
