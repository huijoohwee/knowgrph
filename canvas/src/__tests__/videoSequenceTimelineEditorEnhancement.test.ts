import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildVideoSequenceTimelineZoomTicks, resolveVideoSequenceTimelineAppendSpacePercent, resolveVideoSequenceTimelineContentZoom, resolveVideoSequenceTimelineFrameRate, resolveVideoSequenceTimelineScaleDurationSeconds, resolveVideoSequenceTimelineScaleMaxMinutes, resolveVideoSequenceTimelineZoomTickStepSeconds } from '@/components/timeline/videoSequenceTimelineZoom'
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
  const clipThumbnailStripText = readSource('components', 'timeline', 'VideoSequenceClipThumbnailStrip.tsx')
  const clipMetaText = readSource('components', 'timeline', 'VideoSequenceTimelineClipMeta.tsx')
  const clipMetaCssText = readSource('components', 'timeline', 'VideoSequenceTimelineClipMeta.css')
  const denseFbfCssText = readSource('components', 'timeline', 'VideoSequenceTimelineDenseFbf.css')
  const mermaidTransportCssText = readSource('components', 'timeline', 'TimelineTransportControlsMermaidGantt.css')
  const transportCssText = readSource('components', 'timeline', 'TimelineTransportControls.css')
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
    'buildVideoSequenceTimelineZoomTicks({ displayTicks, frameRate: mediaFrameRate, maxMinutes: timelineScaleMaxMinutes, mediaDurationSeconds, timelineZoom })',
    'resolveVideoSequenceTimelineScaleMaxMinutes({ maxMinutes, mediaDurationSeconds })',
    'resolveVideoSequenceTimelineAppendSpacePercent(timelineZoom)',
    'resolveVideoSequenceTimelineContentZoom({ frameRate: mediaFrameRate, mediaDurationSeconds, timelineZoom })',
    'flexBasis: `${timelineContentZoom * 100}%`',
    'data-kg-video-sequence-content-zoom',
    'timeline-video-sequence-editor timeline-video-sequence-grid',
    'timeline-video-sequence-ruler-scroll timeline-video-sequence-ruler-surface',
    'timeline-video-sequence-ruler-scroll-content',
    'timeline-video-sequence-ruler-viewport',
    'timeline-video-sequence-ruler-axis',
    'data-kg-video-sequence-ruler-axis="1"',
    'data-kg-video-sequence-ruler-body="1"',
    'data-kg-video-sequence-ruler-playhead="1"',
    'data-kg-video-sequence-ruler-playhead-marker="1"',
    'timeline-video-sequence-ruler-playhead-marker',
    'aria-label="Timeline playhead marker"',
    'const bodyMinHeight = Math.max(1, minHeight - VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX)',
    'timeline-video-sequence-ruler-append-space',
    'data-kg-video-sequence-append-space="1"',
    'resolveVideoSequenceSourceWindowLabel(thumbnailWindow)',
  ]) {
    if (!rulerText.includes(token)) throw new Error(`expected enhanced ruler token: ${token}`)
  }
  for (const token of [
    'TimelineVideoSequenceEmptyState',
    'timeline-video-sequence-surface--empty',
    'timeline-video-sequence-empty-dropzone',
    '<span className="sr-only">{scope.label}</span>',
  ]) {
    if (rulerText.includes(token)) throw new Error(`expected empty Timeline to reuse shared transport instead of stale ruler token: ${token}`)
  }
  for (const token of [
    'formatVideoSequenceTimeAxisLabel',
    "padStart(2, '0')",
    'resolveVideoSequenceTickMajor',
    'data-kg-video-sequence-major-tick',
    "/^\\d+f$/i",
    '<time className="timeline-transport-ruler-tick-label"',
    'dateTime={resolveVideoSequenceTickDateTime(tick)}',
    'aria-hidden="true"',
  ]) {
    if (!rulerTicksText.includes(token)) throw new Error(`expected semantic time-axis tick token: ${token}`)
  }
  for (const token of [
    '.timeline-transport-ruler--video-sequence .timeline-transport-ruler-tick',
    'height: 24px',
    'justify-content: flex-start',
    'font-variant-numeric: tabular-nums',
    '.timeline-transport-ruler--video-sequence .timeline-transport-ruler-tick-line',
    'height: 5px',
    '.timeline-transport-ruler--video-sequence .timeline-transport-ruler-tick-label',
    '.timeline-transport-ruler--video-sequence .timeline-video-sequence-ruler-append-space',
    'border-top: 1px dashed',
  ]) {
    if (!rulerTimeAxisCssText.includes(token)) throw new Error(`expected lean time-axis style: ${token}`)
  }
  for (const token of [
    '.timeline-video-sequence-grid',
    '--kg-video-sequence-lane-sidebar-width: 112px',
    'grid-template-columns: var(--kg-video-sequence-lane-sidebar-width, 112px) minmax(0, 1fr)',
    'repeat-x 0 24px / 25% calc(100% - 24px)',
    '.timeline-video-sequence-ruler-scroll',
    'overflow-y: auto',
    'overscroll-behavior: contain',
    '.timeline-video-sequence-ruler-scroll-content',
    '.timeline-video-sequence-ruler-viewport',
    '.timeline-video-sequence-ruler-axis',
    '.timeline-video-sequence-ruler-content',
    'border-bottom: 1px solid rgb(226 232 240 / 1)',
    'cursor: ew-resize',
    'pointer-events: auto',
    'touch-action: none',
    'z-index: 7',
    'z-index: 8',
    'top: -24px',
    'top: 50%',
    'transform: translate(-50%, -50%)',
    '.timeline-video-sequence-ruler-playhead-marker',
    'padding-inline: 18px 12px',
    'border-bottom: 1px solid rgb(203 213 225 / 0.34)',
    'margin-top: 24px',
    '.timeline-video-sequence-ruler-surface',
  ]) {
    if (!transportCssText.includes(token)) throw new Error(`expected shared empty/source timeline visual style: ${token}`)
  }
  if (transportCssText.includes('.timeline-video-sequence-empty-dropzone')) {
    throw new Error('expected shared transport CSS to drop the old empty Timeline dropzone styling')
  }
  if (mermaidTransportCssText.includes('repeating-linear-gradient(90deg, transparent 0, transparent 39px')) {
    throw new Error('expected BottomPanel timeline body to avoid dense stacked vertical grid layers')
  }
  if (mermaidTransportCssText.includes('repeating-linear-gradient(180deg, transparent 0, transparent calc(var(--kg-video-sequence-lane-height')) {
    throw new Error('expected BottomPanel timeline lane rail to avoid stacked repeated lane separators')
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
    'VIDEO_SEQUENCE_TIMELINE_FRAME_LABEL_ZOOM',
    'VIDEO_SEQUENCE_TIMELINE_FRAME_TICK_STEP_FRAMES',
    'VIDEO_SEQUENCE_TIMELINE_FRAME_LABEL_STEP_FRAMES',
    'VIDEO_SEQUENCE_TIMELINE_FRAME_LABEL_MAX_FRAME',
    'VIDEO_SEQUENCE_TIMELINE_FRAME_RULER_MIN_LABEL_SPACING_PX',
    'VIDEO_SEQUENCE_TIMELINE_FRAME_RULER_REFERENCE_WIDTH_PX',
    'VIDEO_SEQUENCE_TIMELINE_DEFAULT_FRAME_RATE',
    'resolveVideoSequenceTimelineFrameRate',
    'resolveVideoSequenceTimelineContentZoom',
    'formatVideoSequenceTimelineFrameLabel',
  ]) {
    if (!rulerZoomText.includes(token)) throw new Error(`expected shared zoom-axis helper token: ${token}`)
  }
  if (resolveVideoSequenceTimelineZoomTickStepSeconds({ durationSeconds: resolveVideoSequenceTimelineScaleDurationSeconds(52), timelineZoom: 4 }) !== 2) {
    throw new Error('expected max zoom to expose two-second timeline ticks for sub-minute media')
  }
  const defaultTicks = buildVideoSequenceTimelineZoomTicks({ displayTicks: [], maxMinutes: 30, mediaDurationSeconds: 30, timelineZoom: 1 })
  if (defaultTicks.map(tick => tick.label).join(',') !== '0:00,0:10,0:20,0:30') {
    throw new Error(`expected default BottomPanel source timeline ticks to use ten-second major labels, got ${JSON.stringify(defaultTicks)}`)
  }
  const scaleMaxMinutes = resolveVideoSequenceTimelineScaleMaxMinutes({ maxMinutes: 52, mediaDurationSeconds: 52 })
  const zoomTicks = buildVideoSequenceTimelineZoomTicks({ displayTicks: [], maxMinutes: scaleMaxMinutes, mediaDurationSeconds: 52, timelineZoom: 4 })
  if (Math.abs(scaleMaxMinutes - 60) > 0.0001 || zoomTicks[1]?.label !== '0:02' || Math.abs((zoomTicks[1]?.percent || 0) - (2 / 60) * 100) > 0.0001 || zoomTicks[zoomTicks.length - 1]?.label !== '1:00') {
    throw new Error(`expected zoom ticks to use rounded 60-second scale, got ${JSON.stringify({ scaleMaxMinutes, ticks: zoomTicks.slice(0, 3), last: zoomTicks.at(-1) })}`)
  }
  if (resolveVideoSequenceTimelineAppendSpacePercent(1) !== 0 || resolveVideoSequenceTimelineAppendSpacePercent(4) <= 0) {
    throw new Error('expected right-side append workspace only when the timeline is zoomed in')
  }
  if (resolveVideoSequenceTimelineFrameRate(0) !== 24 || resolveVideoSequenceTimelineFrameRate(240) !== 120) {
    throw new Error('expected max-zoom frame ticks to use a bounded source frame-rate hint')
  }
  const frameTickRate = 30
  const expectedFrameLabels = ['00:00', ...Array.from({ length: 5 }, (_, index) => `${(index + 1) * 2}f`), '0:01']
  const maxZoomFrameTicks = buildVideoSequenceTimelineZoomTicks({ displayTicks: [], frameRate: frameTickRate, maxMinutes: 30, mediaDurationSeconds: 30, timelineZoom: 6 })
  if (maxZoomFrameTicks.filter(tick => tick.label).slice(0, expectedFrameLabels.length).map(tick => tick.label).join(',') !== expectedFrameLabels.join(',')) {
    throw new Error(`expected max-zoom BottomPanel source timeline labels to use bounded frame anchors, got ${JSON.stringify(maxZoomFrameTicks.slice(0, 80).map(tick => tick.label))}`)
  }
  if (maxZoomFrameTicks.some(tick => /^1[2-9]f$/i.test(tick.label))) {
    throw new Error(`expected max-zoom frame ticks to avoid repeated midpoint frame-count labels, got ${JSON.stringify(maxZoomFrameTicks.slice(0, 80).map(tick => tick.label))}`)
  }
  if (resolveVideoSequenceTimelineContentZoom({ frameRate: 30, mediaDurationSeconds: 30, timelineZoom: 6 }) !== 6) {
    throw new Error('expected bounded max-zoom frame labels to avoid forced content over-expansion')
  }

  for (const token of [
    'aria-label={`${span.label} thumbnail ${formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)} ${thumbnail.format}/${thumbnail.rasterFormat}`}',
    'data-kg-video-sequence-clip-thumbnail-caption-format',
    'data-kg-video-sequence-clip-thumbnail-caption-time',
    'data-kg-video-sequence-clip-thumbnail-preview-caption',
  ]) {
    if (!clipThumbnailStripText.includes(token)) throw new Error(`expected text-neutral thumbnail metadata token: ${token}`)
  }
  if (
    clipThumbnailStripText.includes('{thumbnail.format}/{thumbnail.rasterFormat}</span>') ||
    clipThumbnailStripText.includes('{formatVideoSequenceTimelineSecondsOffset(thumbnail.timestampSeconds)} {thumbnail.format}/{thumbnail.rasterFormat}')
  ) {
    throw new Error('expected thumbnail metadata to stay out of visible ruler text')
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
    '.timeline-transport-track-clip[data-kg-compact-source-media="1"]:not(.timeline-transport-track-clip--lane-fbf)',
    'height: var(--kg-compact-source-media-bar-height, 42px)',
    'translate: 0 calc((var(--kg-video-sequence-lane-height, 61px) - var(--kg-compact-source-media-bar-height, 42px)) / 2)',
    'border-color: rgb(15 23 42 / 0.24)',
    'inset: 2px 5px',
    'flex: 1 1 0',
    'min-width: 0',
    'filter: saturate(1.04) contrast(1.02)',
    'background: transparent',
    'box-shadow: 0 1px 2px rgb(15 23 42 / 0.1)',
    'width: 3px',
    'height: 18px',
    'linear-gradient(180deg, color-mix(in srgb, var(--kg-panel-bg',
  ]) {
    if (!denseFbfCssText.includes(token)) throw new Error(`expected edit rail style: ${token}`)
  }
  if (denseFbfCssText.includes('border-color: rgb(0 153 255')) {
    throw new Error('expected compact timeline chrome to use design token canvas accent')
  }
  if (denseFbfCssText.includes('height: var(--kg-control-height,')) {
    throw new Error('expected compact timeline bar height to use the main-toolbar-derived timeline bar token')
  }
  if (denseFbfCssText.includes('background: rgb(2 6 23 / 0.58);')) {
    throw new Error('expected compact media bar labels to render as direct top-left text without a badge background')
  }
  if (denseFbfCssText.includes('0 0 0 1px rgb(37 99 235 / 0.32)')) {
    throw new Error('expected compact media selected chrome to use a subtle border line instead of an outer glow')
  }
  if (mermaidTransportCssText.includes('0 0 0 2px rgb(37 99 235 / 0.44)')) {
    throw new Error('expected scoped compact media selected chrome to avoid the heavy outer ring')
  }
  if (
    denseFbfCssText.includes('inset 0 0 0 1px color-mix(in srgb, var(--kg-canvas-accent') ||
    mermaidTransportCssText.includes('inset 0 0 0 1px color-mix(in srgb, var(--kg-canvas-accent')
  ) {
    throw new Error('expected compact media selected chrome to avoid redundant inset frames')
  }
  if (denseFbfCssText.includes('.timeline-transport-track-clip--lane-audio[data-kg-compact-source-media="1"]')) {
    throw new Error('expected compact source audio to reuse the shared source bar chrome')
  }

  if (
    !denseFbfCssText.includes('[data-kg-video-sequence-dense-fbf="1"] .timeline-video-sequence-clip-meta') ||
    !denseFbfCssText.includes('[data-kg-compact-source-media="1"] .timeline-video-sequence-clip-meta')
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
    'clip-path: inset(50%)',
    'background: color-mix(in srgb, var(--kg-canvas-accent',
  ]) {
    if (!contextCssText.includes(token)) throw new Error(`expected clip context to reuse design tokens: ${token}`)
  }

  if (!transportText.includes("import './TimelineTransportControlsMermaidGantt.css'")) {
    throw new Error('expected focused Mermaid Gantt transport chrome CSS to be imported after base transport CSS')
  }
  for (const token of [
    '.timeline-transport-chrome--mermaid-gantt .timeline-player',
    'height: var(--kg-main-toolbar-height, 38px)',
    'flex: 0 0 26px',
    'isolation: isolate',
    'min-height: 100%',
    'gap: 0',
    'padding: 0',
    'inset 0 -1px 0 color-mix(in srgb, var(--kg-border',
    '.timeline-transport-chrome--mermaid-gantt[data-kg-video-sequence-timeline="source-backed"]',
    '.timeline-transport-chrome--mermaid-gantt[data-kg-video-sequence-timeline="empty"]',
    'height: 100%',
    'border-bottom: 1px solid var(--kg-border',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-zoom-controls',
    'height: 22px',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-zoom-label',
    'flex: 0 0 28px',
    '.timeline-transport-chrome--mermaid-gantt .timeline-video-sequence-tool-strip',
    'border-inline: 1px solid color-mix(in srgb, var(--kg-border',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-header-tools',
    'justify-content: flex-start',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-ruler-layout',
    'flex: 1 1 auto',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-ruler--video-sequence',
    'border-top: 0',
    'min-height: calc(76px + (var(--kg-video-sequence-lane-count, 4) * var(--kg-video-sequence-lane-height)))',
    '.timeline-transport-chrome--mermaid-gantt .timeline-video-sequence-ruler-scroll-content',
    '.timeline-transport-chrome--mermaid-gantt .timeline-video-sequence-ruler-surface',
    '.timeline-transport-chrome--mermaid-gantt .timeline-transport-ruler-tick:not([data-kg-video-sequence-major-tick="1"]) .timeline-transport-ruler-tick-label',
    'color-mix(in srgb, var(--kg-panel-bg-hover, #f9fafb) 62%, var(--kg-panel-bg, #fff))',
    '.timeline-transport-chrome--mermaid-gantt .timeline-video-sequence-ruler-content .timeline-transport-track-clip[data-kg-compact-source-media="1"].timeline-transport-track-clip--selected:not(.timeline-transport-track-clip--lane-fbf)',
    '.timeline-transport-chrome--mermaid-gantt .timeline-video-sequence-ruler-content .timeline-transport-track-handle-grip',
    '.timeline-transport-chrome--mermaid-gantt .timeline-tool-menu:not([open]) > .timeline-tool-menu-panel',
    '.timeline-transport-chrome--mermaid-gantt .timeline-player-context:empty',
    'flex-wrap: nowrap',
    'gap: 2px',
    'color-mix(in srgb, var(--kg-canvas-accent',
    'background: color-mix(in srgb, var(--kg-panel-bg-hover',
  ]) {
    if (!mermaidTransportCssText.includes(token)) throw new Error(`expected transport chrome tokenized finetune: ${token}`)
  }
  for (const token of [
    'timeline-transport-zoom-controls',
    'data-kg-timeline-zoom-control',
    'timeline-transport-zoom-label',
    'timeline-tool-menu--edit',
    'timeline-tool-menu--zoom',
    'aria-label="Video sequence edit tools"',
    'aria-label="Timeline fit and center tools"',
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
    transportHeaderToolsText.indexOf('args.model.syncModeButton.ariaLabel') > transportHeaderToolsText.indexOf('timeline-tool-menu--edit') ||
    transportHeaderToolsText.indexOf('timeline-tool-menu--edit') > transportHeaderToolsText.indexOf('args.model.clipActionButtons.map') ||
    rulerText.includes('TimelineVideoSequenceToolButton') ||
    rulerText.includes('VIDEO_SEQUENCE_TOOL_ICONS') ||
    rulerText.includes('VIDEO_SEQUENCE_TIMELINE_TOOLS.map')
  ) {
    throw new Error('expected BottomPanel Timeline tool strip to stay compact in the transport header without ruler-local duplicates')
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
    'const timelinePlanSourceFrameRate = React.useMemo',
    'mediaFrameRate: selectedPreviewEmpty ? 0 : (timelinePlanSourceFrameRate || thumbnailSummary.averageVideoFrameRate)',
  ]) {
    if (!transportSurfaceModelText.includes(token)) throw new Error(`expected source-backed frame-rate ruler token: ${token}`)
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
