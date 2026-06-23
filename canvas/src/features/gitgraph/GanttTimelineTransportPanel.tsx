import React from 'react'
import { Download, FileAudio, LocateFixed, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { TimelineTransportChrome } from '@/components/timeline/TimelineTransportControls'
import {
  VideoSequenceClipEditPanel,
  type VideoSequenceClipEditAction,
} from '@/components/timeline/VideoSequenceClipEditPanel'
import { VideoSequenceMonitorPanel } from '@/components/timeline/VideoSequenceMonitorPanel'
import {
  TimelineVideoSequenceToolButton,
  VideoSequenceTimelineRuler,
} from '@/components/timeline/VideoSequenceTimelineRuler'
import {
  buildVideoSequenceExportPlan,
  downloadVideoSequenceExport,
  type VideoSequenceExportPlan,
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
  VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS,
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  buildVideoSequenceTimelineToolStatus,
  buildVideoSequenceTimelineScopes,
  dispatchVideoSequenceTimelinePlaybackRequest,
  formatVideoSequenceTimelineSecondsOffset,
  readVideoSequenceSourcePlayableUrl,
  readVideoSequenceTimelineModelFromMarkdown,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelineUnitsPerMs,
  resolveVideoSequenceTimelineLane,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
import { resolveVideoSequenceSourceRuntimeUrl } from '@/components/timeline/videoSequenceSourceRegistry'
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
  type MermaidGanttVideoSequenceOperation,
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

const VIDEO_SEQUENCE_OPERATION_TOOL_SET = new Set<VideoSequenceTimelineToolId>(VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS)

function readVideoMetadataDurationSeconds(url: string): Promise<number> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    const timeoutId = window.setTimeout(() => {
      cleanup()
      resolve(0)
    }, 3000)
    const cleanup = () => {
      window.clearTimeout(timeoutId)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
      video.removeAttribute('src')
      video.load()
    }
    const onLoaded = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
      cleanup()
      resolve(duration)
    }
    const onError = () => {
      cleanup()
      resolve(0)
    }
    video.preload = 'metadata'
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
    video.src = url
    video.load()
  })
}

