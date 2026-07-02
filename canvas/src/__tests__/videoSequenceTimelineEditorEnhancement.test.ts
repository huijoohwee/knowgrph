import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildVideoSequenceTimelineZoomTicks, resolveVideoSequenceTimelineAppendSpacePercent, resolveVideoSequenceTimelineScaleDurationSeconds, resolveVideoSequenceTimelineScaleMaxMinutes, resolveVideoSequenceTimelineZoomTickStepSeconds } from '@/components/timeline/videoSequenceTimelineZoom'
import { resolveTimelineTransportGestureZoomStepCount, resolveTimelineTransportNextZoomIndex, resolveTimelineTransportZoom } from '@/components/timeline/timelineTransport'

const root = process.cwd()

function readSource(...parts: string[]): string {
  return readFileSync(resolve(root, 'src', ...parts), 'utf8')
}

export function testVideoSequenceTimelineEditorEnhancementContracts() {
  const rulerText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const rulerTicksText = readSource('components', 'timeline', 'VideoSequenceTimelineRulerTicks.tsx')
  const rulerTimeAxisCssText = readSource('components', 'timeline', 'VideoSequenceTimelineRulerTimeAxis.css')
  const rulerZoomText = readSource('components', 'timeline', 'videoSequenceTimelineZoom.ts')
  const clipMetaText = readSource('components', 'timeline', 'VideoSequenceTimelineClipMeta.tsx')
  const clipMetaCssText = readSource('components', 'timeline', 'VideoSequenceTimelineClipMeta.css')
  const denseFbfCssText = readSource('components', 'timeline', 'VideoSequenceTimelineDenseFbf.css')
  const mermaidTransportCssText = readSource('components', 'timeline', 'TimelineTransportControlsMermaidGantt.css')
  const timelineTransportText = readSource('components', 'timeline', 'timelineTransport.ts')
  const videoSequenceToolButtonText = readSource('components', 'timeline', 'VideoSequenceTimelineToolButton.tsx')
  const transportText = readSource('components', 'timeline', 'TimelineTransportControls.tsx')
  const transportHeaderToolsText = readSource('features', 'gitgraph', 'GanttTimelineTransportHeaderTools.tsx')
  const transportChromeModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportChromeModel.ts')
  const transportInteractionModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportInteractionModel.ts')
  const transportRulerModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportRulerModel.ts')
  const transportSurfaceModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportSurfaceModel.ts')
  const transportViewText = readSource('features', 'gitgraph', 'useGanttTimelineTransportView.ts')
  const contextControlsText = readSource('features', 'gitgraph', 'GanttTimelineTransportContextControls.tsx')
  const contextCssText = readSource('features', 'gitgraph', 'GanttTimelineTransportClipContext.css')
  const shellText = readSource('features', 'gitgraph', 'GanttTimelineTransportShell.tsx')

  for (const token of [
    'data-kg-video-sequence-active-track',
    'data-kg-video-sequence-source-window',
    'VideoSequenceTimelineClipMeta',
    'VideoSequenceTimelineRulerTicks',
    'buildVideoSequenceTimelineZoomTicks({ displayTicks, maxMinutes: timelineScaleMaxMinutes, mediaDurationSeconds, timelineZoom })',
    'resolveVideoSequenceTimelineScaleMaxMinutes({ maxMinutes, mediaDurationSeconds })',
    'resolveVideoSequenceTimelineAppendSpacePercent(timelineZoom)',
    'timeline-video-sequence-ruler-scroll-content',
    'timeline-video-sequence-ruler-append-space',
    'data-kg-video-sequence-append-space="1"',
    'resolveVideoSequenceSourceWindowLabel(thumbnailWindow)',
  ]) {
    if (!rulerText.includes(token)) throw new Error(`expected enhanced ruler token: ${token}`)
  }
  for (const token of [
    'formatVideoSequenceTimeAxisLabel',
    "padStart(2, '0')",
    '<time className="timeline-transport-ruler-tick-label"',
    'dateTime={resolveVideoSequenceTickDateTime(tick)}',
    'aria-hidden="true"',
  ]) {
    if (!rulerTicksText.includes(token)) throw new Error(`expected semantic time-axis tick token: ${token}`)
  }
  for (const token of [
    '.timeline-transport-ruler--video-sequence .timeline-transport-ruler-tick',
    '.timeline-transport-ruler--video-sequence .timeline-video-sequence-ruler-scroll',
    'overscroll-behavior-x: contain',
    'contain: layout paint',
    'height: 24px',
    'justify-content: flex-start',
    'font-variant-numeric: tabular-nums',
    '.timeline-transport-ruler--video-sequence .timeline-transport-ruler-tick-line',
    'height: 6px',
    '.timeline-transport-ruler--video-sequence .timeline-transport-ruler-tick-label',
    '.timeline-transport-ruler--video-sequence .timeline-video-sequence-ruler-scroll-content',
    '.timeline-transport-ruler--video-sequence .timeline-video-sequence-ruler-append-space',
    'border-top: 1px dashed',
  ]) {
    if (!rulerTimeAxisCssText.includes(token)) throw new Error(`expected lean time-axis style: ${token}`)
  }
  for (const token of [
    'VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_TARGET_PER_ZOOM',
    'VIDEO_SEQUENCE_TIMELINE_ZOOM_TICK_STEPS_SECONDS',
    'resolveVideoSequenceTimelineZoomTickStepSeconds',
    'buildVideoSequenceTimelineZoomTicks',
    'formatVideoSequenceTimelineSecondsOffset(seconds)',
    'resolveVideoSequenceTimelineScaleDurationSeconds',
    'resolveVideoSequenceTimelineScaleMaxMinutes',
    'resolveVideoSequenceTimelineAppendSpacePercent',
    'VIDEO_SEQUENCE_TIMELINE_APPEND_SPACE_MAX_PERCENT',
  ]) {
    if (!rulerZoomText.includes(token)) throw new Error(`expected shared zoom-axis helper token: ${token}`)
  }
  if (resolveVideoSequenceTimelineZoomTickStepSeconds({ durationSeconds: resolveVideoSequenceTimelineScaleDurationSeconds(52), timelineZoom: 4 }) !== 2) {
    throw new Error('expected max zoom to expose two-second timeline ticks for sub-minute media')
  }
  const scaleMaxMinutes = resolveVideoSequenceTimelineScaleMaxMinutes({ maxMinutes: 52, mediaDurationSeconds: 52 })
  const zoomTicks = buildVideoSequenceTimelineZoomTicks({ displayTicks: [], maxMinutes: scaleMaxMinutes, mediaDurationSeconds: 52, timelineZoom: 4 })
  if (Math.abs(scaleMaxMinutes - 60) > 0.0001 || zoomTicks[1]?.label !== '0:02' || Math.abs((zoomTicks[1]?.percent || 0) - (2 / 60) * 100) > 0.0001 || zoomTicks[zoomTicks.length - 1]?.label !== '1:00') {
    throw new Error(`expected zoom ticks to use rounded 60-second scale, got ${JSON.stringify({ scaleMaxMinutes, ticks: zoomTicks.slice(0, 3), last: zoomTicks.at(-1) })}`)
  }
  if (resolveVideoSequenceTimelineAppendSpacePercent(1) !== 0 || resolveVideoSequenceTimelineAppendSpacePercent(4) <= 0) {
    throw new Error('expected right-side append workspace only when the timeline is zoomed in')
  }

  for (const token of [
    'timeline-video-sequence-clip-meta',
    'data-kg-video-sequence-clip-source-window',
    'durationLabel: string',
    'resolveVideoSequenceSourceWindowLabel',
  ]) {
    if (!clipMetaText.includes(token)) throw new Error(`expected clip metadata token: ${token}`)
  }

  for (const token of [
    '.timeline-video-sequence-clip-meta',
    'flex-wrap: wrap',
    'text-overflow: ellipsis',
  ]) {
    if (!clipMetaCssText.includes(token)) throw new Error(`expected clip metadata style: ${token}`)
  }

  for (const token of [
    '.timeline-transport-track-clip--lane-video[data-kg-video-agent-compact-media="1"]',
    'height: var(--kg-control-height)',
    'translate: 0 calc((38px - var(--kg-control-height)) / 2)',
    'border-color: var(--kg-canvas-accent',
    'inset: 2px 6px',
    'min-width: 15px',
    'filter: saturate(1.04) contrast(1.02)',
    'background: linear-gradient(90deg, rgb(2 6 23 / 0.64), transparent 28%, transparent)',
  ]) {
    if (!denseFbfCssText.includes(token)) throw new Error(`expected edit rail style: ${token}`)
  }
  if (denseFbfCssText.includes('border-color: rgb(0 153 255')) {
    throw new Error('expected compact timeline chrome to use design token canvas accent')
  }
  if (denseFbfCssText.includes('height: var(--kg-control-height,')) {
    throw new Error('expected compact timeline bar height to directly reuse the toolbar control-height token')
  }

  if (
    !denseFbfCssText.includes('[data-kg-video-sequence-dense-fbf="1"] .timeline-video-sequence-clip-meta') ||
    !denseFbfCssText.includes('[data-kg-video-agent-compact-media="1"] .timeline-video-sequence-clip-meta')
  ) {
    throw new Error('expected dense and compact media lanes to suppress clip metadata')
  }

  for (const token of [
    'timeline-transport-clip-context',
    'data-kg-video-sequence-clip-context',
    'selectedSpan ? args.model.clipEdit.detailsLabel',
  ]) {
    if (!contextControlsText.includes(token)) throw new Error(`expected clip context token: ${token}`)
  }

  if (contextControlsText.includes('if (!args.model.exportSessions.items.length) return null')) {
    throw new Error('expected selected-clip context to render without export sessions')
  }
  if (!shellText.includes('const contextControls = <GanttTimelineTransportContextControls')) {
    throw new Error('expected shell to always mount transport context controls')
  }
  if (!contextCssText.includes('.timeline-transport-clip-context-time')) {
    throw new Error('expected clip context styles to live in the focused sibling stylesheet')
  }
  for (const token of [
    'min-height: 22px',
    'border: 1px solid var(--kg-border',
    'background: color-mix(in srgb, var(--kg-panel-bg-hover',
    'color: var(--kg-text-primary',
    'color: var(--kg-text-tertiary',
    'background: color-mix(in srgb, var(--kg-canvas-accent',
  ]) {
    if (!contextCssText.includes(token)) throw new Error(`expected clip context to reuse design tokens: ${token}`)
  }

  if (!transportText.includes("import './TimelineTransportControlsMermaidGantt.css'")) {
    throw new Error('expected focused Mermaid Gantt transport chrome CSS to be imported after base transport CSS')
  }
  for (const token of [
    '.timeline-transport-chrome--mermaid-gantt .timeline-player',
    'height: var(--kg-control-height)',
    'flex: 0 0 24px',
    'border-bottom: 1px solid var(--kg-border',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-zoom-controls',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-zoom-rail',
    'width: var(--kg-timeline-zoom-progress, 0%)',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-zoom-label',
    '.timeline-transport-chrome--mermaid-gantt .timeline-video-sequence-tool-strip',
    'gap: 2px',
    'border-left: 1px solid var(--kg-border',
    'color-mix(in srgb, var(--kg-canvas-accent',
    'background: color-mix(in srgb, var(--kg-panel-bg-hover',
  ]) {
    if (!mermaidTransportCssText.includes(token)) throw new Error(`expected transport chrome tokenized finetune: ${token}`)
  }
  for (const token of [
    'timeline-transport-zoom-controls',
    'data-kg-timeline-zoom-control',
    'timeline-transport-zoom-rail',
    'timeline-transport-zoom-label',
    'renderZoomButton',
    "renderZoomButton('zoom-out')",
    "renderZoomButton('zoom-in')",
  ]) {
    if (!transportHeaderToolsText.includes(token)) throw new Error(`expected promoted zoom control token: ${token}`)
  }
  for (const token of [
    'export function TimelineVideoSequenceToolButton',
    'const VIDEO_SEQUENCE_TOOL_ICONS',
    'Record<VideoSequenceTimelineToolId, LucideIcon>',
    'data-kg-video-sequence-tool={id}',
  ]) {
    if (!videoSequenceToolButtonText.includes(token)) throw new Error(`expected shared video-sequence tool button token: ${token}`)
  }
  if (
    !transportHeaderToolsText.includes('@/components/timeline/VideoSequenceTimelineToolButton') ||
    rulerText.includes('TimelineVideoSequenceToolButton') ||
    rulerText.includes('VIDEO_SEQUENCE_TOOL_ICONS') ||
    rulerText.includes('VIDEO_SEQUENCE_TIMELINE_TOOLS.map')
  ) {
    throw new Error('expected BottomPanel Timeline tool strip to be consolidated in the transport header without ruler-local duplicates')
  }
  if (
    transportChromeModelText.includes("icon: 'audio' | 'center' | 'download'") ||
    transportChromeModelText.includes("key: 'audio' | 'center' | 'fit'")
  ) {
    throw new Error('expected zoom actions to be promoted out of the export utility action button collection type')
  }
  for (const token of [
    'zoomControls: {',
    'label: `${Math.round(args.timelineZoom * 100)}%`',
    'percent: Math.max(0, Math.min(100, args.timelineZoomPercent))',
    'timelineZoom: number',
    'timelineZoomPercent: number',
  ]) {
    if (!transportChromeModelText.includes(token)) throw new Error(`expected zoom control model token: ${token}`)
  }

  for (const token of [
    'TIMELINE_TRANSPORT_GESTURE_ZOOM_DELTA',
    'TIMELINE_TRANSPORT_WHEEL_LINE_DELTA',
    'captureZoomScrollAnchor',
    'resolveTimelineTransportRailScroller',
    'wheelZoomClientXRef',
    'zoomScrollAnchorRef',
    'wheelZoomDeltaRef',
    'wheelZoomFrameRef',
    'gestureScaleRef',
    "scroller.addEventListener('gesturestart'",
    "scroller.addEventListener('gesturechange'",
    'window.requestAnimationFrame(flushWheelZoom)',
    'window.cancelAnimationFrame(wheelZoomFrameRef.current)',
    'handleRulerWheelZoom',
    'event.preventDefault()',
    'event.stopPropagation()',
    'event.ctrlKey && !event.metaKey',
    'resolveTimelineTransportGestureZoomStepCount(delta)',
    'applyZoomStep(direction, wheelZoomClientXRef.current, stepCount)',
  ]) {
    if (!transportViewText.includes(token)) throw new Error(`expected pinch-to-zoom view token: ${token}`)
  }
  if (!timelineTransportText.includes('export const TIMELINE_TRANSPORT_GESTURE_ZOOM_DELTA')) {
    throw new Error('expected pinch-to-zoom gesture threshold to live in shared timeline transport constants')
  }
  if (!timelineTransportText.includes('export const TIMELINE_TRANSPORT_WHEEL_LINE_DELTA')) {
    throw new Error('expected pinch-to-zoom wheel normalization to live in shared timeline transport constants')
  }
  if (!timelineTransportText.includes('export const TIMELINE_TRANSPORT_GESTURE_MAX_STEPS')) {
    throw new Error('expected pinch-to-zoom burst step cap to live in shared timeline transport constants')
  }
  if (resolveTimelineTransportZoom(999) !== 6) {
    throw new Error('expected native timeline pinch zoom to expose the deeper append-workspace zoom ceiling')
  }
  if (resolveTimelineTransportGestureZoomStepCount(96) !== 3 || resolveTimelineTransportNextZoomIndex(0, 1, 3) !== 3) {
    throw new Error('expected large pinch deltas to resolve bounded multi-step timeline zoom')
  }
  for (const token of [
    'handleRulerWheelZoom: (event: React.WheelEvent<HTMLElement>) => void',
    'disabled: args.disabled',
    'handleRulerWheelZoom: transportView.handleRulerWheelZoom',
  ]) {
    if (!transportInteractionModelText.includes(token)) throw new Error(`expected interaction pinch-to-zoom token: ${token}`)
  }
  for (const token of [
    "'data-kg-gantt-timeline-pinch-zoom': '1'",
    'onWheel: args.onRulerWheel',
    'onRulerWheel: (event: React.WheelEvent<HTMLElement>) => void',
  ]) {
    if (!transportRulerModelText.includes(token)) throw new Error(`expected ruler pinch-to-zoom token: ${token}`)
  }
  for (const token of [
    'disabled: transportSession.disabled',
    'onRulerWheel: transportInteractionModel.handleRulerWheelZoom',
  ]) {
    if (!transportSurfaceModelText.includes(token)) throw new Error(`expected surface pinch-to-zoom token: ${token}`)
  }
}
