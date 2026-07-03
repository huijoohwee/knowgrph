import React from 'react'
import {
  resolveMermaidGanttBarDragCommitted,
  resolveMermaidGanttBarDragPreview,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  type MermaidGanttBarDragMode,
  type MermaidGanttTimelineDragPreview,
  type MermaidGanttTimelineTaskSpan,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import { clampTimelineTransportValue } from '@/components/timeline/timelineTransport'
import {
  normalizeVideoSequenceClipEditDeltaMinutes,
  resolveVideoSequenceClipEditStepMinutes,
} from '@/components/timeline/videoSequenceClipEdit'

export type GanttTimelineTransportDragState = {
  mode: MermaidGanttBarDragMode
  pointerId: number
  originClientX: number
  minutesPerPixel: number
  stepMinutes: number
  markdownDocumentName: string | null
  markdownText: string
  span: MermaidGanttTimelineTaskSpan
}

type GanttTimelineTransportRulerScrubState = {
  pointerId: number
  rectLeft: number
  rectWidth: number
}

function resolveTimelineRulerScrubElement(eventTarget: EventTarget | null, currentTarget: HTMLElement): HTMLElement {
  const target = eventTarget instanceof HTMLElement ? eventTarget : null
  const scrubElement = target?.closest('[data-kg-gantt-timeline-ruler-content="1"],[data-kg-video-sequence-ruler-axis="1"]')
  return scrubElement instanceof HTMLElement ? scrubElement : currentTarget
}

function isTimelinePlayheadScrubTarget(eventTarget: EventTarget | null): boolean {
  const target = eventTarget instanceof HTMLElement ? eventTarget : null
  return Boolean(target?.closest('[data-kg-gantt-timeline-playhead="1"],[data-kg-video-sequence-ruler-playhead-marker="1"]'))
}

export function useGanttTimelineInteractions(args: {
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  scrubMaxMinutes?: number
  resolveRowKeyAtPosition: (position: number) => string
  selectedRowKey: string
  setSelectedRowKey: (rowKey: string) => void
  setTransportPlaybackPosition: (position: number) => void
  setTransportPlaying: (playing: boolean) => void
  onCommitDrag: (args: {
    dragState: GanttTimelineTransportDragState
    effectiveDeltaMinutes: number
  }) => void
}) {
  const [dragState, setDragState] = React.useState<GanttTimelineTransportDragState | null>(null)
  const [dragPreview, setDragPreview] = React.useState<MermaidGanttTimelineDragPreview | null>(null)
  const [rulerScrubState, setRulerScrubState] = React.useState<GanttTimelineTransportRulerScrubState | null>(null)

  const handlePositionChange = React.useCallback((value: number) => {
    const nextPosition = clampTimelineTransportValue(value, 0, args.maxMinutes)
    args.setTransportPlaybackPosition(nextPosition)
    const rowKey = args.resolveRowKeyAtPosition(nextPosition)
    if (rowKey && rowKey !== args.selectedRowKey) args.setSelectedRowKey(rowKey)
  }, [args])

  const resolveRulerScrubMinutes = React.useCallback((clientX: number, state: GanttTimelineTransportRulerScrubState) => {
    if (state.rectWidth <= 0) return 0
    const ratio = clampTimelineTransportValue((clientX - state.rectLeft) / state.rectWidth, 0, 1)
    return ratio * Math.max(args.maxMinutes, args.scrubMaxMinutes || 0)
  }, [args.maxMinutes, args.scrubMaxMinutes])

  const dragScaleMaxMinutes = Math.max(args.maxMinutes, args.scrubMaxMinutes || 0)

  React.useEffect(() => {
    if (!dragState) return
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      const preview = resolveMermaidGanttBarDragPreview({
        mode: dragState.mode,
        originClientX: dragState.originClientX,
        clientX: event.clientX,
      })
      if (!resolveMermaidGanttBarDragCommitted(preview.deltaPx)) return
      const deltaMinutes = normalizeVideoSequenceClipEditDeltaMinutes(preview.deltaPx * dragState.minutesPerPixel, dragState.stepMinutes)
      const nextPreview = resolveMermaidGanttTimelineDragPreviewSpan({
        allowTimelineExpansion: true,
        deltaMinutes,
        maxMinutes: args.maxMinutes,
        mode: dragState.mode,
        stepMinutes: dragState.stepMinutes,
        span: dragState.span,
      })
      setDragPreview(nextPreview)
      args.setTransportPlaybackPosition(nextPreview.startMinutes)
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      const preview = resolveMermaidGanttBarDragPreview({
        mode: dragState.mode,
        originClientX: dragState.originClientX,
        clientX: event.clientX,
      })
      setDragState(null)
      setDragPreview(null)
      if (!resolveMermaidGanttBarDragCommitted(preview.deltaPx)) return
      const deltaMinutes = normalizeVideoSequenceClipEditDeltaMinutes(preview.deltaPx * dragState.minutesPerPixel, dragState.stepMinutes)
      const effectiveDeltaMinutes = resolveMermaidGanttTimelineDragEffectiveDelta({
        allowTimelineExpansion: true,
        deltaMinutes,
        maxMinutes: args.maxMinutes,
        mode: dragState.mode,
        stepMinutes: dragState.stepMinutes,
        span: dragState.span,
      })
      if (effectiveDeltaMinutes === 0) return
      args.onCommitDrag({
        dragState,
        effectiveDeltaMinutes,
      })
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerEnd, { passive: true })
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [args, dragState])

  React.useEffect(() => {
    if (!rulerScrubState) return
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== rulerScrubState.pointerId) return
      event.preventDefault()
      handlePositionChange(resolveRulerScrubMinutes(event.clientX, rulerScrubState))
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== rulerScrubState.pointerId) return
      setRulerScrubState(null)
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd, { passive: true })
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [handlePositionChange, resolveRulerScrubMinutes, rulerScrubState])

  const handleRulerPointerScrub = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || args.maxMinutes <= 0) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button,[data-kg-gantt-timeline-track-span="1"]')) return
    const scrubElement = resolveTimelineRulerScrubElement(event.target, event.currentTarget)
    const rect = scrubElement.getBoundingClientRect()
    if (rect.width <= 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const nextScrubState = {
      pointerId: event.pointerId,
      rectLeft: rect.left,
      rectWidth: rect.width,
    }
    setRulerScrubState(nextScrubState)
    args.setTransportPlaying(false)
    handlePositionChange(resolveRulerScrubMinutes(event.clientX, nextScrubState))
  }, [args.maxMinutes, args.setTransportPlaying, handlePositionChange, resolveRulerScrubMinutes])

  const handleTrackPointerStart = React.useCallback((
    event: React.PointerEvent<HTMLElement>,
    span: MermaidGanttTimelineTaskSpan,
    mode: MermaidGanttBarDragMode,
  ) => {
    if (event.button !== 0 || args.maxMinutes <= 0) return
    if (isTimelinePlayheadScrubTarget(event.target)) return
    const rulerElement = event.currentTarget.closest('[data-kg-gantt-timeline-ruler-content="1"]') as HTMLElement | null
    const rulerWidth = rulerElement?.getBoundingClientRect().width || 0
    if (rulerWidth <= 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    args.setTransportPlaying(false)
    setDragState({
      mode,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      minutesPerPixel: dragScaleMaxMinutes / rulerWidth,
      stepMinutes: resolveVideoSequenceClipEditStepMinutes(span),
      markdownDocumentName: args.markdownDocumentName,
      markdownText: args.markdownText,
      span,
    })
    if (args.selectedRowKey !== span.rowKey) args.setSelectedRowKey(span.rowKey)
  }, [args, dragScaleMaxMinutes])

  return {
    dragPreview,
    draggingRowKey: dragState?.span.rowKey || '',
    handlePositionChange,
    handleRulerPointerScrub,
    handleTrackPointerStart,
  }
}
