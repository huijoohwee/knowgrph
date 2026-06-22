import React from 'react'
import { Download, FileAudio, Film, Layers, LocateFixed, Maximize2, Palette, Scissors, SlidersHorizontal, SplitSquareVertical, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TimelineTransportChrome } from '@/components/timeline/TimelineTransportControls'
import {
  buildVideoSequenceExportPlan,
  downloadVideoSequenceExport,
  type VideoSequenceExportKind,
} from '@/components/timeline/videoSequenceExport'
import {
  TIMELINE_TRANSPORT_ZOOM_LEVELS,
  clampTimelineTransportValue,
  resolveTimelineTransportNextZoomIndex,
  resolveTimelineTransportPlayheadPercent,
  resolveTimelineTransportPlayheadScrollLeft,
  resolveTimelineTransportPlaybackRate,
  resolveTimelineTransportZoom,
  useTimelineTransportPlayback,
  type TimelineTransportPlaybackRate,
} from '@/components/timeline/timelineTransport'
import {
  VIDEO_SEQUENCE_TIMELINE_LANES,
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  buildVideoSequenceTimelineToolStatus,
  readVideoSequenceTimelineModelFromMarkdown,
  resolveVideoSequenceTimelineLane,
  resolveVideoSequenceTimelineLaneIndex,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
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
  insertMermaidGanttVideoSequenceOperationRow,
  splitMermaidGanttVideoSequenceClipGroupAtOffset,
  updateMermaidGanttVideoSequenceClipGroupTiming,
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

const VIDEO_SEQUENCE_TOOL_ICONS: Record<VideoSequenceTimelineToolId, LucideIcon> = {
  cut: Scissors,
  splice: SplitSquareVertical,
  mask: Layers,
  grade: Palette,
}

function isMermaidGanttTimelineVerticalMarker(span: MermaidGanttTimelineTaskSpan): boolean {
  return /(^|[:,\s])vert([,\s]|$)/i.test(span.raw)
}

function TimelineVideoSequenceToolButton({
  active,
  disabled,
  id,
  label,
  title,
  onClick,
}: {
  active?: boolean
  disabled?: boolean
  id: VideoSequenceTimelineToolId
  label: string
  title: string
  onClick: () => void
}) {
  const Icon = VIDEO_SEQUENCE_TOOL_ICONS[id]
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      data-kg-video-sequence-tool={id}
      data-kg-video-sequence-tool-active={active ? '1' : undefined}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function TimelineVideoSequenceEmptyState({
  compact,
}: {
  compact: boolean
}) {
  return (
    <section
      className={`timeline-video-sequence-empty ${compact ? 'timeline-video-sequence-empty--compact' : ''}`}
      aria-label="Timeline video sequence editor"
      data-kg-video-sequence-timeline="empty"
    >
      <header className="timeline-video-sequence-empty-header">
        <section className="timeline-video-sequence-empty-title">
          <Film className="h-4 w-4" strokeWidth={1.8} aria-hidden={true} />
          <span>Video Sequence Timeline</span>
        </section>
        <nav className="timeline-video-sequence-tool-strip" aria-label="Video sequence editing tools">
          {VIDEO_SEQUENCE_TIMELINE_TOOLS.map(tool => (
            <TimelineVideoSequenceToolButton
              key={tool.id}
              id={tool.id}
              label={tool.label}
              title={tool.title}
              disabled={true}
              onClick={() => undefined}
            />
          ))}
        </nav>
      </header>
      <section className="timeline-video-sequence-empty-grid" aria-label="Video sequence lanes">
        <aside className="timeline-video-sequence-lane-sidebar" aria-label="Video sequence lane labels">
          {VIDEO_SEQUENCE_TIMELINE_LANES.map(lane => (
            <section key={lane.id} className="timeline-video-sequence-lane-label" data-kg-video-sequence-lane-label={lane.id}>
              {lane.label}
            </section>
          ))}
        </aside>
        <section className="timeline-video-sequence-empty-ruler" aria-label="Timeline source status">
          <section className="timeline-video-sequence-empty-dropzone">
            Add Mermaid Gantt frontmatter to edit source-backed clips.
          </section>
        </section>
      </section>
    </section>
  )
}

export function GanttTimelineTransportPanel({
  code,
  compact,
}: {
  code: string
  compact: boolean
}) {
  const [timelineZoomIndex, setTimelineZoomIndex] = React.useState(0)
  const [dragState, setDragState] = React.useState<GanttTimelineTransportDragState | null>(null)
  const [dragPreview, setDragPreview] = React.useState<MermaidGanttTimelineDragPreview | null>(null)
  const [exportingKind, setExportingKind] = React.useState<VideoSequenceExportKind | ''>('')
  const rulerContentRef = React.useRef<HTMLElement | null>(null)
  const {
    markdownDocumentName,
    markdownText,
    selectedRowKey,
    transportDocumentKey,
    transportPositionMinutes,
    transportPlaying,
    transportPlaybackRate,
    setMarkdownDocument,
    setMermaidDiagramSelectedRowKey,
    setGanttTimelineTransportState,
    upsertUiToast,
  } = useGraphStore(
    useShallow(state => ({
      markdownDocumentName: state.markdownDocumentName,
      markdownText: state.markdownDocumentText || '',
      selectedRowKey: state.mermaidDiagramSelectedRowKeyByKind.gantt || '',
      transportDocumentKey: state.ganttTimelineTransportDocumentKey || '',
      transportPositionMinutes: state.ganttTimelineTransportPositionMinutes || 0,
      transportPlaying: state.ganttTimelineTransportPlaying === true,
      transportPlaybackRate: state.ganttTimelineTransportPlaybackRate || 1,
      setMarkdownDocument: state.setMarkdownDocument,
      setMermaidDiagramSelectedRowKey: state.setMermaidDiagramSelectedRowKey,
      setGanttTimelineTransportState: state.setGanttTimelineTransportState,
      upsertUiToast: state.upsertUiToast,
    })),
  )
  const timelineModel = React.useMemo(() => buildMermaidGanttTimelineModel(code), [code])
  const ticks = React.useMemo(() => buildMermaidGanttTimelineTicks(timelineModel), [timelineModel])
  const maxMinutes = Math.max(0, timelineModel.durationMinutes)
  const disabled = !code || maxMinutes <= 0
  const documentKey = String(markdownDocumentName || '').trim()
  const positionMinutes = transportDocumentKey === documentKey
    ? clampTimelineTransportValue(transportPositionMinutes, 0, maxMinutes)
    : 0
  const playing = transportDocumentKey === documentKey && transportPlaying
  const playbackRate = resolveTimelineTransportPlaybackRate(transportPlaybackRate, 1)
  const currentLabel = formatMermaidGanttTimelineOffset(positionMinutes)
  const totalLabel = formatMermaidGanttTimelineOffset(maxMinutes)
  const timelineZoom = resolveTimelineTransportZoom(timelineZoomIndex)
  const playheadPercent = resolveTimelineTransportPlayheadPercent(positionMinutes, maxMinutes)
  const selectedSpan = React.useMemo(
    () => timelineModel.taskSpans.find(span => span.rowKey === selectedRowKey) || null,
    [selectedRowKey, timelineModel.taskSpans],
  )
  const toolStatus = React.useMemo(
    () => buildVideoSequenceTimelineToolStatus({ positionMinutes, selectedSpan }),
    [positionMinutes, selectedSpan],
  )
  const videoSequenceModel = React.useMemo(
    () => readVideoSequenceTimelineModelFromMarkdown(markdownText),
    [markdownText],
  )
  const exportPlan = React.useMemo(
    () => buildVideoSequenceExportPlan({
      code,
      filenameHint: markdownDocumentName,
      sources: videoSequenceModel?.sources || [],
    }),
    [code, markdownDocumentName, videoSequenceModel?.sources],
  )
  const exportDisabled = disabled || !exportPlan || exportingKind !== ''

  const commitGanttVideoSequenceCode = React.useCallback((nextCode: string | null, nextLineIndex?: number) => {
    if (!nextCode || nextCode === code) return
    const currentStore = useGraphStore.getState()
    if (
      currentStore.markdownDocumentName !== markdownDocumentName ||
      String(currentStore.markdownDocumentText || '') !== markdownText
    ) {
      return
    }
    const nextMarkdownText = replaceFirstMermaidGanttFrontmatterCode(markdownText, nextCode)
    if (!nextMarkdownText || nextMarkdownText === markdownText) return
    setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
    const lineIndex = nextLineIndex ?? selectedSpan?.lineIndex
    const nextLine = typeof lineIndex === 'number' ? nextCode.split('\n')[lineIndex]?.trim() : ''
    if (nextLine) setMermaidDiagramSelectedRowKey('gantt', `${lineIndex}:task:${nextLine}`)
  }, [code, markdownDocumentName, markdownText, selectedSpan?.lineIndex, setMarkdownDocument, setMermaidDiagramSelectedRowKey])

  const handleVideoSequenceTool = React.useCallback((toolId: VideoSequenceTimelineToolId) => {
    if (!selectedSpan || maxMinutes <= 0) return
    if (toolId === 'cut') {
      commitGanttVideoSequenceCode(
        splitMermaidGanttVideoSequenceClipGroupAtOffset({
          code,
          rowLineIndex: selectedSpan.lineIndex,
          splitOffsetMinutes: positionMinutes - selectedSpan.startMinutes,
        }),
        selectedSpan.lineIndex,
      )
      return
    }
    if (toolId === 'splice') {
      commitGanttVideoSequenceCode(
        updateMermaidGanttVideoSequenceClipGroupTiming({
          code,
          rowLineIndex: selectedSpan.lineIndex,
          mode: 'move',
          deltaMinutes: Math.round(positionMinutes - selectedSpan.startMinutes),
        }),
        selectedSpan.lineIndex,
      )
      return
    }
    commitGanttVideoSequenceCode(
      insertMermaidGanttVideoSequenceOperationRow({
        code,
        rowLineIndex: selectedSpan.lineIndex,
        operation: toolId === 'grade' ? 'grade' : 'mask',
      }),
      selectedSpan.lineIndex + 1,
    )
  }, [code, commitGanttVideoSequenceCode, maxMinutes, positionMinutes, selectedSpan])

  const handleDownloadEditedMedia = React.useCallback(async (kind: VideoSequenceExportKind) => {
    if (!exportPlan || exportingKind) return
    setGanttTimelineTransportState({ documentKey, playing: false })
    setExportingKind(kind)
    const toastId = `video-sequence:export:${kind}`
    upsertUiToast({
      id: toastId,
      kind: 'neutral',
      message: kind === 'audio' ? 'Rendering edited audio...' : 'Rendering edited video...',
      busy: true,
      ttlMs: 30_000,
    })
    try {
      const filename = await downloadVideoSequenceExport({ kind, plan: exportPlan })
      upsertUiToast({
        id: toastId,
        kind: 'success',
        message: `Downloaded ${filename}`,
        ttlMs: 5_000,
      })
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Edited media export failed.'
      upsertUiToast({
        id: toastId,
        kind: 'error',
        message,
        ttlMs: 8_000,
      })
    } finally {
      setExportingKind('')
    }
  }, [documentKey, exportPlan, exportingKind, setGanttTimelineTransportState, upsertUiToast])

  React.useEffect(() => {
    if (maxMinutes <= 0) {
      setGanttTimelineTransportState({ documentKey, playing: false, positionMinutes: 0 })
      return
    }
    setGanttTimelineTransportState({
      documentKey,
      positionMinutes: clampTimelineTransportValue(positionMinutes, 0, maxMinutes),
    })
  }, [documentKey, maxMinutes, positionMinutes, setGanttTimelineTransportState])

  React.useEffect(() => {
    if (!selectedRowKey || playing) return
    const selectedSpan = timelineModel.taskSpans.find(span => span.rowKey === selectedRowKey)
    if (!selectedSpan) return
    setGanttTimelineTransportState({
      documentKey,
      positionMinutes: clampTimelineTransportValue(selectedSpan.startMinutes, 0, maxMinutes),
    })
  }, [documentKey, maxMinutes, playing, selectedRowKey, setGanttTimelineTransportState, timelineModel.taskSpans])

  const handlePositionChange = React.useCallback((value: number) => {
    const nextPosition = clampTimelineTransportValue(value, 0, maxMinutes)
    setGanttTimelineTransportState({ documentKey, positionMinutes: nextPosition })
    const rowKey = resolveMermaidGanttTimelineRowKeyAtPosition(timelineModel, nextPosition)
    if (rowKey && rowKey !== selectedRowKey) {
      setMermaidDiagramSelectedRowKey('gantt', rowKey)
    }
  }, [documentKey, maxMinutes, selectedRowKey, setGanttTimelineTransportState, setMermaidDiagramSelectedRowKey, timelineModel])

  const handlePlaybackEnd = React.useCallback(() => {
    setGanttTimelineTransportState({ documentKey, playing: false })
  }, [documentKey, setGanttTimelineTransportState])

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
      setGanttTimelineTransportState({
        documentKey,
        positionMinutes: clampTimelineTransportValue(nextPreview.startMinutes, 0, maxMinutes),
      })
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
      const nextCode = updateMermaidGanttVideoSequenceClipGroupTiming({
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
  }, [code, documentKey, dragState, maxMinutes, setGanttTimelineTransportState, setMarkdownDocument, setMermaidDiagramSelectedRowKey])

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
    setGanttTimelineTransportState({ documentKey, playing: false })
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
    setGanttTimelineTransportState({
      documentKey,
      positionMinutes: clampTimelineTransportValue(span.startMinutes, 0, maxMinutes),
    })
    if (selectedRowKey !== span.rowKey) {
      setMermaidDiagramSelectedRowKey('gantt', span.rowKey)
    }
  }, [documentKey, markdownDocumentName, markdownText, maxMinutes, selectedRowKey, setGanttTimelineTransportState, setMermaidDiagramSelectedRowKey])

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
        'data-kg-video-sequence-timeline': 'source-backed',
      } as React.HTMLAttributes<HTMLElement>}
      headerAside={(
        <section className="timeline-transport-header-tools" aria-label="Timeline tools">
          <nav className="timeline-video-sequence-tool-strip" aria-label="Video sequence editing tools">
            {VIDEO_SEQUENCE_TIMELINE_TOOLS.map(tool => (
              <TimelineVideoSequenceToolButton
                key={tool.id}
                id={tool.id}
                label={tool.label}
                title={tool.title}
                active={toolStatus[tool.id]}
                disabled={disabled || !toolStatus[tool.id]}
                onClick={() => handleVideoSequenceTool(tool.id)}
              />
            ))}
          </nav>
          <section className="timeline-transport-chrome-actions" aria-label="Gantt timeline tools">
          <button
            type="button"
            aria-label="Download edited video"
            title="Download edited video"
            disabled={exportDisabled}
            data-kg-video-sequence-export="video"
            onClick={() => void handleDownloadEditedMedia('video')}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Download edited audio"
            title="Download edited audio"
            disabled={exportDisabled}
            data-kg-video-sequence-export="audio"
            onClick={() => void handleDownloadEditedMedia('audio')}
          >
            <FileAudio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
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
        </section>
      )}
      ruler={(
        <section className="timeline-video-sequence-editor" aria-label="Video sequence editor">
          <aside className="timeline-video-sequence-lane-sidebar" aria-label="Video sequence lane labels">
            {VIDEO_SEQUENCE_TIMELINE_LANES.map(lane => (
              <section key={lane.id} className="timeline-video-sequence-lane-label" data-kg-video-sequence-lane-label={lane.id}>
                {lane.label}
              </section>
            ))}
          </aside>
          <section
            ref={rulerContentRef}
            className="timeline-transport-ruler-content timeline-video-sequence-ruler-content"
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
              const lane = resolveVideoSequenceTimelineLane(span)
              const laneIndex = resolveVideoSequenceTimelineLaneIndex(lane)
              return (
                <article
                  key={`span:${span.rowKey}`}
                  className={`timeline-transport-track-clip timeline-transport-track-clip--lane-${lane} ${verticalMarker ? 'timeline-transport-track-clip--milestone' : ''} ${selected ? 'timeline-transport-track-clip--selected' : ''} ${dragging ? 'timeline-transport-track-clip--dragging' : ''}`}
                  style={{
                    left: verticalMarker ? `clamp(24px, ${leftPercent}%, calc(100% - 24px))` : `${leftPercent}%`,
                    top: verticalMarker ? '0px' : `${24 + laneIndex * 18 + (index % 2) * 3}px`,
                    width: verticalMarker ? '14px' : `${Math.min(100 - leftPercent, widthPercent)}%`,
                  }}
                  aria-label={`${span.label} timeline clip`}
                  data-kg-gantt-timeline-track-span="1"
                  data-kg-gantt-timeline-track-dragging={dragging ? '1' : undefined}
                  data-kg-gantt-timeline-track-row-key={span.rowKey}
                  data-kg-video-sequence-lane={lane}
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
            <section className="timeline-video-sequence-grade-strip" aria-label="Color grading controls">
              <SlidersHorizontal className="h-3 w-3" strokeWidth={1.8} aria-hidden={true} />
              <span>Grade</span>
            </section>
          </section>
        </section>
      )}
      rulerClassName={compact ? 'timeline-transport-ruler--compact timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence' : 'timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence'}
      rulerProps={{
        'data-kg-gantt-timeline-ruler': 'bottomPanel',
      } as React.HTMLAttributes<HTMLElement>}
      step={1}
      subtitleLabel={`${timelineModel.taskSpans.length} timeline rows`}
      titleLabel="Gantt-Timeline"
      totalLabel={totalLabel}
      value={clampTimelineTransportValue(positionMinutes, 0, Math.max(1, maxMinutes))}
      onPlaybackRateChange={rate => setGanttTimelineTransportState({ documentKey, playbackRate: rate })}
      onTogglePlayback={() => setGanttTimelineTransportState({ documentKey, playing: !playing })}
      onValueChange={handlePositionChange}
    />
  )
}
