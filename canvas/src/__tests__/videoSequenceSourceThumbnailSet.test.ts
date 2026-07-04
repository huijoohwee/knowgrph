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

export function testVideoSequenceSourceThumbnailSetMatchesSplitSourceByBaseId() {
  const span = {
    label: '港岛仿生局.mp4 split right',
    raw: '港岛仿生局.mp4 split right : clip_harbor_split_right, kgsrc_0_72_0_84, kgpos_0_72, 0.12m',
  } as MermaidGanttTimelineTaskSpan
  const matched = resolveVideoSequenceSourceThumbnailSet({
    lane: 'video',
    sets: [{
      kind: 'video',
      label: '港岛仿生局.mp4',
      sourceAudioWaveformSamples: [],
      sourceId: 'clip_harbor',
      sourceThumbnailWindows: [],
      sourceThumbnails: [],
      sourceUrl: '/media/harbor.mp4',
    }],
    span,
  })
  if (matched?.sourceUrl !== '/media/harbor.mp4') {
    throw new Error(`expected split-right video source to resolve through its base source id, got ${JSON.stringify(matched)}`)
  }
}

export function testVideoSequenceSourceThumbnailSetKeepsBlankGenericSourcePlaceholderEmpty() {
  const span = {
    label: 'Source video',
    raw: 'Source video : operator_source_video, kgpos_0, 0.86m',
  } as MermaidGanttTimelineTaskSpan
  const matched = resolveVideoSequenceSourceThumbnailSet({
    lane: 'video',
    sets: [{
      kind: 'video',
      label: 'Source video',
      sourceAudioWaveformSamples: [],
      sourceId: 'operator_source_video',
      sourceThumbnailWindows: [],
      sourceThumbnails: [],
      sourceUrl: '/media/stale-source.mp4',
    }],
    span,
  })
  if (matched) {
    throw new Error(`expected blank generic Source video placeholder without kgsrc to stay empty, got ${JSON.stringify(matched)}`)
  }
}

export function testVideoSequenceSourceThumbnailSetKeepsGenericSourcePlaceholderEmptyWithSourceRange() {
  const span = {
    label: 'Source video',
    raw: 'Source video : operator_source_video, kgsrc_0_0_86, kgpos_0, 0.86m',
  } as MermaidGanttTimelineTaskSpan
  const matched = resolveVideoSequenceSourceThumbnailSet({
    lane: 'video',
    sets: [{
      kind: 'video',
      label: 'Source video',
      sourceAudioWaveformSamples: [],
      sourceId: 'operator_source_video',
      sourceThumbnailWindows: [],
      sourceThumbnails: [],
      sourceUrl: '/media/source-backed.mp4',
    }],
    span,
  })
  if (matched) {
    throw new Error(`expected generic Source video scaffold label with kgsrc to stay empty, got ${JSON.stringify(matched)}`)
  }
}
