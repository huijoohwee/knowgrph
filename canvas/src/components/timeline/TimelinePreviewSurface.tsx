import React from 'react'
import RichMediaPanel, { type RichMediaPanelProps } from '@/components/RichMediaPanel'
import { cn } from '@/lib/utils'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import { type VideoSequenceTimelineSource } from './videoSequenceTimeline'
import { type VideoSequenceExportPlan } from './videoSequenceExport'
import { useTimelinePreviewVideoBinding } from './useTimelinePreviewVideoBinding'
import { type TimelinePreviewFamilyDisclosureItem } from './useTimelinePreviewFamilyDisclosureModel'

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
  const { handleVideoElement, syncEnabled } = useTimelinePreviewVideoBinding({
    documentKey: args.documentKey,
    exportPlan: args.exportPlan,
    maxPosition: args.sequenceMaxMinutes,
    mediaKey: args.item.src,
    source: args.item.source === 'video-sequence' && args.item.kind === 'video'
      ? args.item.videoSequenceSource || null
      : null,
  })

  return (
    <article
      className={cn(
        'min-h-[18rem] overflow-hidden transition-opacity',
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
    >
      <RichMediaPanel
        title={args.item.label}
        url={args.item.src}
        openUrl={args.item.openUrl}
        srcDoc={args.item.srcDoc}
        kind={args.item.kind}
        interactive
        videoControls={syncEnabled ? false : undefined}
        onVideoElement={args.item.kind === 'video' ? handleVideoElement : undefined}
        panelChrome="flowEditor"
        scrollOwner="media"
        panel={panelState}
        style={{ height: '100%', minHeight: '18rem' }}
      />
    </article>
  )
}
