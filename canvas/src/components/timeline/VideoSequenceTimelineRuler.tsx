import React from 'react'
import { Blend, Film, Filter, Gauge, GitCompareArrows, KeyRound, Layers, Palette, Scissors, SlidersHorizontal, Sparkles, SplitSquareVertical, Type, type LucideIcon } from 'lucide-react'
import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import { buildTimelineAnimationState } from './timelineAnimationEngine'
import { VideoSequenceClipThumbnailStrip } from './VideoSequenceClipThumbnailStrip'
import { VideoSequenceCompactFbfRail } from './VideoSequenceCompactMediaLane'
import { buildVideoSequenceGeneratedFrameThumbnails } from './videoSequenceGeneratedFrameThumbnails'
import {
  VIDEO_SEQUENCE_BOTTOM_PANEL_DISABLED_LANE_IDS,
  VIDEO_SEQUENCE_TIMELINE_LANES,
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  buildVideoSequenceTimelineCueSamples,
  buildVideoSequenceTimelineFrameSamples,
  buildVideoSequenceTimelineWaveformSamples,
  formatVideoSequenceTimelineSecondsOffset,
  isVideoAgentCompactFbfSpan,
  isVideoAgentCompactMediaSpan,
  resolveRenderableVideoSequenceTimelineSpans,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelineLane,
  resolveVisibleVideoSequenceTimelineLanes,
  type VideoSequenceTimelineLane,
  type VideoSequenceTimelineLaneId,
  type VideoSequenceTimelineProjectionOptions,
  type VideoSequenceTimelineScope,
  type VideoSequenceTimelineToolId,
} from './videoSequenceTimeline'
import { readMermaidGanttTaskSourceRangeMinutes, type MermaidGanttBarDragMode, type MermaidGanttTimelineDragPreview, type MermaidGanttTimelineTaskSpan, type MermaidGanttTimelineTick } from '@/lib/mermaid/mermaidGanttBarInteraction'
import './VideoSequenceTimelineRuler.css'
export const VIDEO_SEQUENCE_LANE_HEIGHT_PX = 42
export const VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX = 24
export const VIDEO_SEQUENCE_RULER_SCOPE_STRIP_PX = 24
export const VIDEO_SEQUENCE_RULER_FOOTER_PX = 28 + VIDEO_SEQUENCE_RULER_SCOPE_STRIP_PX
export type VideoSequenceTimelineThumbnailWindow = { sourceEndSeconds: number; sourceStartSeconds: number; timelineEndMinutes: number; timelineStartMinutes: number }
const VIDEO_SEQUENCE_RESIZE_MODE_LABELS: Record<Extract<MermaidGanttBarDragMode, 'resize-start' | 'resize-end'>, string> = {
  'resize-end': 'end',
  'resize-start': 'start',
}
const VIDEO_SEQUENCE_THUMBNAIL_WINDOW_EPSILON = 0.001
const VIDEO_SEQUENCE_DENSE_FBF_MAX_DURATION_MINUTES = 1.25 / 60
const VIDEO_SEQUENCE_SOURCE_CONTENT_LANES = new Set<VideoSequenceTimelineLaneId>(['video', 'image', 'scene'])
const VIDEO_SEQUENCE_OPERATION_CONTENT_LANES = new Set<VideoSequenceTimelineLaneId>(['mask', 'grade', 'audio'])
const VIDEO_SEQUENCE_GENERATED_FRAME_CONTENT_LANES = new Set<VideoSequenceTimelineLaneId>(['fbf'])
const VIDEO_SEQUENCE_BOTTOM_PANEL_PROJECTION_OPTIONS = { disabledLaneIds: VIDEO_SEQUENCE_BOTTOM_PANEL_DISABLED_LANE_IDS } as const
function resolveVideoSequenceThumbnailWindow(args: {
  span: MermaidGanttTimelineTaskSpan
  windows: readonly VideoSequenceTimelineThumbnailWindow[]
}): VideoSequenceTimelineThumbnailWindow | null {
  return args.windows.find(window =>
    Math.abs(window.timelineStartMinutes - args.span.startMinutes) <= VIDEO_SEQUENCE_THUMBNAIL_WINDOW_EPSILON &&
    Math.abs(window.timelineEndMinutes - args.span.endMinutes) <= VIDEO_SEQUENCE_THUMBNAIL_WINDOW_EPSILON,
  ) || null
}

