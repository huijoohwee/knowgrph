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

export function testVideoSequenceRulerDoesNotUseGeneratedFrameFallbackForSourceVideo() {
  const rulerText = readFileSync(resolve(process.cwd(), 'src/components/timeline/VideoSequenceTimelineRuler.tsx'), 'utf8')
  if (rulerText.includes('source-video-fallback') || rulerText.includes('showsGeneratedFrameContent || compactSourceVideo')) {
    throw new Error('expected compact source video thumbnails to avoid generated frame fallback ownership')
  }
}
