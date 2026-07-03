import { useTimelinePreviewVideoBinding } from '@/components/timeline/useTimelinePreviewVideoBinding'
import { type VideoSequenceExportPlan } from '@/components/timeline/videoSequenceExport'
import { type VideoSequenceTimelineSource } from '@/components/timeline/videoSequenceTimeline'

export type GanttTimelineTransportAudioPlaybackBridgeModel = {
  active: boolean
  documentKey: string
  exportPlan: VideoSequenceExportPlan | null
  maxMinutes: number
  mediaKey: string
  source: VideoSequenceTimelineSource | null
}

const isAudioSource = (source: VideoSequenceTimelineSource | null): boolean => {
  const signature = [
    source?.mimeHint,
    source?.originalName,
    source?.relativePath,
    source?.sourceUrl,
  ].join(' ').toLowerCase()
  return /\b(?:audio|mpeg|mp3|wav|aac|m4a|opus|ogg)\b|\.m(?:p3|4a)\b|\.(?:wav|aac|opus|ogg)\b/.test(signature)
}

export function GanttTimelineTransportAudioPlaybackBridge({
  model,
}: {
  model: GanttTimelineTransportAudioPlaybackBridgeModel
}) {
  const { handleVideoElement, mediaReaderSummary, playbackGap, syncEnabled } = useTimelinePreviewVideoBinding({
    documentKey: model.documentKey,
    exportPlan: model.exportPlan,
    maxPosition: model.maxMinutes,
    mediaKey: model.mediaKey,
    source: model.source,
  })
  if (!model.active || !model.mediaKey || !model.source || !syncEnabled) return null
  const mediaProps = {
    'aria-hidden': true,
    'data-kg-gantt-timeline-audio-playback-bridge': '1',
    'data-kg-video-sequence-media-reader': mediaReaderSummary.status,
    'data-kg-video-sequence-media-reader-audio-tracks': mediaReaderSummary.audioTrackCount,
    'data-kg-video-sequence-media-reader-duration': mediaReaderSummary.durationSeconds > 0 ? mediaReaderSummary.durationSeconds : undefined,
    'data-kg-video-sequence-media-reader-primary-audio-codec': mediaReaderSummary.primaryAudioCodec || undefined,
    'data-kg-video-sequence-playback-gap': playbackGap ? 'empty' : undefined,
    preload: 'metadata',
    ref: handleVideoElement,
    src: model.mediaKey,
    style: {
      blockSize: 1,
      inlineSize: 1,
      insetBlockEnd: 0,
      insetInlineStart: 0,
      opacity: 0,
      pointerEvents: 'none',
      position: 'absolute',
    },
    tabIndex: -1,
  } as const
  return isAudioSource(model.source)
    ? <audio {...mediaProps} />
    : <video {...mediaProps} playsInline />
}
