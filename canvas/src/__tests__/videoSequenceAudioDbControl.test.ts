import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

function readSource(...parts: string[]): string {
  return readFileSync(resolve(root, 'src', ...parts), 'utf8')
}

export function testVideoSequenceAudioDbControlContract() {
  const rulerText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const controlText = readSource('components', 'timeline', 'VideoSequenceAudioDbControl.tsx')
  const denseCssText = readSource('components', 'timeline', 'VideoSequenceTimelineDenseFbf.css')
  for (const token of [
    'VideoSequenceAudioDbControl',
    "lane === 'audio' && !verticalMarker",
    'data-kg-video-sequence-audio-db-control="1"',
    'role="slider"',
    'data-kg-video-sequence-audio-db-value',
    'const dbLabel =',
    'timeline-video-sequence-audio-db-value',
    'closest(\'[data-kg-gantt-timeline-track-span="1"]\')',
    'event.stopPropagation()',
    'ArrowUp',
    'ArrowDown',
  ]) {
    if (!`${rulerText}\n${controlText}`.includes(token)) throw new Error(`expected audio dB control token: ${token}`)
  }
  for (const token of [
    '.timeline-video-sequence-audio-db-control',
    '.timeline-video-sequence-audio-db-line',
    '.timeline-video-sequence-audio-db-handle',
    '.timeline-video-sequence-audio-db-value',
    '.timeline-transport-track-clip[data-kg-timeline-clip-compact="1"] .timeline-transport-track-clip-label',
    '[data-kg-video-sequence-clip-thumbnail-reel="1"]:not(.timeline-transport-track-clip--lane-fbf) .timeline-transport-track-clip-label',
    'top: var(--kg-video-sequence-audio-db-top, 33.333%)',
    'height: 16px',
    'background: color-mix(in srgb, var(--kg-panel-bg, #fff) 86%, transparent)',
    'border: 1px solid color-mix(in srgb, var(--kg-panel-bg, #fff) 88%, transparent)',
    'backdrop-filter: blur(2px)',
    '[data-kg-video-sequence-clip-thumbnail-reel="1"]:not(.timeline-transport-track-clip--lane-audio):not(.timeline-transport-track-clip--lane-fbf) .timeline-transport-track-clip-move',
    'z-index: 8',
    'z-index: 9',
    '.timeline-video-sequence-clip-thumbnail-strip',
    'z-index: 2',
    'color-mix(in srgb, var(--kg-canvas-accent, rgb(37 99 235 / 1)) 78%, var(--kg-text-primary, #0f172a) 22%)',
    'opacity: 0.94',
    'var(--kg-canvas-accent, rgb(37 99 235 / 1)) 74%',
    'var(--kg-canvas-accent, rgb(37 99 235 / 1)) 82%',
    'var(--kg-canvas-accent, rgb(37 99 235 / 1)) 88%',
    'background: var(--kg-canvas-accent, rgb(37 99 235 / 1))',
    'background: color-mix(in srgb, var(--kg-canvas-accent, rgb(37 99 235 / 1)) 82%, var(--kg-panel-bg, #fff) 18%)',
    'cursor: ns-resize',
    'opacity: 0',
    'pointer-events: none',
    '.timeline-transport-track-clip--lane-audio:hover .timeline-video-sequence-audio-db-control',
    '.timeline-transport-track-clip--lane-audio:focus-within .timeline-video-sequence-audio-db-control',
    'pointer-events: auto',
    'translate: 0 -50%',
  ]) {
    if (!denseCssText.includes(token)) throw new Error(`expected in-bar audio dB control style: ${token}`)
  }
  if (!denseCssText.includes('font-weight: 400')) throw new Error('compact source bar labels must use normal text weight')
  if (denseCssText.includes('color: #1e40af')) throw new Error('audio label must reuse the play marker accent token')
  if (denseCssText.includes('.timeline-transport-track-clip--lane-audio[data-kg-timeline-clip-compact="1"] .timeline-transport-track-clip-label')) {
    throw new Error('audio label must reuse the shared compact source label rule')
  }
  if (denseCssText.includes('[data-kg-video-sequence-clip-thumbnail-reel="1"]:not(.timeline-transport-track-clip--lane-fbf) .timeline-transport-track-clip-label {\n  display: none;')) throw new Error('compact media thumbnail-reel labels must stay visible')
  if (denseCssText.includes('border-radius: 0;\n  background: transparent;\n  font-size: 9px;')) throw new Error('compact media labels must keep a visible shared scrim')
  if (denseCssText.includes('[data-kg-video-sequence-clip-thumbnail-reel="1"]:not(.timeline-transport-track-clip--lane-audio):not(.timeline-transport-track-clip--lane-fbf) .timeline-transport-track-clip-move {\n  z-index: 1;')) throw new Error('thumbnail-reel label surface must stay above the thumbnail strip')
  if (denseCssText.includes('background: color-mix(in srgb, #1e40af')) throw new Error('audio dB value must reuse the play marker accent token')
}