async function resolveVideoSequenceExportPlanDurationSeconds(plan: VideoSequenceExportPlan | null): Promise<number> {
  if (!plan?.segments.length || typeof document === 'undefined') return 0
  const sourceDurationByUrl = new Map<string, number>()
  let totalSeconds = 0
  for (const segment of plan.segments) {
    const url = readVideoSequenceSourcePlayableUrl(segment.source) || resolveVideoSequenceSourceRuntimeUrl(segment.source)
    if (!url) return 0
    let sourceDurationSeconds = sourceDurationByUrl.get(url)
    if (typeof sourceDurationSeconds !== 'number') {
      sourceDurationSeconds = await readVideoMetadataDurationSeconds(url)
      sourceDurationByUrl.set(url, sourceDurationSeconds)
    }
    if (!sourceDurationSeconds) return 0
    totalSeconds += Math.max(0, segment.sourceEndRatio - segment.sourceStartRatio) * sourceDurationSeconds
  }
  return totalSeconds
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
  const [mediaDurationSeconds, setMediaDurationSeconds] = React.useState(0)
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
  const previousSelectedRowKeyRef = React.useRef(selectedRowKey)
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
  const hasMediaDurationScale = mediaDurationSeconds > 0 && maxMinutes > 0
  const currentLabel = hasMediaDurationScale
    ? formatVideoSequenceTimelineSecondsOffset(resolveVideoSequenceTimelineMediaSeconds({
      durationSeconds: mediaDurationSeconds,
      maxMinutes,
      positionMinutes,
    }))
    : formatMermaidGanttTimelineOffset(positionMinutes)
  const totalLabel = hasMediaDurationScale
    ? formatVideoSequenceTimelineSecondsOffset(mediaDurationSeconds)
    : formatMermaidGanttTimelineOffset(maxMinutes)
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
  const activeLaneIds = React.useMemo(
    () => new Set(timelineModel.taskSpans.map(span => resolveVideoSequenceTimelineLane(span))),
    [timelineModel.taskSpans],
  )
  const monitorScopes = React.useMemo(() => buildVideoSequenceTimelineScopes({
    maxMinutes,
    positionMinutes,
    sourceCount: videoSequenceModel?.sources.length || 0,
    spanCount: timelineModel.taskSpans.length,
  }), [maxMinutes, positionMinutes, timelineModel.taskSpans.length, videoSequenceModel?.sources.length])
  const displayTicks = React.useMemo(() => {
    if (!hasMediaDurationScale) return ticks
    return ticks.map(tick => ({
      ...tick,
      label: formatVideoSequenceTimelineSecondsOffset(resolveVideoSequenceTimelineMediaSeconds({
        durationSeconds: mediaDurationSeconds,
        maxMinutes,
        positionMinutes: tick.minutes,
      })),
    }))
  }, [hasMediaDurationScale, maxMinutes, mediaDurationSeconds, ticks])
  const playbackUnitsPerMs = React.useMemo(() => resolveVideoSequenceTimelineUnitsPerMs({
    durationSeconds: mediaDurationSeconds,
    fallbackUnitsPerMs: 1 / 1000,
    maxMinutes,
  }), [maxMinutes, mediaDurationSeconds])

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
    if (!VIDEO_SEQUENCE_OPERATION_TOOL_SET.has(toolId)) return
    commitGanttVideoSequenceCode(
      insertMermaidGanttVideoSequenceOperationRow({
        code,
        rowLineIndex: selectedSpan.lineIndex,
        operation: toolId as MermaidGanttVideoSequenceOperation,
      }),
      selectedSpan.lineIndex + 1,
    )
  }, [code, commitGanttVideoSequenceCode, maxMinutes, positionMinutes, selectedSpan])

  const handleVideoSequenceClipEdit = React.useCallback((action: VideoSequenceClipEditAction) => {
    if (!selectedSpan || maxMinutes <= 0) return
    if (action === 'split-at-playhead') {
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

    let mode: MermaidGanttBarDragMode = 'move'
    let deltaMinutes = 0
    if (action === 'nudge-back') {
      deltaMinutes = -Math.min(1, Math.max(0, selectedSpan.startMinutes))
    } else if (action === 'nudge-forward') {
      deltaMinutes = 1
    } else if (action === 'trim-start-back') {
      mode = 'resize-start'
      deltaMinutes = -Math.min(1, Math.max(0, selectedSpan.startMinutes))
    } else if (action === 'trim-start-forward') {
      mode = 'resize-start'
      deltaMinutes = Math.min(1, Math.max(0, selectedSpan.durationMinutes - 1))
    } else if (action === 'trim-end-back') {
      mode = 'resize-end'
      deltaMinutes = -Math.min(1, Math.max(0, selectedSpan.durationMinutes - 1))
    } else if (action === 'trim-end-forward') {
      mode = 'resize-end'
      deltaMinutes = 1
    } else if (action === 'snap-to-playhead') {
      deltaMinutes = Math.round(positionMinutes - selectedSpan.startMinutes)
    }
    if (!deltaMinutes) return
    commitGanttVideoSequenceCode(
      updateMermaidGanttVideoSequenceClipGroupTiming({
        code,
        rowLineIndex: selectedSpan.lineIndex,
        mode,
        deltaMinutes,
      }),
      selectedSpan.lineIndex,
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
    let cancelled = false
    setMediaDurationSeconds(0)
    if (!exportPlan) return () => {
      cancelled = true
    }
    void resolveVideoSequenceExportPlanDurationSeconds(exportPlan).then(durationSeconds => {
      if (cancelled) return
      setMediaDurationSeconds(Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0)
    })
    return () => {
      cancelled = true
    }
  }, [exportPlan])

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
    const previousSelectedRowKey = previousSelectedRowKeyRef.current
    if (previousSelectedRowKey === selectedRowKey) return
    previousSelectedRowKeyRef.current = selectedRowKey
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

  const handleRulerPointerScrub = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || maxMinutes <= 0) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button,[data-kg-gantt-timeline-track-span="1"]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = clampTimelineTransportValue((event.clientX - rect.left) / rect.width, 0, 1)
    setGanttTimelineTransportState({ documentKey, playing: false })
    handlePositionChange(ratio * maxMinutes)
  }, [documentKey, handlePositionChange, maxMinutes, setGanttTimelineTransportState])

  const handlePlaybackEnd = React.useCallback(() => {
    setGanttTimelineTransportState({ documentKey, playing: false })
  }, [documentKey, setGanttTimelineTransportState])

  const requestMediaPlayback = React.useCallback((nextPlaying: boolean) => {
    dispatchVideoSequenceTimelinePlaybackRequest({
      documentKey,
      playbackRate,
      playing: nextPlaying,
      positionMinutes,
    })
  }, [documentKey, playbackRate, positionMinutes])

  const handlePlaybackPointerDown = React.useCallback(() => {
    requestMediaPlayback(!playing)
  }, [playing, requestMediaPlayback])

  const handleTogglePlayback = React.useCallback(() => {
    const nextPlaying = !playing
    setGanttTimelineTransportState({ documentKey, playing: nextPlaying })
    requestMediaPlayback(nextPlaying)
  }, [documentKey, playing, requestMediaPlayback, setGanttTimelineTransportState])

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
        allowTimelineExpansion: true,
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
        allowTimelineExpansion: true,
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
    unitsPerMs: playbackUnitsPerMs,
    onPositionChange: handlePositionChange,
    onPlaybackEnd: handlePlaybackEnd,
  })

  return (
    <TimelineTransportChrome
      ariaLabel="Scrub Gantt-timeline position"
      chromeClassName="timeline-transport-chrome--mermaid-gantt p-2"
      currentLabel={currentLabel}
      contextControls={(
        <VideoSequenceClipEditPanel
          disabled={disabled}
          maxMinutes={maxMinutes}
          mediaDurationSeconds={mediaDurationSeconds}
          playheadMinutes={positionMinutes}
          selectedSpan={selectedSpan}
          onAction={handleVideoSequenceClipEdit}
        />
      )}
      disabled={disabled}
      max={Math.max(1, maxMinutes)}
      min={0}
      playbackRate={playbackRate}
      playing={playing}
      shellClassName="timeline-transport-shell--video-sequence"
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
        <VideoSequenceTimelineRuler
          contentRef={rulerContentRef}
          displayTicks={displayTicks}
          dragPreview={dragPreview}
          draggingRowKey={dragState?.span.rowKey || ''}
          maxMinutes={maxMinutes}
          playheadPercent={playheadPercent}
          selectedRowKey={selectedRowKey}
          taskSpans={timelineModel.taskSpans}
          timelineZoom={timelineZoom}
          onRulerPointerDown={handleRulerPointerScrub}
          onSelectRowKey={rowKey => setMermaidDiagramSelectedRowKey('gantt', rowKey)}
          onTrackPointerStart={handleTrackPointerStart}
        />
      )}
      rulerAside={(
        <VideoSequenceMonitorPanel
          activeLaneIds={activeLaneIds}
          currentLabel={currentLabel}
          scopes={monitorScopes}
          sourceCount={videoSequenceModel?.sources.length || 0}
        />
      )}
      rulerClassName={compact ? 'timeline-transport-ruler--compact timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence' : 'timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence'}
      rulerProps={{
        'data-kg-gantt-timeline-ruler': 'bottomPanel',
        style: {
          '--kg-video-sequence-lane-count': VIDEO_SEQUENCE_TIMELINE_LANES.length,
        } as React.CSSProperties,
      } as React.HTMLAttributes<HTMLElement>}
      step={1}
      showRange={false}
      subtitleLabel={`${timelineModel.taskSpans.length} timeline rows`}
      titleLabel="Gantt-Timeline"
      totalLabel={totalLabel}
      value={clampTimelineTransportValue(positionMinutes, 0, Math.max(1, maxMinutes))}
      onPlaybackRateChange={rate => setGanttTimelineTransportState({ documentKey, playbackRate: rate })}
      onPlaybackPointerDown={handlePlaybackPointerDown}
      onTogglePlayback={handleTogglePlayback}
      onValueChange={handlePositionChange}
    />
  )
}
