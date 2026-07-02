import React from 'react'
import RichMediaPanel, { type RichMediaPanelProps } from '@/components/RichMediaPanel'
import { cn } from '@/lib/utils'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import {
  MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR,
  MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR,
} from '@/lib/media/mediaFormatPreference'
import { type VideoSequenceTimelineSource } from './videoSequenceTimeline'
import { type VideoSequenceExportPlan } from './videoSequenceExport'
import { useTimelinePreviewVideoBinding } from './useTimelinePreviewVideoBinding'
import { type TimelinePreviewFamilyDisclosureItem } from './useTimelinePreviewFamilyDisclosureModel'
import { buildTimelineAnimationState } from './timelineAnimationEngine'

export type TimelinePreviewSurfaceItem = {
  key: string
  kind: 'image' | 'video' | 'audio' | 'iframe'
  label: string
  openUrl: string
  panel?: RichMediaPanelProps['panel']
  source: string
  src: string
  srcDoc?: string
  videoSequenceSource?: VideoSequenceTimelineSource
}

export type TimelinePreviewSurfaceProps = {
  activity?: TimelinePreviewFamilyDisclosureItem
  documentKey: string
  exportPlan: VideoSequenceExportPlan | null
  item: TimelinePreviewSurfaceItem
  sequenceMaxMinutes: number
}