function resolveVideoSequenceSpanThumbnailWindow(args: {
  allowTimelineFallback: boolean
  span: MermaidGanttTimelineTaskSpan
  windows: readonly VideoSequenceTimelineThumbnailWindow[]
}): VideoSequenceTimelineThumbnailWindow | null {
  const sourceRange = readMermaidGanttTaskSourceRangeMinutes(args.span.raw)
  if (sourceRange) {
    return {
      sourceEndSeconds: Math.max(sourceRange.startMinutes + 0.0001, sourceRange.endMinutes),
      sourceStartSeconds: Math.max(0, sourceRange.startMinutes),
      timelineEndMinutes: args.span.endMinutes,
      timelineStartMinutes: args.span.startMinutes,
    }
  }
  const existingWindow = resolveVideoSequenceThumbnailWindow({ span: args.span, windows: args.windows })
  if (existingWindow) return existingWindow
  if (!sourceRange && !args.allowTimelineFallback) return null
  const fallbackStart = args.span.startMinutes
  const fallbackEnd = args.span.endMinutes
  const sourceStartSeconds = Math.max(0, fallbackStart)
  const sourceEndSeconds = Math.max(sourceStartSeconds + 0.0001, fallbackEnd)
  if (!Number.isFinite(sourceStartSeconds) || !Number.isFinite(sourceEndSeconds)) return null
  return {
    sourceEndSeconds,
    sourceStartSeconds,
    timelineEndMinutes: args.span.endMinutes,
    timelineStartMinutes: args.span.startMinutes,
  }
}

function resolveVideoSequenceClipThumbnails(args: {
  sourceWindow: VideoSequenceTimelineThumbnailWindow | null
  sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
  span: MermaidGanttTimelineTaskSpan
}): readonly TimelineMediaReaderThumbnail[] {
  if (!args.sourceThumbnails.length) return []
  const window = args.sourceWindow
  if (!window) return []
  const sourceStart = Math.min(window.sourceStartSeconds, window.sourceEndSeconds)
  const sourceEnd = Math.max(window.sourceStartSeconds, window.sourceEndSeconds)
  const withinWindow = args.sourceThumbnails.filter(thumbnail =>
    thumbnail.timestampSeconds >= sourceStart - 0.05 &&
    thumbnail.timestampSeconds <= sourceEnd + 0.05,
  )
  if (withinWindow.length) return withinWindow
  return []
}

function resolveActiveVideoSequenceResizeMode(args: {
  dragging: boolean
  previewSpan: MermaidGanttTimelineDragPreview | null
  span: MermaidGanttTimelineTaskSpan
}): Extract<MermaidGanttBarDragMode, 'resize-start' | 'resize-end'> | null {
  if (!args.dragging || !args.previewSpan) return null
  if (args.previewSpan.rowKey !== args.span.rowKey) return null
  if (args.previewSpan.startMinutes !== args.span.startMinutes) return 'resize-start'
  if (args.previewSpan.durationMinutes !== args.span.durationMinutes) return 'resize-end'
  return null
}

const VIDEO_SEQUENCE_TOOL_ICONS: Record<VideoSequenceTimelineToolId, LucideIcon> = {
  adjustment: Blend,
  cut: Scissors,
  effect: Sparkles,
  detached: Layers,
  fbf: Film,
  filter: Filter,
  grade: Palette,
  keyframe: KeyRound,
  mask: Layers,
  modifier: Sparkles,
  morph: GitCompareArrows,
  nested: GitCompareArrows,
  record: Gauge,
  speed: Gauge,
  splice: SplitSquareVertical,
  text: Type,
  transition: SlidersHorizontal,
}

export function buildVideoSequenceLaneSidebarStyle(lanes: readonly VideoSequenceTimelineLane[] = VIDEO_SEQUENCE_TIMELINE_LANES): React.CSSProperties {
  return {
    gridTemplateRows: `repeat(${lanes.length}, ${VIDEO_SEQUENCE_LANE_HEIGHT_PX}px)`,
  }
}

export function resolveVideoSequenceRulerMinHeight(laneCount = VIDEO_SEQUENCE_TIMELINE_LANES.length): number {
  return VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX + (laneCount * VIDEO_SEQUENCE_LANE_HEIGHT_PX) + VIDEO_SEQUENCE_RULER_FOOTER_PX
}

