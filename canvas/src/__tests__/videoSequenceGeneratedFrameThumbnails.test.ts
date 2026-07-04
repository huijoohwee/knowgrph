import { buildVideoSequenceGeneratedFrameThumbnails } from '@/components/timeline/videoSequenceGeneratedFrameThumbnails'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const decodeSvgDataUrl = (value: string): string => decodeURIComponent(value.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''))

export function testVideoSequenceGeneratedFrameThumbnailsStayFrameByFrameOnly() {
  const span = {
    durationMinutes: 1,
    endMinutes: 1,
    label: 'Source video',
    raw: 'Source video : clip_source, kgsrc_0_0_86, kgpos_0, 0.86m',
    startMinutes: 0,
  } as MermaidGanttTimelineTaskSpan
  const fbfFallback = buildVideoSequenceGeneratedFrameThumbnails({
    sourceWindow: { sourceEndSeconds: 1, sourceStartSeconds: 0 },
    span,
  })[0]
  const fbfSvg = decodeSvgDataUrl(fbfFallback?.dataUrl || '')
  if (!fbfSvg.includes('"source":"frame-by-frame"') || !fbfSvg.includes('>FBF<') || fbfSvg.includes('"source":"source-video"')) {
    throw new Error(`expected FBF fallback thumbnails to keep FBF identity, got ${fbfSvg.slice(0, 420)}`)
  }
}

export function testVideoSequenceRulerDoesNotUseGeneratedSourceVideoFallbackReels() {
  const rulerText = readFileSync(resolve(process.cwd(), 'src/components/timeline/VideoSequenceTimelineRuler.tsx'), 'utf8')
  const cssText = readFileSync(resolve(process.cwd(), 'src/components/timeline/VideoSequenceTimelineDenseFbf.css'), 'utf8')
  const generatedText = readFileSync(resolve(process.cwd(), 'src/components/timeline/videoSequenceGeneratedFrameThumbnails.ts'), 'utf8')
  if (
    rulerText.includes('sourceVideoFallbackSamples') ||
    rulerText.includes("origin: 'source-video'") ||
    rulerText.includes("thumbnailOrigin = sourceVideoFallbackSamples.length ? 'source-video'") ||
    generatedText.includes('buildSourceVideoThumbnailSvg') ||
    generatedText.includes('>VID<') ||
    generatedText.includes("'source-video'") ||
    !rulerText.includes('data-kg-video-sequence-clip-thumbnail-origin') ||
    !rulerText.includes('data-kg-video-sequence-clip-thumbnail-reel') ||
    !cssText.includes('[data-kg-video-sequence-clip-thumbnail-reel="1"]') ||
    !cssText.includes('width: 6px;') ||
    !cssText.includes('left: 0;') ||
    !cssText.includes('right: 0;') ||
    cssText.includes('width: min(34px, 38%)') ||
    cssText.includes('left: -10px;') ||
    cssText.includes('right: -10px;') ||
    cssText.includes('background: color-mix(in srgb, var(--kg-canvas-accent, #2563eb) 12%, transparent);')
  ) {
    throw new Error('expected compact source video rows to avoid generated VID fallback reels and keep edge handles off thumbnail cells')
  }
}
