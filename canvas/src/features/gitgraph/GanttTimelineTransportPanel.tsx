import React from 'react'
import { Download, FileAudio, LocateFixed, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { TimelineTransportChrome } from '@/components/timeline/TimelineTransportControls'
import {
  VideoSequenceClipEditPanel,
  type VideoSequenceClipEditAction,
} from '@/components/timeline/VideoSequenceClipEditPanel'
import {
  TimelineVideoSequenceToolButton,
  VideoSequenceTimelineRuler,
} from '@/components/timeline/VideoSequenceTimelineRuler'
import {
  buildVideoSequenceExportSessionSurfaceModel,
  buildVideoSequenceExportPlan,
  resolveVideoSequenceExportPlanError,
  resolveVideoSequenceExportRetryControl,
  type VideoSequenceExportKind,
} from '@/components/timeline/videoSequenceExport'
import {
  clampTimelineTransportValue,
  useTimelineDocumentTransportController,
  useTimelineDocumentStoreBinding,
  useTimelineTransportPlayback,
  useTimelineTransportStoreBinding,
} from '@/components/timeline/timelineTransport'
import {
  useTimelineGanttSelectionStoreBinding,
} from '@/components/timeline/timelineSurfaceBindings'
import { useGanttTimelineDocumentActions } from './useGanttTimelineDocumentActions'
import { useGanttTimelineDisplayModel } from './useGanttTimelineDisplayModel'
import { useGanttTimelineInteractions } from './useGanttTimelineInteractions'
import { useGanttTimelineMediaDuration } from './useGanttTimelineMediaDuration'
import { useGanttTimelinePlaybackControls } from './useGanttTimelinePlaybackControls'
import { useGanttTimelineSelectionSync } from './useGanttTimelineSelectionSync'
import { useGanttTimelineTransportView } from './useGanttTimelineTransportView'
import {
  VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS,
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  buildVideoSequenceTimelineToolStatus,
  buildVideoSequenceTimelineScopes,
  readVideoSequenceTimelineModelFromMarkdown,
  resolveVisibleVideoSequenceTimelineLaneCount,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
import {
  buildMermaidGanttTimelineModel,
  buildMermaidGanttTimelineTicks,
  resolveMermaidGanttTimelineRowKeyAtPosition,
  type MermaidGanttTimelineTaskSpan,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

export function GanttTimelineTransportPanel({
  code,
  compact,
}: {
  code: string
  compact: boolean
}) {
  const rulerContentRef = React.useRef<HTMLElement | null>(null)
  const { markdownDocumentName, markdownText } = useTimelineDocumentStoreBinding()
  const { selectedRowKey, setSelectedRowKey } = useTimelineGanttSelectionStoreBinding()
  const {
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  } = useTimelineTransportStoreBinding()
  const timelineModel = React.useMemo(() => buildMermaidGanttTimelineModel(code), [code])
  const ticks = React.useMemo(() => buildMermaidGanttTimelineTicks(timelineModel), [timelineModel])
  const visibleLaneCount = React.useMemo(
    () => resolveVisibleVideoSequenceTimelineLaneCount(timelineModel.taskSpans),
    [timelineModel.taskSpans],
  )
  const maxMinutes = Math.max(0, timelineModel.durationMinutes)
  const disabled = !code || maxMinutes <= 0
  const documentKey = String(markdownDocumentName || '').trim()
  const {
    playbackPosition: positionMinutes,
    playing,
    playbackRate,
    setTransportPlaybackPosition,
    setTransportPlaying,
    setTransportPlaybackRate,
  } = useTimelineDocumentTransportController({
    documentKey,
    maxPosition: maxMinutes,
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  })
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
  const exportPlanError = React.useMemo(() => resolveVideoSequenceExportPlanError(exportPlan), [exportPlan])
  const mediaDurationSeconds = useGanttTimelineMediaDuration(exportPlan)
  const {
    currentLabel,
    displayTicks,
    hasMediaDurationScale,
    playbackUnitsPerMs,
    totalLabel,
  } = useGanttTimelineDisplayModel({
    maxMinutes,
    mediaDurationSeconds,
    positionMinutes,
    ticks,
  })
  const monitorScopes = React.useMemo(() => buildVideoSequenceTimelineScopes({
    maxMinutes,
    positionMinutes,
    sourceCount: videoSequenceModel?.sources.length || 0,
    spanCount: timelineModel.taskSpans.length,
  }), [maxMinutes, positionMinutes, timelineModel.taskSpans.length, videoSequenceModel?.sources.length])

  const {
    cancelEditedMediaExport,
    exportingKind,
    handleCommittedDragUpdate,
    handleDownloadEditedMedia,
    handleRetryEditedMediaExport,
    handleVideoSequenceClipEdit,
    handleVideoSequenceTool,
    latestRetryableExportSession,
    recentExportSessions,
  } = useGanttTimelineDocumentActions({
    code,
    exportPlan,
    markdownDocumentName,
    markdownText,
    maxMinutes,
    positionMinutes,
    selectedSpan,
    setSelectedRowKey,
    setTransportPlaying,
  })
  const exportBusy = exportingKind !== ''
  const videoExportBusy = exportingKind === 'video'
  const audioExportBusy = exportingKind === 'audio'
  const retryControl = React.useMemo(
    () => resolveVideoSequenceExportRetryControl(latestRetryableExportSession),
    [latestRetryableExportSession],
  )
  const exportSessionSurface = React.useMemo(
    () => buildVideoSequenceExportSessionSurfaceModel({
      latestRetryableRunId: latestRetryableExportSession?.runId,
      sessions: recentExportSessions,
    }),
    [latestRetryableExportSession?.runId, recentExportSessions],
  )
  const videoExportDisabled = disabled || !exportPlan || !!exportPlanError || (exportBusy && !videoExportBusy)
  const audioExportDisabled = disabled || !exportPlan || !!exportPlanError || (exportBusy && !audioExportBusy)
  const {
    dragPreview,
    draggingRowKey,
    handlePositionChange,
    handleRulerPointerScrub,
    handleTrackPointerStart,
  } = useGanttTimelineInteractions({
    markdownDocumentName,
    markdownText,
    maxMinutes,
    resolveRowKeyAtPosition: position => resolveMermaidGanttTimelineRowKeyAtPosition(timelineModel, position),
    selectedRowKey,
    setSelectedRowKey,
    setTransportPlaybackPosition,
    setTransportPlaying,
    onCommitDrag: handleCommittedDragUpdate,
  })
  const {
    canFitTimeline,
    canZoomIn,
    canZoomOut,
    centerTimelinePlayhead,
    handleFitTimeline,
    handleZoomIn,
    handleZoomOut,
    playheadPercent,
    timelineZoom,
  } = useGanttTimelineTransportView({
    maxMinutes,
    positionMinutes,
    rulerContentRef,
  })
  const {
    handlePlaybackEnd,
    handlePlaybackPointerDown,
    handleTogglePlayback,
  } = useGanttTimelinePlaybackControls({
    documentKey,
    playbackRate,
    playing,
    positionMinutes,
    setTransportPlaying,
  })
  useGanttTimelineSelectionSync({
    playing,
    selectedRowKey,
    setTransportPlaybackPosition,
    taskSpans: timelineModel.taskSpans,
  })

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
        <section className="timeline-transport-context-stack" aria-label="Video sequence timeline context">
          <VideoSequenceClipEditPanel
            disabled={disabled}
            maxMinutes={maxMinutes}
            mediaDurationSeconds={mediaDurationSeconds}
            playheadMinutes={positionMinutes}
            selectedSpan={selectedSpan}
            onAction={handleVideoSequenceClipEdit}
          />
          <section className="timeline-transport-export-sessions" aria-label="Recent edited media exports">
            {exportSessionSurface.items.length ? exportSessionSurface.items.map(session => (
              <div
                key={session.runId}
                className="timeline-transport-export-session"
                data-kg-video-sequence-export-session-mode={session.styleMode}
                data-kg-video-sequence-export-session={session.status}
                data-kg-video-sequence-export-session-tone={session.styleTone}
              >
                <span className="timeline-transport-export-session-detail">{session.detailLabel}</span>
                <span className="timeline-transport-export-session-message">{session.message}</span>
                <button
                  type="button"
                  aria-label={session.retryButtonLabel}
                  title={session.retryButtonTitle}
                  disabled={!session.retryable}
                  data-kg-video-sequence-export-session-retry={session.retryable ? 'ready' : 'disabled'}
                  onClick={() => void handleRetryEditedMediaExport(recentExportSessions.find(candidate => candidate.runId === session.runId) || null)}
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
                </button>
              </div>
            )) : (
              <div className="timeline-transport-export-session timeline-transport-export-session--empty">
                {exportSessionSurface.emptyLabel}
              </div>
            )}
          </section>
        </section>
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
            aria-label={videoExportBusy ? 'Cancel edited video export' : 'Download edited video'}
            title={videoExportBusy ? 'Cancel edited video export' : (exportPlanError || 'Download edited video')}
            disabled={videoExportDisabled}
            data-kg-video-sequence-export="video"
            onClick={() => void (videoExportBusy ? cancelEditedMediaExport('video') : handleDownloadEditedMedia('video'))}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label={audioExportBusy ? 'Cancel edited audio export' : 'Download edited audio'}
            title={audioExportBusy ? 'Cancel edited audio export' : (exportPlanError || 'Download edited audio')}
            disabled={audioExportDisabled}
            data-kg-video-sequence-export="audio"
            onClick={() => void (audioExportBusy ? cancelEditedMediaExport('audio') : handleDownloadEditedMedia('audio'))}
          >
            <FileAudio className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label={retryControl.ariaLabel}
            title={retryControl.title}
            disabled={retryControl.disabled}
            data-kg-video-sequence-export="retry"
            onClick={() => void handleRetryEditedMediaExport(latestRetryableExportSession)}
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Zoom out Gantt timeline"
            title="Zoom out"
            disabled={disabled || !canZoomOut}
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Zoom in Gantt timeline"
            title="Zoom in"
            disabled={disabled || !canZoomIn}
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-3.5 w-3.5" strokeWidth={2} aria-hidden={true} />
          </button>
          <button
            type="button"
            aria-label="Fit full Gantt timeline"
            title="Fit timeline"
            disabled={disabled || !canFitTimeline}
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
          draggingRowKey={draggingRowKey}
          maxMinutes={maxMinutes}
          playheadPercent={playheadPercent}
          selectedRowKey={selectedRowKey}
          scopes={monitorScopes}
          taskSpans={timelineModel.taskSpans}
          timelineZoom={timelineZoom}
          onRulerPointerDown={handleRulerPointerScrub}
          onSelectRowKey={setSelectedRowKey}
          onTrackPointerStart={handleTrackPointerStart}
        />
      )}
      rulerClassName={compact ? 'timeline-transport-ruler--compact timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence' : 'timeline-transport-ruler--tracks timeline-transport-ruler--video-sequence'}
      rulerProps={{
        'data-kg-gantt-timeline-ruler': 'bottomPanel',
        style: {
          '--kg-video-sequence-lane-count': visibleLaneCount,
        } as React.CSSProperties,
      } as React.HTMLAttributes<HTMLElement>}
      step={1}
      showInlineProgress={false}
      showRange={false}
      subtitleLabel={`${timelineModel.taskSpans.length} timeline rows`}
      titleLabel="Gantt-Timeline"
      totalLabel={totalLabel}
      value={clampTimelineTransportValue(positionMinutes, 0, Math.max(1, maxMinutes))}
      onPlaybackRateChange={setTransportPlaybackRate}
      onPlaybackPointerDown={handlePlaybackPointerDown}
      onTogglePlayback={handleTogglePlayback}
      onValueChange={handlePositionChange}
    />
  )
}
