import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  MEDIA_POINTER_DRAG_DROP_EVENT,
  claimMediaPointerDragDrop,
  clearMediaPointerDragPayload,
  hasMediaDragPayload,
  isMediaDragPointInsideElement,
  isMediaPointerDragDistanceAccepted,
  isMediaPointerDragDropClaimed,
  readMediaDragPayload,
  type MediaDragPayload,
  type MediaPointerDragDropDetail,
} from '@/lib/ui/mediaDragPayload'
import { controlXrSceneMediaDrop } from './xrSceneMediaDrag'

export function useXrSceneMediaDrop(args: {
  active: boolean
  targetRef: React.RefObject<HTMLElement | null>
}) {
  const consumeDrop = React.useCallback((payload: MediaDragPayload): boolean => {
    const result = controlXrSceneMediaDrop(payload)
    if (!result) return false
    useGraphStore.getState().pushUiToast({
      id: result.ok ? 'media:xr-drop:updated' : 'media:xr-drop:error',
      kind: result.ok ? 'success' : 'error',
      message: result.message,
    })
    clearMediaPointerDragPayload()
    return true
  }, [])

  const onDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!args.active || !event.dataTransfer || !hasMediaDragPayload(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [args.active])

  const onDrop = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!args.active || !event.dataTransfer) return
    const payload = readMediaDragPayload(event.dataTransfer)
    if (!payload?.xrScene || !consumeDrop(payload)) return
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation?.()
  }, [args.active, consumeDrop])

  React.useEffect(() => {
    if (!args.active || typeof window === 'undefined') return
    const onPointerDragDrop = (event: Event) => {
      const detail = (event as CustomEvent<MediaPointerDragDropDetail>).detail
      if (!detail?.payload?.xrScene || isMediaPointerDragDropClaimed(detail)) return
      if (!isMediaPointerDragDistanceAccepted(detail)) return
      if (!isMediaDragPointInsideElement(args.targetRef.current, detail.clientX, detail.clientY)) return
      claimMediaPointerDragDrop(detail)
      if (!consumeDrop(detail.payload)) {
        detail.__kgMediaPointerDropClaimed = false
        return
      }
      event.preventDefault()
      event.stopPropagation()
      ;(event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
    }
    window.addEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, onPointerDragDrop, true)
    return () => window.removeEventListener(MEDIA_POINTER_DRAG_DROP_EVENT, onPointerDragDrop, true)
  }, [args.active, args.targetRef, consumeDrop])

  return { onDragOver, onDrop }
}