export function TimelinePreviewSurface(args: TimelinePreviewSurfaceProps) {
  const panelState = React.useMemo(
    () => args.item.panel || buildStaticRichMediaPanelOverlayState({ renderKind: args.item.kind }),
    [args.item.kind, args.item.panel],
  )
  const { handleVideoElement, mediaReaderSummary, playbackGap, syncEnabled } = useTimelinePreviewVideoBinding({
    documentKey: args.documentKey,
    exportPlan: args.exportPlan,
    maxPosition: args.sequenceMaxMinutes,
    mediaKey: args.item.src,
    source: args.item.source === 'video-sequence' && (args.item.kind === 'video' || args.item.kind === 'audio')
      ? args.item.videoSequenceSource || null
      : null,
  })
  const videoThumbnails = syncEnabled && args.item.kind === 'video' ? mediaReaderSummary.thumbnails : []
  const videoPoster = videoThumbnails[0]?.dataUrl || undefined
  const animationState = React.useMemo(() => buildTimelineAnimationState({
    active: args.activity?.active || args.activity?.containsPlayhead,
    itemCount: args.activity?.familyItemCount || 1,
    progress: args.activity?.containsPlayhead ? 1 : args.activity?.dimmed ? 0.18 : 0.54,
    surface: 'media-canvas',
  }), [args.activity?.active, args.activity?.containsPlayhead, args.activity?.dimmed, args.activity?.familyItemCount])

  return (
    <article
      className={cn(
        'relative aspect-video min-h-0 overflow-hidden transition-opacity',
        args.activity?.dimmed && 'opacity-60',
        args.activity?.active && 'rounded outline outline-1 outline-[var(--kg-canvas-accent)] outline-offset-0',
      )}
      data-kg-media-canvas-item="1"
      data-kg-media-canvas-item-active={args.activity?.active ? '1' : undefined}
      data-kg-media-canvas-item-activity-mode={args.activity?.activityMode}
      data-kg-media-canvas-item-contains-playhead={args.activity?.containsPlayhead ? '1' : undefined}
      data-kg-media-canvas-item-dimmed={args.activity?.dimmed ? '1' : undefined}
      data-kg-media-canvas-item-family={args.activity?.familyId || undefined}
      data-kg-media-canvas-item-family-collapsed={args.activity?.familyCollapsed ? '1' : undefined}
      data-kg-media-canvas-item-family-disclosure-state={args.activity?.familyDisclosureState}
      data-kg-media-canvas-item-family-expandable={args.activity?.familyExpandable ? '1' : undefined}
      data-kg-media-canvas-item-family-expanded={args.activity?.familyExpanded ? '1' : undefined}
      data-kg-media-canvas-item-family-hidden-count={args.activity?.familyHiddenItemCount || undefined}
      data-kg-media-canvas-item-family-item-count={args.activity?.familyItemCount || undefined}
      data-kg-media-canvas-item-family-label={args.activity?.familyLabel || undefined}
      data-kg-media-canvas-item-family-representative={args.activity?.familyRepresentative ? '1' : undefined}
      data-kg-media-canvas-kind={args.item.kind}
      data-kg-media-canvas-item-matches-selection={args.activity?.matchesSelection ? '1' : undefined}
      data-kg-media-canvas-item-style-mode={args.activity?.styleMode}
      data-kg-media-canvas-source={args.item.source}
      data-kg-media-canvas-rich-media-panel="1"
      data-kg-video-sequence-media-sync={syncEnabled ? '1' : undefined}
      data-kg-video-sequence-playback-gap={playbackGap ? 'empty' : undefined}
      data-kg-video-sequence-media-reader={syncEnabled ? mediaReaderSummary.status : undefined}
      data-kg-video-sequence-media-reader-audio-tracks={syncEnabled ? mediaReaderSummary.audioTrackCount : undefined}
      data-kg-video-sequence-media-reader-audio-channels={syncEnabled && mediaReaderSummary.audioChannelCount > 0 ? mediaReaderSummary.audioChannelCount : undefined}
      data-kg-video-sequence-media-reader-audio-sample-rate={syncEnabled && mediaReaderSummary.audioSampleRate > 0 ? mediaReaderSummary.audioSampleRate : undefined}
      data-kg-video-sequence-media-reader-bitrate={syncEnabled && mediaReaderSummary.averageVideoBitrate > 0 ? mediaReaderSummary.averageVideoBitrate : undefined}
      data-kg-video-sequence-media-reader-byte-size={syncEnabled && mediaReaderSummary.byteSize > 0 ? mediaReaderSummary.byteSize : undefined}
      data-kg-video-sequence-media-reader-bytes-read={syncEnabled && mediaReaderSummary.bytesRead > 0 ? mediaReaderSummary.bytesRead : undefined}
      data-kg-video-sequence-media-reader-container-brand={syncEnabled && mediaReaderSummary.containerBrand ? mediaReaderSummary.containerBrand : undefined}
      data-kg-video-sequence-media-reader-compatible-brands={syncEnabled && mediaReaderSummary.compatibleBrands.length ? mediaReaderSummary.compatibleBrands.join(',') : undefined}
      data-kg-video-sequence-media-reader-duration={syncEnabled && mediaReaderSummary.durationSeconds > 0 ? mediaReaderSummary.durationSeconds : undefined}
      data-kg-video-sequence-media-reader-duration-source={syncEnabled ? mediaReaderSummary.durationSource : undefined}
      data-kg-video-sequence-media-reader-format={syncEnabled && mediaReaderSummary.formatName ? mediaReaderSummary.formatName : undefined}
      data-kg-video-sequence-media-reader-frame-rate={syncEnabled && mediaReaderSummary.averageVideoFrameRate > 0 ? mediaReaderSummary.averageVideoFrameRate : undefined}
      data-kg-video-sequence-media-reader-mime-type={syncEnabled && mediaReaderSummary.mimeType ? mediaReaderSummary.mimeType : undefined}
      data-kg-video-sequence-media-reader-primary-audio-codec={syncEnabled && mediaReaderSummary.primaryAudioCodec ? mediaReaderSummary.primaryAudioCodec : undefined}
      data-kg-video-sequence-media-reader-primary-video-codec={syncEnabled && mediaReaderSummary.primaryVideoCodec ? mediaReaderSummary.primaryVideoCodec : undefined}
      data-kg-video-sequence-media-reader-read-ratio={syncEnabled && mediaReaderSummary.metadataReadRatio > 0 ? mediaReaderSummary.metadataReadRatio : undefined}
      data-kg-video-sequence-media-reader-resolution={syncEnabled && mediaReaderSummary.displayWidth > 0 && mediaReaderSummary.displayHeight > 0 ? `${mediaReaderSummary.displayWidth}x${mediaReaderSummary.displayHeight}` : undefined}
      data-kg-video-sequence-media-reader-time-resolution={syncEnabled && mediaReaderSummary.timeResolution > 0 ? mediaReaderSummary.timeResolution : undefined}
      data-kg-video-sequence-media-reader-video-tracks={syncEnabled ? mediaReaderSummary.videoTrackCount : undefined}
      data-kg-video-sequence-media-thumbnail-count={videoThumbnails.length || undefined}
      data-kg-video-sequence-media-thumbnail-generated={videoThumbnails.length ? 'native' : undefined}
      data-kg-video-sequence-media-thumbnail-image-format-preference={MEDIA_IMAGE_FORMAT_PREFERENCE_ATTR}
      data-kg-video-sequence-media-thumbnail-video-format-preference={MEDIA_VIDEO_FORMAT_PREFERENCE_ATTR}
      {...animationState.attributes}
    >
      <RichMediaPanel
        title={args.item.label}
        url={args.item.src}
        openUrl={args.item.openUrl}
        srcDoc={args.item.srcDoc}
        kind={args.item.kind}
        interactive
        videoControls={syncEnabled ? false : undefined}
        videoPoster={videoPoster}
        onMediaElement={args.item.kind === 'video' || args.item.kind === 'audio' ? handleVideoElement : undefined}
        onVideoElement={args.item.kind === 'video' ? handleVideoElement : undefined}
        panelChrome="storyboardWidget"
        scrollOwner="media"
        panel={panelState}
        style={{ height: '100%', visibility: playbackGap ? 'hidden' : undefined }}
      />
      {playbackGap ? (
        <section
          aria-hidden="true"
          className="absolute inset-0"
          data-kg-video-sequence-empty-playback-surface="1"
          style={{
            background: 'rgb(2, 6, 23)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </article>
  )
}