export function TimelineVideoSequenceToolButton({
  active,
  disabled,
  id,
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
    </button>
  )
}

export function TimelineVideoSequenceEmptyState({
  compact,
}: {
  compact: boolean
}) {
  const visibleLanes = React.useMemo(() => resolveVisibleVideoSequenceTimelineLanes([], VIDEO_SEQUENCE_BOTTOM_PANEL_PROJECTION_OPTIONS), [])
  const minHeight = resolveVideoSequenceRulerMinHeight(visibleLanes.length)
  const animationState = React.useMemo(() => buildTimelineAnimationState({
    active: false,
    itemCount: visibleLanes.length,
    progress: 0,
    surface: 'bottom-timeline',
  }), [visibleLanes.length])
  const { style: animationStyle, ...animationAttributes } = animationState.attributes
  return (
    <section
      className={`timeline-video-sequence-empty ${compact ? 'timeline-video-sequence-empty--compact' : ''}`}
      aria-label="Timeline video sequence editor"
      data-kg-video-sequence-timeline="empty"
      {...animationAttributes}
      style={animationStyle}
    >
      <header className="timeline-video-sequence-empty-header">
        <section className="timeline-video-sequence-empty-title">
          <Film className="h-4 w-4" strokeWidth={1.8} aria-hidden={true} />
          <span>Video Sequence Timeline</span>
        </section>
        <nav className="timeline-video-sequence-tool-strip" aria-label="Video sequence editing tools">
          {VIDEO_SEQUENCE_TIMELINE_TOOLS.map(tool => (
            <TimelineVideoSequenceToolButton key={tool.id} id={tool.id} label={tool.label} title={tool.title} disabled={true} onClick={() => undefined} />
          ))}
        </nav>
      </header>
      <section className="timeline-video-sequence-empty-grid" aria-label="Video sequence lanes" style={{ minHeight }}>
        <aside className="timeline-video-sequence-lane-sidebar" aria-label="Video sequence lane labels" style={buildVideoSequenceLaneSidebarStyle(visibleLanes)}>
          {visibleLanes.map(lane => (
            <section key={lane.id} className="timeline-video-sequence-lane-label" data-kg-video-sequence-lane-label={lane.id}>
              {lane.label}
            </section>
          ))}
        </aside>
        <section className="timeline-video-sequence-empty-ruler" aria-label="Timeline source status" style={{ minHeight }}>
          <section className="timeline-video-sequence-empty-dropzone">
            Add Mermaid Gantt frontmatter to edit source-backed clips.
          </section>
        </section>
      </section>
    </section>
  )
}

