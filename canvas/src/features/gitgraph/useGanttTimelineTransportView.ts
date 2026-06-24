import React from 'react'
import {
  TIMELINE_TRANSPORT_ZOOM_LEVELS,
  resolveTimelineTransportNextZoomIndex,
  resolveTimelineTransportPlayheadPercent,
  resolveTimelineTransportPlayheadScrollLeft,
  resolveTimelineTransportZoom,
} from '@/components/timeline/timelineTransport'

export function useGanttTimelineTransportView(args: {
  maxMinutes: number
  positionMinutes: number
  rulerContentRef: React.RefObject<HTMLElement | null>
}) {
  const [timelineZoomIndex, setTimelineZoomIndex] = React.useState(0)

  const timelineZoom = React.useMemo(
    () => resolveTimelineTransportZoom(timelineZoomIndex),
    [timelineZoomIndex],
  )
  const playheadPercent = React.useMemo(
    () => resolveTimelineTransportPlayheadPercent(args.positionMinutes, args.maxMinutes),
    [args.maxMinutes, args.positionMinutes],
  )
  const canZoomOut = timelineZoomIndex > 0
  const canZoomIn = timelineZoomIndex < TIMELINE_TRANSPORT_ZOOM_LEVELS.length - 1
  const canFitTimeline = timelineZoomIndex !== 0

  const centerTimelinePlayhead = React.useCallback(() => {
    const contentElement = args.rulerContentRef.current
    const scroller = contentElement?.closest('[data-kg-gantt-timeline-ruler="bottomPanel"]') as HTMLElement | null
    if (!contentElement || !scroller || args.maxMinutes <= 0) return
    scroller.scrollLeft = resolveTimelineTransportPlayheadScrollLeft({
      contentWidth: contentElement.scrollWidth,
      max: args.maxMinutes,
      position: args.positionMinutes,
      viewportWidth: scroller.clientWidth,
    })
  }, [args.maxMinutes, args.positionMinutes, args.rulerContentRef])

  const handleZoomOut = React.useCallback(() => {
    setTimelineZoomIndex(value => resolveTimelineTransportNextZoomIndex(value, -1))
  }, [])

  const handleZoomIn = React.useCallback(() => {
    setTimelineZoomIndex(value => resolveTimelineTransportNextZoomIndex(value, 1))
  }, [])

  const handleFitTimeline = React.useCallback(() => {
    setTimelineZoomIndex(0)
    const scroller = args.rulerContentRef.current?.closest('[data-kg-gantt-timeline-ruler="bottomPanel"]') as HTMLElement | null
    if (scroller) scroller.scrollLeft = 0
  }, [args.rulerContentRef])

  return {
    canFitTimeline,
    canZoomIn,
    canZoomOut,
    centerTimelinePlayhead,
    handleFitTimeline,
    handleZoomIn,
    handleZoomOut,
    playheadPercent,
    timelineZoom,
  }
}
