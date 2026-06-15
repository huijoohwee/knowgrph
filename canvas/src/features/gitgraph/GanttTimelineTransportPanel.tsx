import React from 'react'
import { LocateFixed, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TimelineTransportChrome } from '@/components/timeline/TimelineTransportControls'
import {
  TIMELINE_TRANSPORT_ZOOM_LEVELS,
  clampTimelineTransportValue,
  resolveTimelineTransportNextZoomIndex,
  resolveTimelineTransportPlayheadPercent,
  resolveTimelineTransportPlayheadScrollLeft,
  resolveTimelineTransportZoom,
  useTimelineTransportPlayback,
  type TimelineTransportPlaybackRate,
} from '@/components/timeline/timelineTransport'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildMermaidGanttTimelineModel,
  buildMermaidGanttTimelineTicks,
  formatMermaidGanttTimelineOffset,
  replaceFirstMermaidGanttFrontmatterCode,
  resolveMermaidGanttBarDragCommitted,
  resolveMermaidGanttBarDragPreview,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  resolveMermaidGanttTimelineRowKeyAtPosition,
  updateMermaidGanttCodeRowTiming,
  type MermaidGanttBarDragMode,
  type MermaidGanttTimelineDragPreview,
  type MermaidGanttTimelineTaskSpan,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

type GanttTimelineTransportDragState = {
  mode: MermaidGanttBarDragMode
  pointerId: number
  originClientX: number
  minutesPerPixel: number
  markdownDocumentName: string | null
  markdownText: string
  span: MermaidGanttTimelineTaskSpan
}

function isMermaidGanttTimelineVerticalMarker(span: MermaidGanttTimelineTaskSpan): boolean {
  return /(^|[:,\s])vert([,\s]|$)/i.test(span.raw)
}