export function VideoSequenceTimelineRuler({
  contentRef,
  displayTicks,
  dragPreview,
  draggingRowKey,
  maxMinutes,
  mediaDurationSeconds = 0,
  playheadPercent,
  selectedRowKey,
  sourceThumbnails = [],
  sourceThumbnailWindows = [],
  scopes = [],
  taskSpans,
  timelineZoom,
  disabledLaneIds = VIDEO_SEQUENCE_BOTTOM_PANEL_DISABLED_LANE_IDS,
  onRulerPointerDown,
  onSelectRowKey,
  onSelectRowPosition,
  onTrackPointerStart,
}: {
  contentRef: React.RefObject<HTMLElement | null>
  displayTicks: readonly MermaidGanttTimelineTick[]
  dragPreview: MermaidGanttTimelineDragPreview | null
  draggingRowKey: string
  maxMinutes: number
  mediaDurationSeconds?: number
  playheadPercent: number
  selectedRowKey: string
  sourceThumbnails?: readonly TimelineMediaReaderThumbnail[]
  sourceThumbnailWindows?: readonly VideoSequenceTimelineThumbnailWindow[]
  scopes?: readonly VideoSequenceTimelineScope[]
  taskSpans: readonly MermaidGanttTimelineTaskSpan[]
  timelineZoom: number
  disabledLaneIds?: VideoSequenceTimelineProjectionOptions['disabledLaneIds']
  onRulerPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onSelectRowKey: (rowKey: string) => void
  onSelectRowPosition: (rowKey: string, positionMinutes: number) => void
  onTrackPointerStart: (event: React.PointerEvent<HTMLElement>, span: MermaidGanttTimelineTaskSpan, mode: MermaidGanttBarDragMode) => void
}) {
  const projectionOptions = React.useMemo<VideoSequenceTimelineProjectionOptions>(() => ({ disabledLaneIds }), [disabledLaneIds])
  const visibleLanes = React.useMemo(() => resolveVisibleVideoSequenceTimelineLanes(taskSpans, projectionOptions), [projectionOptions, taskSpans])
  const renderableSpans = React.useMemo(() => resolveRenderableVideoSequenceTimelineSpans(taskSpans, projectionOptions), [projectionOptions, taskSpans])
  const visibleLaneIndexById = React.useMemo(() => new Map<VideoSequenceTimelineLaneId, number>(visibleLanes.map((lane, index) => [lane.id, index])), [visibleLanes])
  const formatClipTime = React.useCallback((positionMinutes: number) => formatVideoSequenceTimelineSecondsOffset(
    mediaDurationSeconds > 0 && maxMinutes > 0 ? resolveVideoSequenceTimelineMediaSeconds({ durationSeconds: mediaDurationSeconds, maxMinutes, positionMinutes }) : positionMinutes,
  ), [maxMinutes, mediaDurationSeconds])
  const minHeight = resolveVideoSequenceRulerMinHeight(visibleLanes.length)
  const animationState = React.useMemo(() => buildTimelineAnimationState({
    active: !!draggingRowKey || !!selectedRowKey,
    itemCount: taskSpans.length,
    progress: playheadPercent / 100,
    surface: 'bottom-timeline',
  }), [draggingRowKey, playheadPercent, selectedRowKey, taskSpans.length])
  const { style: animationStyle, ...animationAttributes } = animationState.attributes
  return (
    <section
      className="timeline-video-sequence-editor"
      aria-label="Video sequence editor"
      {...animationAttributes}
      style={{ minHeight, ...(animationStyle || {}) }}
      data-kg-animation-object-opacity={animationState.objectFrame.opacity}
      data-kg-animation-object-scale={animationState.objectFrame.scale}
      data-kg-animation-object-translate-x={animationState.objectFrame.translateX}
      data-kg-animation-easing-curve={animationState.easing.curve}
      data-kg-animation-frame-by-frame={animationState.frameByFrame.frameCount}
      data-kg-animation-frame-rate={animationState.frameByFrame.frameRate}
      data-kg-animation-frame-timing={animationState.frameByFrame.timing}
      data-kg-animation-layer-modifiers={animationState.modifiers.join(' ')}
      data-kg-animation-layer-panel={animationState.layerPanel.dragSort ? `${animationState.layerPanel.contextMenu} ${animationState.layerPanel.inlineRenameKey} ${animationState.layerPanel.grouping}` : undefined}
      data-kg-animation-layer-modes={animationState.layerPanel.layerModes.join(' ')}
      data-kg-animation-layer-properties={animationState.propertyTokens}
      data-kg-animation-loop-modes={animationState.loopModes.join(' ')}
      data-kg-animation-recording-enabled={animationState.recording.enabled ? '1' : undefined}
      data-kg-animation-vector-morph-path={animationState.vectorMorph.pathSample}
    >
      <aside className="timeline-video-sequence-lane-sidebar" aria-label="Video sequence lane labels" style={buildVideoSequenceLaneSidebarStyle(visibleLanes)}>
        {visibleLanes.map(lane => (
          <section key={lane.id} className="timeline-video-sequence-lane-label" data-kg-video-sequence-lane-label={lane.id}>
            {lane.label}
          </section>
        ))}
      </aside>
      <section
        ref={contentRef}
        className="timeline-transport-ruler-content timeline-video-sequence-ruler-content"
        style={{
          width: `${timelineZoom * 100}%`,
          minHeight,
          '--kg-video-sequence-lane-count': visibleLanes.length,
        } as React.CSSProperties}
        data-kg-gantt-timeline-ruler-content="1"
        data-kg-gantt-timeline-zoom={String(timelineZoom)}
        onPointerDown={onRulerPointerDown}
      >
        <svg
          className="timeline-video-sequence-motion-vector"
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="none"
          viewBox="0 0 100 10"
          data-kg-animation-svg-attribute-target="1"
        >
          <path
            d={animationState.vectorMorph.pathSample}
            fill="none"
            pathLength={animationState.svg.pathLength}
            stroke="currentColor"
            strokeDasharray={animationState.svg.dashArray}
            strokeDashoffset={animationState.svg.dashOffset}
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
        <span className="timeline-transport-playhead" style={{ left: `clamp(14px, ${playheadPercent}%, calc(100% - 14px))` }} data-kg-gantt-timeline-playhead="1" aria-hidden="true">
          <span className="timeline-transport-playhead-marker" />
        </span>
        {displayTicks.map(tick => (
          <span key={`${tick.minutes}:${tick.label}`} className="timeline-transport-ruler-tick" style={{ left: `clamp(14px, ${tick.percent}%, calc(100% - 14px))` }} data-kg-gantt-timeline-tick="1">
            <span className="timeline-transport-ruler-tick-line" />
            <span>{tick.label}</span>
          </span>
        ))}
        {renderableSpans.map((span, index) => {
          const verticalMarker = /(^|[:,\s])vert([,\s]|$)/i.test(span.raw)
          const previewSpan = dragPreview?.rowKey === span.rowKey ? dragPreview : null
          const startMinutes = previewSpan?.startMinutes ?? span.startMinutes
          const durationMinutes = previewSpan?.durationMinutes ?? span.durationMinutes
          const leftPercent = maxMinutes > 0 ? (startMinutes / maxMinutes) * 100 : 0
          const lane = resolveVideoSequenceTimelineLane(span)
          const minWidthPercent = lane === 'fbf' ? 0.24 : 2
          const widthPercent = maxMinutes > 0 ? Math.max(minWidthPercent, (durationMinutes / maxMinutes) * 100) : 0
          const laneIndex = visibleLaneIndexById.get(lane) ?? 0
          const selected = selectedRowKey === span.rowKey
          const dragging = draggingRowKey === span.rowKey
          const activeResizeMode = resolveActiveVideoSequenceResizeMode({ dragging, previewSpan, span })
          const showsGeneratedFrameContent = VIDEO_SEQUENCE_GENERATED_FRAME_CONTENT_LANES.has(lane)
          const compactVideoAgentFbf = lane === 'fbf' && isVideoAgentCompactFbfSpan(span)
          const compactVideoAgentMedia = isVideoAgentCompactMediaSpan(span, lane)
          const showsMediaContent = !verticalMarker && (
            VIDEO_SEQUENCE_SOURCE_CONTENT_LANES.has(lane) ||
            VIDEO_SEQUENCE_OPERATION_CONTENT_LANES.has(lane) ||
            showsGeneratedFrameContent
          )
          const showMediaCues = showsMediaContent && lane !== 'audio' && !compactVideoAgentMedia
          const allowTimelineFallbackThumbnails = VIDEO_SEQUENCE_SOURCE_CONTENT_LANES.has(lane)
          const thumbnailWindow = showsMediaContent
            ? resolveVideoSequenceSpanThumbnailWindow({
                allowTimelineFallback: allowTimelineFallbackThumbnails || showsGeneratedFrameContent,
                span,
                windows: sourceThumbnailWindows,
              })
            : null
          const nativeFrameSamples = showsMediaContent && !compactVideoAgentMedia
            ? resolveVideoSequenceClipThumbnails({ sourceThumbnails, sourceWindow: thumbnailWindow, span })
            : []
          const showCompactVideoAgentFbfThumbnails = compactVideoAgentFbf && !nativeFrameSamples.length
          const generatedFrameSamples = showsGeneratedFrameContent && !nativeFrameSamples.length && (!compactVideoAgentMedia || showCompactVideoAgentFbfThumbnails)
            ? buildVideoSequenceGeneratedFrameThumbnails({ sourceWindow: thumbnailWindow, span })
            : []
          const thumbnailSamples = compactVideoAgentMedia && !showCompactVideoAgentFbfThumbnails ? [] : (nativeFrameSamples.length ? nativeFrameSamples : generatedFrameSamples)
          const cueSamples = showMediaCues
            ? buildVideoSequenceTimelineCueSamples({
                sampleCount: Math.max(6, Math.round(durationMinutes * 2)),
                seedText: `${span.label} ${span.raw}`,
              })
            : []
          const frameSamples = showMediaCues && !thumbnailSamples.length
            ? buildVideoSequenceTimelineFrameSamples({
                sampleCount: Math.max(4, Math.round(durationMinutes * 1.6)),
                seedText: `${span.label} ${span.raw}`,
              })
            : []
          const waveformSamples = lane === 'audio' && !verticalMarker && !compactVideoAgentMedia
            ? buildVideoSequenceTimelineWaveformSamples({
                sampleCount: Math.max(8, Math.round(durationMinutes * 3)),
                seedText: `${span.label} ${span.raw}`,
              })
            : []
          const keyframeSamples = lane === 'keyframe' && !verticalMarker ? animationState.keyframes : []
          const morphSamples = lane === 'morph' && !verticalMarker
            ? buildVideoSequenceTimelineCueSamples({
                sampleCount: Math.max(5, Math.round(durationMinutes * 1.4)),
                seedText: `${span.label} ${span.raw} morph`,
              })
            : []
          const textSamples = lane === 'text' && !verticalMarker
            ? buildVideoSequenceTimelineFrameSamples({
                sampleCount: Math.max(4, Math.round(durationMinutes * 1.2)),
                seedText: `${span.label} ${span.raw} text`,
              })
            : []
          const nestedSamples = (lane === 'nested' || lane === 'fbf' || lane === 'keyframe') && !verticalMarker && !compactVideoAgentMedia
            && !thumbnailSamples.length
            ? buildVideoSequenceTimelineFrameSamples({ sampleCount: Math.max(4, Math.round(durationMinutes * 1.1)), seedText: `${span.label} ${span.raw} nested` })
            : []
          const clipStartLabel = formatClipTime(startMinutes)
          const clipEndLabel = formatClipTime(startMinutes + durationMinutes)
          const denseFbfClip = lane === 'fbf' && !compactVideoAgentFbf && !verticalMarker && (durationMinutes <= VIDEO_SEQUENCE_DENSE_FBF_MAX_DURATION_MINUTES || widthPercent < 3.5)
          return (
            <article
              key={`span:${span.rowKey}`}
              className={`timeline-transport-track-clip timeline-transport-track-clip--lane-${lane} ${verticalMarker ? 'timeline-transport-track-clip--milestone' : ''} ${selected ? 'timeline-transport-track-clip--selected' : ''} ${dragging ? 'timeline-transport-track-clip--dragging' : ''}`}
              style={{
                left: verticalMarker ? `clamp(24px, ${leftPercent}%, calc(100% - 24px))` : `${leftPercent}%`,
                top: verticalMarker ? '0px' : `${VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX + laneIndex * VIDEO_SEQUENCE_LANE_HEIGHT_PX + (compactVideoAgentMedia ? 0 : (index % 2) * 2)}px`,
                width: verticalMarker ? '14px' : `${Math.min(100 - leftPercent, widthPercent)}%`,
              }}
              aria-label={`${span.label} timeline clip`}
              data-kg-gantt-timeline-track-span="1"
              data-kg-gantt-timeline-track-dragging={dragging ? '1' : undefined}
              data-kg-gantt-timeline-track-row-key={span.rowKey}
              data-kg-video-sequence-active-resize-mode={activeResizeMode || undefined}
              data-kg-video-agent-compact-fbf={compactVideoAgentFbf ? '1' : undefined}
              data-kg-video-agent-compact-media={compactVideoAgentMedia ? '1' : undefined}
              data-kg-video-sequence-dense-fbf={denseFbfClip ? '1' : undefined}
              data-kg-video-sequence-lane={lane}
              data-kg-video-sequence-trim-start={clipStartLabel}
              data-kg-video-sequence-trim-end={clipEndLabel}
              data-kg-video-sequence-motion-easing={animationState.easing.mode}
              data-kg-video-sequence-frame-rate={animationState.frameByFrame.frameRate}
              data-kg-video-sequence-frame-timing={animationState.frameByFrame.timing}
              data-kg-video-sequence-layer-mode={lane === 'detached' ? 'detached-continuous' : lane === 'fbf' ? 'animated-frame' : undefined}
              data-kg-video-sequence-motion-modifiers={animationState.modifiers.join(' ')}
              data-kg-video-sequence-motion-properties={animationState.propertyTokens}
              data-kg-video-sequence-motion-loop-modes={animationState.loopModes.join(' ')}
              data-kg-video-sequence-nested-animation={animationState.nested.modes.join(' ')}
              data-kg-video-sequence-nested-composite={animationState.nested.compositeOrder}
              data-kg-video-sequence-nested-fps={`timeline:${animationState.nested.timelineFrameRate} fbf:${animationState.nested.fbfFrameRate}`}
              data-kg-video-sequence-nested-render-passes={animationState.nested.renderPasses.join(' ')}
              data-kg-video-sequence-recording-mode={animationState.recording.enabled ? 'playhead-auto-key' : undefined}
              data-kg-video-sequence-motion-work-area={`${animationState.workArea.start}-${animationState.workArea.end}`}
              title={span.label}
            >
              {compactVideoAgentFbf
                ? <VideoSequenceCompactFbfRail onSelectRowPosition={onSelectRowPosition} span={span} thumbnailWindow={thumbnailWindow} thumbnails={thumbnailSamples} />
                : <VideoSequenceClipThumbnailStrip generated={generatedFrameSamples.length > 0} onSelectRowPosition={onSelectRowPosition} span={span} thumbnailWindow={thumbnailWindow} thumbnails={thumbnailSamples} />}
              {frameSamples.length ? (
                <section className="timeline-video-sequence-clip-frame-strip" aria-hidden="true" data-kg-video-sequence-clip-frames="1">
                  {frameSamples.map((sample, frameIndex) => (
                    <span
                      key={`frame:${span.rowKey}:${frameIndex}`}
                      className="timeline-video-sequence-clip-frame"
                      style={{
                        '--kg-video-sequence-frame-focus': `${(sample + frameIndex * 13) % 100}%`,
                        opacity: Math.max(0.52, sample / 100),
                      } as React.CSSProperties}
                    />
                  ))}
                </section>
              ) : null}
              {cueSamples.length ? (
                <section className="timeline-video-sequence-clip-cues" aria-hidden="true" data-kg-video-sequence-clip-cues="1">
                  {cueSamples.map((sample, cueIndex) => (
                    <span
                      key={`cue:${span.rowKey}:${cueIndex}`}
                      className="timeline-video-sequence-clip-cue"
                      style={{
                        height: `${Math.max(5, sample / 9)}px`,
                        opacity: Math.max(0.24, sample / 100),
                      }}
                    />
                  ))}
                </section>
              ) : null}
              {waveformSamples.length ? (
                <section className="timeline-video-sequence-audio-waveform" aria-hidden="true" data-kg-video-sequence-audio-waveform="1">
                  {waveformSamples.map((sample, sampleIndex) => (
                    <span
                      key={`waveform:${span.rowKey}:${sampleIndex}`}
                      className="timeline-video-sequence-audio-waveform-bar"
                      style={{ height: `${Math.max(4, sample / 4)}px` }}
                    />
                  ))}
                </section>
              ) : null}
              {keyframeSamples.length ? (
                <section className="timeline-video-sequence-keyframe-strip" aria-label={`${span.label} keyframes`} data-kg-video-sequence-keyframes="1">
                  {keyframeSamples.map(keyframe => (
                    <span
                      key={`keyframe:${span.rowKey}:${keyframe.offset}`}
                      className="timeline-video-sequence-keyframe"
                      style={{ left: `${keyframe.offset * 100}%` }}
                      title={`${keyframe.easing} ${Math.round(keyframe.offset * 100)}%`}
                      data-kg-video-sequence-keyframe-easing={keyframe.easing}
                      data-kg-video-sequence-keyframe-offset={keyframe.offset}
                      data-kg-video-sequence-keyframe-value={keyframe.value}
                    />
                  ))}
                </section>
              ) : null}
              {morphSamples.length ? (
                <section className="timeline-video-sequence-morph-strip" aria-label={`${span.label} vector morph samples`} data-kg-video-sequence-vector-morph="1" data-kg-video-sequence-vector-morph-boolean-ops={animationState.vectorMorph.booleanOperations.join(' ')} data-kg-video-sequence-vector-morph-path={animationState.vectorMorph.interpolatedPath} data-kg-video-sequence-vector-morph-shapes={animationState.vectorMorph.shapeFamilies.join(' ')}>
                  {morphSamples.map((sample, sampleIndex) => (
                    <span
                      key={`morph:${span.rowKey}:${sampleIndex}`}
                      className="timeline-video-sequence-morph-node"
                      style={{ '--kg-video-sequence-morph-node': `${sample}%` } as React.CSSProperties}
                    />
                  ))}
                </section>
              ) : null}
              {textSamples.length ? (
                <section className="timeline-video-sequence-text-strip" aria-label={`${span.label} text animation ranges`} data-kg-video-sequence-text-animation="1" data-kg-video-sequence-text-keyframes={animationState.text.keyframes.length} data-kg-video-sequence-text-properties={animationState.text.properties.join(' ')} data-kg-video-sequence-text-scopes={animationState.text.scopes.join(' ')}>
                  {textSamples.map((sample, sampleIndex) => (
                    <span
                      key={`text:${span.rowKey}:${sampleIndex}`}
                      className="timeline-video-sequence-text-range"
                      style={{ '--kg-video-sequence-text-range': `${sample}%` } as React.CSSProperties}
                    />
                  ))}
                </section>
              ) : null}
              {nestedSamples.length ? (
                <section className="timeline-video-sequence-nested-strip" aria-label={`${span.label} nested animation composite`} data-kg-video-sequence-nested-composite-strip="1">
                  {nestedSamples.map((sample, sampleIndex) => (
                    <span key={`nested:${span.rowKey}:${sampleIndex}`} className="timeline-video-sequence-nested-frame" style={{ '--kg-video-sequence-nested-frame': `${sample}%`, '--kg-video-sequence-nested-phase': `${(sampleIndex % 3) + 1}` } as React.CSSProperties} />
                  ))}
                </section>
              ) : null}
              <button type="button" className="timeline-transport-track-handle timeline-transport-track-handle--start" aria-label={`Resize ${span.label} start`} data-kg-gantt-timeline-track-drag-mode="resize-start" title={`Trim ${span.label} start`} onPointerDown={event => onTrackPointerStart(event, span, 'resize-start')}>
                <span className="timeline-transport-track-handle-grip" aria-hidden="true" />
                {activeResizeMode === 'resize-start' ? <span className="timeline-video-sequence-trim-guide">{VIDEO_SEQUENCE_RESIZE_MODE_LABELS[activeResizeMode]}</span> : null}
              </button>
              <button type="button" className="timeline-transport-track-clip-move" aria-label={`Move ${span.label}`} data-kg-gantt-timeline-track-drag-mode="move" onClick={() => onSelectRowKey(span.rowKey)} onPointerDown={event => onTrackPointerStart(event, span, 'move')}>
                <span className="timeline-transport-track-clip-label">{span.label}</span>
                {!verticalMarker && !compactVideoAgentMedia ? (
                  <time className="timeline-video-sequence-clip-timecode" dateTime={`PT${Math.max(0, Math.round(durationMinutes))}S`}>
                    {clipStartLabel}-{clipEndLabel}
                  </time>
                ) : null}
              </button>
              <button type="button" className="timeline-transport-track-handle timeline-transport-track-handle--end" aria-label={`Resize ${span.label} end`} data-kg-gantt-timeline-track-drag-mode="resize-end" title={`Trim ${span.label} end`} onPointerDown={event => onTrackPointerStart(event, span, 'resize-end')}>
                <span className="timeline-transport-track-handle-grip" aria-hidden="true" />
                {activeResizeMode === 'resize-end' ? <span className="timeline-video-sequence-trim-guide">{VIDEO_SEQUENCE_RESIZE_MODE_LABELS[activeResizeMode]}</span> : null}
              </button>
            </article>
          )
        })}
        {scopes.length ? (
          <section className="timeline-video-sequence-ruler-scope-strip" aria-label="Video sequence scopes" data-kg-video-sequence-ruler-scopes="1">
            {scopes.map(scope => (
              <section
                key={scope.id}
                className="timeline-video-sequence-ruler-scope"
                aria-label={`${scope.label} display`}
                title={scope.label}
                data-kg-video-sequence-scope={scope.id}
                data-kg-video-sequence-scope-active={scope.active ? '1' : undefined}
                data-kg-video-sequence-scope-active-family={scope.activeFamilyId || undefined}
                data-kg-video-sequence-scope-activity-mode={scope.activityMode}
                data-kg-video-sequence-scope-selection-active={scope.selectionActive ? '1' : undefined}
              >
                <span className="sr-only">{scope.label}</span>
                <section className="timeline-video-sequence-ruler-scope-bars" aria-label={`${scope.label} display`}>
                  {scope.samples.map((sample, sampleIndex) => (
                    <span
                      key={`${scope.id}:${sampleIndex}`}
                      className="timeline-video-sequence-ruler-scope-bar"
                      style={{ '--kg-video-sequence-scope-bar': `${sample}%` } as React.CSSProperties}
                      aria-hidden="true"
                    />
                  ))}
                </section>
              </section>
            ))}
          </section>
        ) : null}
      </section>
    </section>
  )
}
