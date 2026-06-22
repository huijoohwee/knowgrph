import fs from 'node:fs'
import path from 'node:path'
import {
  TIMELINE_TRANSPORT_AUTOMATION_INTENTS,
  TIMELINE_TRANSPORT_ZOOM_LEVELS,
  resolveTimelineTransportNextZoomIndex,
  resolveTimelineTransportPlayheadPercent,
  resolveTimelineTransportPlayheadScrollLeft,
  resolveTimelineTransportZoom,
} from '@/components/timeline/timelineTransport'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testTimelineTransportRateSelectUsesSharedResponsiveCssOwner() {
  const transportText = readUtf8('src/components/timeline/TimelineTransportControls.tsx')
  const cssText = readUtf8('src/components/timeline/TimelineTransportControls.css')

  if (!transportText.includes('timeline-rate-select ant-select ant-select-sm ant-select-single ant-select-show-arrow')) {
    throw new Error('expected timeline transport rate select to use the shared responsive CSS class owner')
  }
  if (!cssText.includes('.timeline-player .timeline-rate-select') || !cssText.includes('--kg-timeline-rate-select-width')) {
    throw new Error('expected timeline rate select width to live in the timeline transport CSS owner')
  }
  if (!cssText.includes('inline-size: min(') || !cssText.includes('max-width: 100%')) {
    throw new Error('expected timeline rate select to stay bounded on narrow viewports')
  }
  for (const snippet of [
    'export function TimelineTransportChrome',
    'playbackRateSelectId = React.useId()',
    'totalLabel?: string',
    'timeline-timecode-current',
    'timeline-timecode-divider',
    'timeline-timecode-total',
    'timeline-transport-chrome',
    'timeline-transport-ruler',
    'timeline-transport-ruler-tick',
    'timeline-player-range-rail',
    'timeline-video-sequence-tool-strip',
    'timeline-video-sequence-lane-sidebar',
    'timeline-transport-ruler--video-sequence',
    'data-kg-video-sequence-tool',
    '--kg-timeline-progress',
  ]) {
    if (!transportText.includes(snippet) && !cssText.includes(snippet)) {
      throw new Error(`expected timeline transport to retain shared responsive shell snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    '.timeline-transport-chrome--mermaid-gantt',
    'rgb(247 246 255 / 1) 12px',
    'rgb(130 130 226 / 0.88)',
    'rgb(0 18 128 / 1)',
    '.timeline-transport-track-clip--lane-mask',
    '.timeline-transport-track-clip--lane-grade',
    '.timeline-video-sequence-empty-dropzone',
    '.timeline-transport-track-clip--milestone .timeline-transport-track-handle',
    'opacity: 0;',
  ]) {
    if (!cssText.includes(snippet)) {
      throw new Error(`expected BottomPanel Gantt transport to retain canvas-aligned Mermaid visual snippet: ${snippet}`)
    }
  }
  if (transportText.includes('style={{ width: 90 }}')) {
    throw new Error('expected timeline transport component to avoid local fixed rate-select width literals')
  }
  const transportUtilsText = readUtf8('src/components/timeline/timelineTransport.ts')
  if (!transportUtilsText.includes('splitTimelineTransportCurrentTotalLabel')) {
    throw new Error('expected current/total label splitting to live in the shared timeline transport helper')
  }
  for (const snippet of [
    'TIMELINE_TRANSPORT_ZOOM_LEVELS',
    'TIMELINE_TRANSPORT_AUTOMATION_INTENTS',
    'resolveTimelineTransportNextZoomIndex',
    'resolveTimelineTransportPlayheadPercent',
    'resolveTimelineTransportPlayheadScrollLeft',
  ]) {
    if (!transportUtilsText.includes(snippet)) {
      throw new Error(`expected timeline transport interaction helper to stay centralized: ${snippet}`)
    }
  }
  if (TIMELINE_TRANSPORT_ZOOM_LEVELS.join(',') !== '1,1.5,2,3,4') {
    throw new Error('expected shared transport zoom levels to remain stable')
  }
  if (!TIMELINE_TRANSPORT_AUTOMATION_INTENTS.includes('center-playhead')) {
    throw new Error('expected shared transport automation intents to include playhead centering')
  }
  if (resolveTimelineTransportZoom(99) !== 4 || resolveTimelineTransportNextZoomIndex(0, -1) !== 0) {
    throw new Error('expected shared transport zoom helpers to clamp safely')
  }
  if (resolveTimelineTransportPlayheadPercent(25, 100) !== 25) {
    throw new Error('expected shared transport playhead percent helper to normalize timeline positions')
  }
  if (resolveTimelineTransportPlayheadScrollLeft({
    contentWidth: 1000,
    max: 100,
    position: 50,
    viewportWidth: 200,
  }) !== 400) {
    throw new Error('expected shared transport playhead centering helper to resolve scrollLeft')
  }
}
