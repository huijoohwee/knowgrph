import React from 'react'
import { Blend, Film, Filter, Gauge, KeyRound, Layers, Palette, Scissors, SlidersHorizontal, Sparkles, SplitSquareVertical, type LucideIcon } from 'lucide-react'
import type { TimelineMediaReaderThumbnail } from './timelineMediaReader'
import { buildTimelineAnimationState } from './timelineAnimationEngine'
import {
  MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR,
  MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR,
} from '@/lib/media/mediaFormatPreference'
import {
  VIDEO_SEQUENCE_TIMELINE_LANES,
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  buildVideoSequenceTimelineCueSamples,
  buildVideoSequenceTimelineFrameSamples,
  buildVideoSequenceTimelineWaveformSamples,
  formatVideoSequenceTimelineSecondsOffset,
  resolveVideoSequenceTimelineLane,
  resolveVisibleVideoSequenceTimelineLanes,
  type VideoSequenceTimelineLane,
  type VideoSequenceTimelineLaneId,
  type VideoSequenceTimelineScope,
  type VideoSequenceTimelineToolId,
} from './videoSequenceTimeline'
import type {
  MermaidGanttBarDragMode,
  MermaidGanttTimelineDragPreview,
  MermaidGanttTimelineTaskSpan,
  MermaidGanttTimelineTick,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import './VideoSequenceTimelineRuler.css'

export const VIDEO_SEQUENCE_LANE_HEIGHT_PX = 42
export const VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX = 24
export const VIDEO_SEQUENCE_RULER_SCOPE_STRIP_PX = 24
export const VIDEO_SEQUENCE_RULER_FOOTER_PX = 28 + VIDEO_SEQUENCE_RULER_SCOPE_STRIP_PX
export type VideoSequenceTimelineThumbnailWindow = {
  sourceEndSeconds: number
  sourceStartSeconds: number
  timelineEndMinutes: number
  timelineStartMinutes: number
}

const VIDEO_SEQUENCE_RESIZE_MODE_LABELS: Record<Extract<MermaidGanttBarDragMode, 'resize-start' | 'resize-end'>, string> = {
  'resize-end': 'end',
  'resize-start': 'start',
}
const VIDEO_SEQUENCE_THUMBNAIL_WINDOW_EPSILON = 0.001

function resolveVideoSequenceThumbnailWindow(args: {
  span: MermaidGanttTimelineTaskSpan
  windows: readonly VideoSequenceTimelineThumbnailWindow[]
}): VideoSequenceTimelineThumbnailWindow | null {
  return args.windows.find(window =>
    Math.abs(window.timelineStartMinutes - args.span.startMinutes) <= VIDEO_SEQUENCE_THUMBNAIL_WINDOW_EPSILON &&
    Math.abs(window.timelineEndMinutes - args.span.endMinutes) <= VIDEO_SEQUENCE_THUMBNAIL_WINDOW_EPSILON,
  ) || null
}

function resolveVideoSequenceClipThumbnails(args: {
  sourceThumbnails: readonly TimelineMediaReaderThumbnail[]
  span: MermaidGanttTimelineTaskSpan
  windows: readonly VideoSequenceTimelineThumbnailWindow[]
}): readonly TimelineMediaReaderThumbnail[] {
  if (!args.sourceThumbnails.length) return []
  if (!args.windows.length) return args.sourceThumbnails
  const window = resolveVideoSequenceThumbnailWindow({ span: args.span, windows: args.windows })
  if (!window) return []
  const sourceStart = Math.min(window.sourceStartSeconds, window.sourceEndSeconds)
  const sourceEnd = Math.max(window.sourceStartSeconds, window.sourceEndSeconds)
  const withinWindow = args.sourceThumbnails.filter(thumbnail =>
    thumbnail.timestampSeconds >= sourceStart - 0.05 &&
    thumbnail.timestampSeconds <= sourceEnd + 0.05,
  )
  if (withinWindow.length) return withinWindow
  const midpointSeconds = sourceStart + (sourceEnd - sourceStart) / 2
  return args.sourceThumbnails
    .slice()
    .sort((left, right) => Math.abs(left.timestampSeconds - midpointSeconds) - Math.abs(right.timestampSeconds - midpointSeconds))
    .slice(0, Math.min(2, args.sourceThumbnails.length))
    .sort((left, right) => left.timestampSeconds - right.timestampSeconds)
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
  filter: Filter,
  grade: Palette,
  keyframe: KeyRound,
  mask: Layers,
  speed: Gauge,
  splice: SplitSquareVertical,
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
  const minHeight = resolveVideoSequenceRulerMinHeight()
  const animationState = React.useMemo(() => buildTimelineAnimationState({
    active: false,
    itemCount: VIDEO_SEQUENCE_TIMELINE_LANES.length,
    progress: 0,
    surface: 'bottom-timeline',
  }), [])
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
        <aside className="timeline-video-sequence-lane-sidebar" aria-label="Video sequence lane labels" style={buildVideoSequenceLaneSidebarStyle()}>
          {VIDEO_SEQUENCE_TIMELINE_LANES.map(lane => (
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
  playheadPercent,
  selectedRowKey,
  sourceThumbnails = [],
  sourceThumbnailWindows = [],
  scopes = [],
  taskSpans,
  timelineZoom,
  onRulerPointerDown,
  onSelectRowKey,
  onTrackPointerStart,
}: {
  contentRef: React.RefObject<HTMLElement | null>
  displayTicks: readonly MermaidGanttTimelineTick[]
  dragPreview: MermaidGanttTimelineDragPreview | null
  draggingRowKey: string
  maxMinutes: number
  playheadPercent: number
  selectedRowKey: string
  sourceThumbnails?: readonly TimelineMediaReaderThumbnail[]
  sourceThumbnailWindows?: readonly VideoSequenceTimelineThumbnailWindow[]
  scopes?: readonly VideoSequenceTimelineScope[]
  taskSpans: readonly MermaidGanttTimelineTaskSpan[]
  timelineZoom: number
  onRulerPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onSelectRowKey: (rowKey: string) => void
  onTrackPointerStart: (event: React.PointerEvent<HTMLElement>, span: MermaidGanttTimelineTaskSpan, mode: MermaidGanttBarDragMode) => void
}) {
  const visibleLanes = React.useMemo(() => resolveVisibleVideoSequenceTimelineLanes(taskSpans), [taskSpans])
  const visibleLaneIndexById = React.useMemo(() => new Map<VideoSequenceTimelineLaneId, number>(visibleLanes.map((lane, index) => [lane.id, index])), [visibleLanes])
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
            d="M0 5 C18 1 34 9 50 5 S82 1 100 5"
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
        {taskSpans.map((span, index) => {
          const verticalMarker = /(^|[:,\s])vert([,\s]|$)/i.test(span.raw)
          const previewSpan = dragPreview?.rowKey === span.rowKey ? dragPreview : null
          const startMinutes = previewSpan?.startMinutes ?? span.startMinutes
          const durationMinutes = previewSpan?.durationMinutes ?? span.durationMinutes
          const leftPercent = maxMinutes > 0 ? (startMinutes / maxMinutes) * 100 : 0
          const widthPercent = maxMinutes > 0 ? Math.max(2, (durationMinutes / maxMinutes) * 100) : 0
          const lane = resolveVideoSequenceTimelineLane(span)
          const laneIndex = visibleLaneIndexById.get(lane) ?? 0
          const selected = selectedRowKey === span.rowKey
          const dragging = draggingRowKey === span.rowKey
          const activeResizeMode = resolveActiveVideoSequenceResizeMode({ dragging, previewSpan, span })
          const showMediaCues = !verticalMarker && (lane === 'video' || lane === 'image' || lane === 'scene')
          const nativeFrameSamples = !verticalMarker && lane === 'video'
            ? resolveVideoSequenceClipThumbnails({ sourceThumbnails, span, windows: sourceThumbnailWindows })
            : []
          const cueSamples = showMediaCues
            ? buildVideoSequenceTimelineCueSamples({
                sampleCount: Math.max(6, Math.round(durationMinutes * 2)),
                seedText: `${span.label} ${span.raw}`,
              })
            : []
          const frameSamples = showMediaCues && !nativeFrameSamples.length
            ? buildVideoSequenceTimelineFrameSamples({
                sampleCount: Math.max(4, Math.round(durationMinutes * 1.6)),
                seedText: `${span.label} ${span.raw}`,
              })
            : []
          const waveformSamples = lane === 'audio' && !verticalMarker
            ? buildVideoSequenceTimelineWaveformSamples({
                sampleCount: Math.max(8, Math.round(durationMinutes * 3)),
                seedText: `${span.label} ${span.raw}`,
              })
            : []
          const clipStartLabel = formatVideoSequenceTimelineSecondsOffset(startMinutes)
          const clipEndLabel = formatVideoSequenceTimelineSecondsOffset(startMinutes + durationMinutes)
          return (
            <article
              key={`span:${span.rowKey}`}
              className={`timeline-transport-track-clip timeline-transport-track-clip--lane-${lane} ${verticalMarker ? 'timeline-transport-track-clip--milestone' : ''} ${selected ? 'timeline-transport-track-clip--selected' : ''} ${dragging ? 'timeline-transport-track-clip--dragging' : ''}`}
              style={{
                left: verticalMarker ? `clamp(24px, ${leftPercent}%, calc(100% - 24px))` : `${leftPercent}%`,
                top: verticalMarker ? '0px' : `${VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX + laneIndex * VIDEO_SEQUENCE_LANE_HEIGHT_PX + (index % 2) * 2}px`,
                width: verticalMarker ? '14px' : `${Math.min(100 - leftPercent, widthPercent)}%`,
              }}
              aria-label={`${span.label} timeline clip`}
              data-kg-gantt-timeline-track-span="1"
              data-kg-gantt-timeline-track-dragging={dragging ? '1' : undefined}
              data-kg-gantt-timeline-track-row-key={span.rowKey}
              data-kg-video-sequence-active-resize-mode={activeResizeMode || undefined}
              data-kg-video-sequence-lane={lane}
              data-kg-video-sequence-trim-start={clipStartLabel}
              data-kg-video-sequence-trim-end={clipEndLabel}
              title={span.label}
            >
              {nativeFrameSamples.length ? (
                <section
                  className="timeline-video-sequence-clip-thumbnail-strip"
                  aria-label={`${span.label} generated thumbnails`}
                  data-kg-video-sequence-clip-thumbnail-strip="1"
                  data-kg-video-sequence-clip-thumbnail-count={nativeFrameSamples.length}
                  data-kg-video-sequence-clip-thumbnail-image-format-preference={MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR}
                  data-kg-video-sequence-clip-thumbnail-video-format-preference={MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR}
                  data-kg-video-sequence-clip-thumbnail-source-start={nativeFrameSamples.length ? nativeFrameSamples[0]?.timestampSeconds : undefined}
                  data-kg-video-sequence-clip-thumbnail-source-end={nativeFrameSamples.length ? nativeFrameSamples[nativeFrameSamples.length - 1]?.timestampSeconds : undefined}
                >
                  {nativeFrameSamples.map(thumbnail => (
                    <button
                      type="button"
                      key={`thumbnail:${span.rowKey}:${thumbnail.timestampSeconds}:${thumbnail.width}x${thumbnail.height}`}
                      className="timeline-video-sequence-clip-thumbnail"
                      aria-label={`${span.label} thumbnail ${formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)} ${thumbnail.format}/${thumbnail.rasterFormat}`}
                      data-kg-video-sequence-clip-thumbnail="1"
                      data-kg-video-sequence-clip-thumbnail-format={thumbnail.format}
                      data-kg-video-sequence-clip-thumbnail-microsecond-time={Math.max(0, Math.round(thumbnail.timestampSeconds * 1_000_000))}
                      data-kg-video-sequence-clip-thumbnail-raster-format={thumbnail.rasterFormat}
                      data-kg-video-sequence-clip-thumbnail-time={thumbnail.timestampSeconds}
                      onClick={event => {
                        event.stopPropagation()
                        onSelectRowKey(span.rowKey)
                      }}
                      onPointerDown={event => {
                        event.stopPropagation()
                      }}
                    >
                      <img
                        alt=""
                        decoding="async"
                        draggable={false}
                        height={thumbnail.height}
                        loading="lazy"
                        src={thumbnail.dataUrl}
                        width={thumbnail.width}
                      />
                      <span className="timeline-video-sequence-clip-thumbnail-caption">
                        <time dateTime={`PT${thumbnail.timestampSeconds.toFixed(3)}S`}>
                          {formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)}
                        </time>
                        <span>{thumbnail.format}/{thumbnail.rasterFormat}</span>
                      </span>
                      <span
                        className="timeline-video-sequence-clip-thumbnail-preview"
                        aria-hidden="true"
                        data-kg-video-sequence-clip-thumbnail-preview="1"
                      >
                        <img
                          alt=""
                          decoding="async"
                          draggable={false}
                          height={thumbnail.height}
                          loading="lazy"
                          src={thumbnail.dataUrl}
                          width={thumbnail.width}
                        />
                        <span className="timeline-video-sequence-clip-thumbnail-preview-caption">
                          {formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)} {thumbnail.format}/{thumbnail.rasterFormat}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              ) : null}
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
              <button type="button" className="timeline-transport-track-handle timeline-transport-track-handle--start" aria-label={`Resize ${span.label} start`} data-kg-gantt-timeline-track-drag-mode="resize-start" title={`Trim ${span.label} start`} onPointerDown={event => onTrackPointerStart(event, span, 'resize-start')}>
                <span className="timeline-transport-track-handle-grip" aria-hidden="true" />
                {activeResizeMode === 'resize-start' ? <span className="timeline-video-sequence-trim-guide">{VIDEO_SEQUENCE_RESIZE_MODE_LABELS[activeResizeMode]}</span> : null}
              </button>
              <button type="button" className="timeline-transport-track-clip-move" aria-label={`Move ${span.label}`} data-kg-gantt-timeline-track-drag-mode="move" onClick={() => onSelectRowKey(span.rowKey)} onPointerDown={event => onTrackPointerStart(event, span, 'move')}>
                <span className="timeline-transport-track-clip-label">{span.label}</span>
                {!verticalMarker ? (
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
