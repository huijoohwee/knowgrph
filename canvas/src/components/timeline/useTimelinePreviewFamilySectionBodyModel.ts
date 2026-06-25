import React from 'react'
import { type TimelinePreviewSurfaceProps } from './TimelinePreviewSurface'
import { type VideoSequenceExportPlan } from './videoSequenceExport'
import { type TimelinePreviewFamilySectionLayoutModel } from './useTimelinePreviewFamilySectionLayoutModel'

export type TimelinePreviewFamilySectionBodySurface = {
  props: TimelinePreviewSurfaceProps
  renderKey: string
}

export type TimelinePreviewFamilySectionBodySection = {
  cardsLabel: string
  familyId: string
  surfaces: TimelinePreviewFamilySectionBodySurface[]
}

export type TimelinePreviewFamilySectionBodyModel = {
  sections: TimelinePreviewFamilySectionBodySection[]
}

export function useTimelinePreviewFamilySectionBodyModel(args: {
  documentKey: string
  exportPlan: VideoSequenceExportPlan | null
  familySectionLayout: TimelinePreviewFamilySectionLayoutModel
  sequenceMaxMinutes: number
}): TimelinePreviewFamilySectionBodyModel {
  return React.useMemo(() => {
    const sections = args.familySectionLayout.sections.map(sectionLayout => ({
      cardsLabel: sectionLayout.cardsLabel,
      familyId: sectionLayout.familySurface.familyId,
      surfaces: sectionLayout.familySurface.items.map(activity => ({
        props: {
          activity,
          documentKey: args.documentKey,
          exportPlan: args.exportPlan,
          item: activity.item,
          sequenceMaxMinutes: args.sequenceMaxMinutes,
        },
        renderKey: activity.itemKey,
      })),
    }))
    return { sections }
  }, [args.documentKey, args.exportPlan, args.familySectionLayout, args.sequenceMaxMinutes])
}
