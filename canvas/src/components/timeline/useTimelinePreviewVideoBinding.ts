import React from 'react'
import { useTimelineVideoPreviewSyncController } from './timelinePreviewSync'
import { type VideoSequenceExportPlan } from './videoSequenceExport'
import { mergeTimelineMediaReaderSummaryWithSource, useTimelineMediaReaderSummary } from './timelineMediaReader'
import {
  useTimelineDocumentTransportController,
  useTimelineTransportSnapshotReader,
  useTimelineTransportStoreBinding,
} from './timelineTransport'
import { type VideoSequenceTimelineSource } from './videoSequenceTimeline'

export function useTimelinePreviewVideoBinding(args: {
  documentKey: string
  exportPlan: VideoSequenceExportPlan | null
  maxPosition: number
  mediaKey: string
  source?: VideoSequenceTimelineSource | null
}) {
  const videoElementRef = React.useRef<HTMLVideoElement | null>(null)
  const syncEnabled = !!(
    args.source
    && args.mediaKey
    && args.documentKey
    && args.maxPosition > 0
  )
  const mediaReaderSummary = useTimelineMediaReaderSummary({
    active: syncEnabled,
    url: args.mediaKey,
  })
  const resolvedMediaReaderSummary = React.useMemo(
    () => mergeTimelineMediaReaderSummaryWithSource(mediaReaderSummary, args.source),
    [args.source, mediaReaderSummary],
  )
  const {
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  } = useTimelineTransportStoreBinding()
  const {
    playbackPosition,
    playing,
    playbackRate,
    setTransportPlaybackPosition,
    setTransportPlaying,
  } = useTimelineDocumentTransportController({
    active: syncEnabled,
    documentKey: args.documentKey,
    maxPosition: args.maxPosition,
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  })
  const readTransportSnapshot = useTimelineTransportSnapshotReader({
    transportDocumentKey,
    transportPosition,
  })
  const handleVideoElement = React.useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element
  }, [])

  useTimelineVideoPreviewSyncController({
    active: syncEnabled,
    documentKey: args.documentKey,
    exportPlan: args.exportPlan,
    maxPosition: args.maxPosition,
    mediaKey: args.mediaKey,
    playbackPosition,
    playbackRate,
    playing,
    readTransportSnapshot,
    readVideo: () => videoElementRef.current,
    readerDurationSeconds: resolvedMediaReaderSummary.durationSeconds,
    setTransportPlaybackPosition,
    setTransportPlaying,
    source: args.source,
  })

  return {
    handleVideoElement,
    mediaReaderSummary: resolvedMediaReaderSummary,
    syncEnabled,
  }
}
