import React from 'react'
import { resolveVideoSequenceRulerInsetPixelMetrics } from './videoSequenceTimelineRulerGeometry'
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

export type VideoSequenceTimelineMediaDropTargetProps = React.HTMLAttributes<HTMLElement> & {
  [MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE]: '1'
  'data-kg-video-sequence-timeline-media-drop': '1'
}

export function useVideoSequenceTimelineMediaDropTarget(args: {
  contentRef: React.RefObject<HTMLElement | null>
  maxMinutes: number
  onDropMedia: (payload: MediaDragPayload, positionMinutes: number) => boolean
  targetRef: React.RefObject<HTMLElement | null>
}): VideoSequenceTimelineMediaDropTargetProps {
  const resolvePositionMinutes = React.useCallback((clientX: number): number => {
    const element = args.contentRef.current || args.targetRef.current
    const rect = element?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || !Number.isFinite(clientX)) return 0
    const insetMetrics = resolveVideoSequenceRulerInsetPixelMetrics(rect.width)
    const ratio = (clientX - rect.left - insetMetrics.insetLeftPx) / insetMetrics.widthPx
    return Math.max(0, Math.min(Math.max(0, args.maxMinutes), ratio * Math.max(0, args.maxMinutes)))
  }, [args.contentRef, args.maxMinutes, args.targetRef])

  const isInside = React.useCallback((clientX: number, clientY: number): boolean =>
    isMediaDragPointInsideElement(args.targetRef.current, clientX, clientY), [args.targetRef])

  const consumeDrop = React.useCallback((payload: MediaDragPayload | null, clientX: number, clientY: number): boolean => {
    if (!payload || !isInside(clientX, clientY)) return false
    if (!args.onDropMedia(payload, resolvePositionMinutes(clientX))) return false
    clearMediaPointerDragPayload()
    return true
  }, [args, isInside, resolvePositionMinutes])

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasMediaDragPayload(event.dataTransfer) && !readMediaPointerDragPayload()) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    const payload = readMediaDragPayload(event.dataTransfer) || readMediaPointerDragPayload()
    if (!consumeDrop(payload, event.clientX, event.clientY)) return
    event.preventDefault()
    event.stopPropagation()
  }, [consumeDrop])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePointerDragDrop = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail as MediaPointerDragDropDetail | null
      if (isMediaPointerDragDropClaimed(detail)) return
      if (!consumeDrop(detail?.payload || null, Number(detail?.clientX), Number(detail?.clientY))) return
      claimMediaPointerDragDrop(detail)
      event.preventDefault()
      event.stopPropagation()
      ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
    }
    window.addEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, handlePointerDragDrop)
    return () => window.removeEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, handlePointerDragDrop)
  }, [consumeDrop])

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const handleDocumentDragOver = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !hasMediaDragPayload(dataTransfer) || !isInside(event.clientX, event.clientY)) return
      event.preventDefault()
      event.stopPropagation()
      dataTransfer.dropEffect = 'copy'
    }
    const handleDocumentDrop = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !hasMediaDragPayload(dataTransfer)) return
      if (!consumeDrop(readMediaDragPayload(dataTransfer), event.clientX, event.clientY)) return
      event.preventDefault()
      event.stopPropagation()
      ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
    }
    document.addEventListener('dragover', handleDocumentDragOver, true)
    document.addEventListener('drop', handleDocumentDrop, true)
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver, true)
      document.removeEventListener('drop', handleDocumentDrop, true)
    }
  }, [consumeDrop, isInside])

  return {
    [MEDIA_DROP_CONSUMES_CANVAS_DROP_ATTRIBUTE]: '1',
    'data-kg-video-sequence-timeline-media-drop': '1',
    onDragEnter: handleDragOver,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  }
}
