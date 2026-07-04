import { resolveVideoSequenceSourceThumbnailSet } from '@/components/timeline/videoSequenceSourceThumbnailSet'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'

export function testVideoSequenceSourceThumbnailSetMatchesPendingVideoSourceById() {
  const span = {
    label: 'flower.mp4',
    raw: 'flower.mp4 : clip_flower, kgsrc_0_1, kgpos_0_44, 1m',
  } as MermaidGanttTimelineTaskSpan
  const matched = resolveVideoSequenceSourceThumbnailSet({
    lane: 'video',
    sets: [{
      kind: 'video',
      label: 'flower.mp4',
      sourceAudioWaveformSamples: [],
      sourceId: 'clip_flower',
      sourceThumbnailWindows: [],
      sourceThumbnails: [],
      sourceUrl: '/media/flower.mp4',
    }],
    span,
  })
  if (matched?.sourceUrl !== '/media/flower.mp4') {
    throw new Error(`expected pending video source without thumbnails to match by source id, got ${JSON.stringify(matched)}`)
  }
}