export function GanttTimelineTransportPanel({
  code,
  compact,
}: {
  code: string
  compact: boolean
}) {
  const [positionMinutes, setPositionMinutes] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [playbackRate, setPlaybackRate] = React.useState<TimelineTransportPlaybackRate>(1)
  const [timelineZoomIndex, setTimelineZoomIndex] = React.useState(0)
  const [dragState, setDragState] = React.useState<GanttTimelineTransportDragState | null>(null)
  const [dragPreview, setDragPreview] = React.useState<MermaidGanttTimelineDragPreview | null>(null)
  const rulerContentRef = React.useRef<HTMLElement | null>(null)
  const {
    markdownDocumentName,
    markdownText,
    selectedRowKey,
    setMarkdownDocument,
    setMermaidDiagramSelectedRowKey,
  } = useGraphStore(
    useShallow(state => ({
      markdownDocumentName: state.markdownDocumentName,
      markdownText: state.markdownDocumentText || '',
      selectedRowKey: state.mermaidDiagramSelectedRowKeyByKind.gantt || '',
      setMarkdownDocument: state.setMarkdownDocument,
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
    })),
  )
  const timelineModel = React.useMemo(() => buildMermaidGanttTimelineModel(code), [code])
  const ticks = React.useMemo(() => buildMermaidGanttTimelineTicks(timelineModel), [timelineModel])
  const maxMinutes = Math.max(0, timelineModel.durationMinutes)
  const disabled = !code || maxMinutes <= 0
  const currentLabel = formatMermaidGanttTimelineOffset(positionMinutes)
  const totalLabel = formatMermaidGanttTimelineOffset(maxMinutes)
  const timelineZoom = resolveTimelineTransportZoom(timelineZoomIndex)
  const playheadPercent = resolveTimelineTransportPlayheadPercent(positionMinutes, maxMinutes)

  React.useEffect(() => {
    if (maxMinutes <= 0) {
      setPlaying(false)
      setPositionMinutes(0)
      return
    }
    setPositionMinutes(value => clampTimelineTransportValue(value, 0, maxMinutes))
  }, [maxMinutes])

  React.useEffect(() => {
    if (!selectedRowKey || playing) return
    const selectedSpan = timelineModel.taskSpans.find(span => span.rowKey === selectedRowKey)
    if (!selectedSpan) return
    setPositionMinutes(clampTimelineTransportValue(selectedSpan.startMinutes, 0, maxMinutes))
  }, [maxMinutes, playing, selectedRowKey, timelineModel.taskSpans])

  const handlePositionChange = React.useCallback((value: number) => {
    const nextPosition = clampTimelineTransportValue(value, 0, maxMinutes)
    setPositionMinutes(nextPosition)
    const rowKey = resolveMermaidGanttTimelineRowKeyAtPosition(timelineModel, nextPosition)
    if (rowKey && rowKey !== selectedRowKey) {
      setMermaidDiagramSelectedRowKey('gantt', rowKey)
    }
  }, [maxMinutes, selectedRowKey, setMermaidDiagramSelectedRowKey, timelineModel])

  const handlePlaybackEnd = React.useCallback(() => {
    setPlaying(false)
  }, [])

  const centerTimelinePlayhead = React.useCallback(() => {
    const contentElement = rulerContentRef.current
    const scroller = contentElement?.closest('[data-kg-gantt-timeline-ruler="bottomPanel"]') as HTMLElement | null
    if (!contentElement || !scroller || maxMinutes <= 0) return
    scroller.scrollLeft = resolveTimelineTransportPlayheadScrollLeft({
      contentWidth: contentElement.scrollWidth,
      max: maxMinutes,
      position: positionMinutes,
      viewportWidth: scroller.clientWidth,
    })
  }, [maxMinutes, positionMinutes])

  const handleZoomOut = React.useCallback(() => {
    setTimelineZoomIndex(value => resolveTimelineTransportNextZoomIndex(value, -1))
  }, [])

  const handleZoomIn = React.useCallback(() => {
    setTimelineZoomIndex(value => resolveTimelineTransportNextZoomIndex(value, 1))
  }, [])

  const handleFitTimeline = React.useCallback(() => {
    setTimelineZoomIndex(0)
    const scroller = rulerContentRef.current?.closest('[data-kg-gantt-timeline-ruler="bottomPanel"]') as HTMLElement | null
    if (scroller) scroller.scrollLeft = 0
  }, [])

  React.useEffect(() => {
    if (!dragState) return
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return
      const preview = resolveMermaidGanttBarDragPreview({
        mode: dragState.mode,
        originClientX: dragState.originClientX,
        clientX: event.clientX,
      })
      const deltaMinutes = Math.round(preview.deltaPx * dragState.minutesPerPixel)
      const nextPreview = resolveMermaidGanttTimelineDragPreviewSpan({
        deltaMinutes,
        maxMinutes,
        mode: dragState.mode,
        span: dragState.span,
      })
      setDragPreview(nextPreview)
      setPositionMinutes(clampTimelineTransportValue(nextPreview.startMinutes, 0, maxMinutes))
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
      const deltaMinutes = Math.round(preview.deltaPx * dragState.minutesPerPixel)
      const effectiveDeltaMinutes = resolveMermaidGanttTimelineDragEffectiveDelta({
        deltaMinutes,
        maxMinutes,
        mode: dragState.mode,
        span: dragState.span,
      })
      if (effectiveDeltaMinutes === 0) return
      const currentStore = useGraphStore.getState()
      if (
        currentStore.markdownDocumentName !== dragState.markdownDocumentName ||
        String(currentStore.markdownDocumentText || '') !== dragState.markdownText
      ) {
        return
      }
      const nextCode = updateMermaidGanttCodeRowTiming({
        code,
        rowLineIndex: dragState.span.lineIndex,
        mode: dragState.mode,
        deltaMinutes: effectiveDeltaMinutes,
      })
      const nextMarkdownText = nextCode ? replaceFirstMermaidGanttFrontmatterCode(dragState.markdownText, nextCode) : null
      if (!nextMarkdownText || nextMarkdownText === dragState.markdownText) return
      setMarkdownDocument(dragState.markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
      const nextLine = nextCode.split('\n')[dragState.span.lineIndex]?.trim()
      if (nextLine) {
        setMermaidDiagramSelectedRowKey('gantt', `${dragState.span.lineIndex}:task:${nextLine}`)
      }
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerEnd, { passive: true })
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [code, dragState, maxMinutes, setMarkdownDocument, setMermaidDiagramSelectedRowKey])

  const handleTrackPointerStart = React.useCallback((
    event: React.PointerEvent<HTMLElement>,
    span: MermaidGanttTimelineTaskSpan,
    mode: MermaidGanttBarDragMode,
  ) => {
    if (event.button !== 0 || maxMinutes <= 0) return
    const rulerElement = event.currentTarget.closest('[data-kg-gantt-timeline-ruler-content="1"]') as HTMLElement | null
    const rulerWidth = rulerElement?.getBoundingClientRect().width || 0
    if (rulerWidth <= 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setPlaying(false)
    setDragPreview({
      durationMinutes: span.durationMinutes,
      rowKey: span.rowKey,
      startMinutes: span.startMinutes,
    })
    setDragState({
      mode,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      minutesPerPixel: maxMinutes / rulerWidth,
      markdownDocumentName,
      markdownText,
      span,
    })
    setPositionMinutes(clampTimelineTransportValue(span.startMinutes, 0, maxMinutes))
    if (selectedRowKey !== span.rowKey) {
      setMermaidDiagramSelectedRowKey('gantt', span.rowKey)
    }
  }, [markdownDocumentName, markdownText, maxMinutes, selectedRowKey, setMermaidDiagramSelectedRowKey])

  useTimelineTransportPlayback({
    active: !disabled,
    playing,
    position: positionMinutes,
    max: maxMinutes,
    playbackRate,
    unitsPerMs: 1 / 1000,
    onPositionChange: handlePositionChange,
    onPlaybackEnd: handlePlaybackEnd,
  })

  return (
    <TimelineTransportChrome
      ariaLabel="Scrub Gantt-timeline position"
      chromeClassName="timeline-transport-chrome--mermaid-gantt p-2"
      currentLabel={currentLabel}
      disabled={disabled}
      max={Math.max(1, maxMinutes)}
      min={0}
      playbackRate={playbackRate}
      playing={playing}
      rootProps={{
        'aria-label': 'Gantt-Timeline transport',
        'data-kg-gantt-timeline-transport': 'bottomPanel',
      } as React.HTMLAttributes<HTMLElement>}
      headerAside={(
        <section className="timeline-transport-chrome-actions" aria-label="Gantt timeline tools">
          <button
            type="button"
            aria-label="Zoom out Gantt timeline"
            title="Zoom out"
            disabled={disabled || timelineZoomIndex <= 0}
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Zoom in Gantt timeline"
            title="Zoom in"
            disabled={disabled || timelineZoomIndex >= TIMELINE_TRANSPORT_ZOOM_LEVELS.length - 1}
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Fit full Gantt timeline"
            title="Fit timeline"
            disabled={disabled || timelineZoomIndex === 0}
            onClick={handleFitTimeline}
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Center Gantt playhead"
            title="Center playhead"
            disabled={disabled}
            onClick={centerTimelinePlayhead}
          >
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
        </section>
      )}
      ruler={(
        <section
          ref={rulerContentRef}
          className="timeline-transport-ruler-content"
          style={{ width: `${timelineZoom * 100}%` }}
          data-kg-gantt-timeline-ruler-content="1"
          data-kg-gantt-timeline-zoom={String(timelineZoom)}
        >
          <span
            className="timeline-transport-playhead"
            style={{ left: `clamp(14px, ${playheadPercent}%, calc(100% - 14px))` }}
            data-kg-gantt-timeline-playhead="1"
            aria-hidden="true"
          >
            <span className="timeline-transport-playhead-marker" />
          </span>
          {ticks.map(tick => (
            <React.Fragment key={`${tick.minutes}:${tick.label}`}>
              <span
                className="timeline-transport-ruler-tick"
                style={{ left: `clamp(14px, ${tick.percent}%, calc(100% - 14px))` }}
                data-kg-gantt-timeline-tick="1"
              >
                <span className="timeline-transport-ruler-tick-line" />
                <span>{tick.label}</span>
              </span>
            </React.Fragment>
          ))}
          {timelineModel.taskSpans.map((span, index) => {
            const verticalMarker = isMermaidGanttTimelineVerticalMarker(span)
            const previewSpan = dragPreview?.rowKey === span.rowKey ? dragPreview : null
            const startMinutes = previewSpan?.startMinutes ?? span.startMinutes
            const durationMinutes = previewSpan?.durationMinutes ?? span.durationMinutes
            const leftPercent = maxMinutes > 0 ? (startMinutes / maxMinutes) * 100 : 0
            const widthPercent = maxMinutes > 0 ? Math.max(2, (durationMinutes / maxMinutes) * 100) : 0
            const selected = selectedRowKey === span.rowKey
            const dragging = dragState?.span.rowKey === span.rowKey
            return (
              <article
                key={`span:${span.rowKey}`}
                className={`timeline-transport-track-clip ${verticalMarker ? 'timeline-transport-track-clip--milestone' : ''} ${selected ? 'timeline-transport-track-clip--selected' : ''} ${dragging ? 'timeline-transport-track-clip--dragging' : ''}`}
                style={{
                  left: verticalMarker ? `clamp(24px, ${leftPercent}%, calc(100% - 24px))` : `${leftPercent}%`,
                  top: verticalMarker ? '0px' : `${24 + (index % 2) * 16}px`,
                  width: verticalMarker ? '14px' : `${Math.min(100 - leftPercent, widthPercent)}%`,
                }}
                aria-label={`${span.label} timeline clip`}
                data-kg-gantt-timeline-track-span="1"
                data-kg-gantt-timeline-track-dragging={dragging ? '1' : undefined}
                data-kg-gantt-timeline-track-row-key={span.rowKey}
                title={span.label}
              >
                <button
                  type="button"
                  className="timeline-transport-track-handle timeline-transport-track-handle--start"
                  aria-label={`Resize ${span.label} start`}
                  data-kg-gantt-timeline-track-drag-mode="resize-start"
                  onPointerDown={event => handleTrackPointerStart(event, span, 'resize-start')}
                />
                <button
                  type="button"
                  className="timeline-transport-track-clip-move"
                  aria-label={`Move ${span.label}`}
                  data-kg-gantt-timeline-track-drag-mode="move"
                  onClick={() => setMermaidDiagramSelectedRowKey('gantt', span.rowKey)}
                  onPointerDown={event => handleTrackPointerStart(event, span, 'move')}
                >
                  <span className="timeline-transport-track-clip-label">{span.label}</span>
                </button>
                <button
                  type="button"
                  className="timeline-transport-track-handle timeline-transport-track-handle--end"
                  aria-label={`Resize ${span.label} end`}
                  data-kg-gantt-timeline-track-drag-mode="resize-end"
                  onPointerDown={event => handleTrackPointerStart(event, span, 'resize-end')}
                />
              </article>
            )
          })}
        </section>
      )}
      rulerClassName={compact ? 'timeline-transport-ruler--compact timeline-transport-ruler--tracks' : 'timeline-transport-ruler--tracks'}
      rulerProps={{
        'data-kg-gantt-timeline-ruler': 'bottomPanel',
      } as React.HTMLAttributes<HTMLElement>}
      step={1}
      subtitleLabel={`${timelineModel.taskSpans.length} timeline rows`}
      titleLabel="Gantt-Timeline"
      totalLabel={totalLabel}
      value={clampTimelineTransportValue(positionMinutes, 0, Math.max(1, maxMinutes))}
      onPlaybackRateChange={setPlaybackRate}
      onTogglePlayback={() => setPlaying(value => !value)}
      onValueChange={handlePositionChange}
    />
  )
}
