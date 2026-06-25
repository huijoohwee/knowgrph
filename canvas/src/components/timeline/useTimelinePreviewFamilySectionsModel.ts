import React from 'react'
import { type TimelinePreviewFamilySectionBodyModel } from './useTimelinePreviewFamilySectionBodyModel'
import { type TimelinePreviewFamilySectionChromeModel } from './useTimelinePreviewFamilySectionChromeModel'

export type TimelinePreviewFamilySectionsSection = {
  cardsLabel: string
  familyId: string
  header: TimelinePreviewFamilySectionChromeModel['sections'][number]['header']
  sectionAttributes: TimelinePreviewFamilySectionChromeModel['sections'][number]['sectionAttributes']
  sectionLabel: string
  summary: TimelinePreviewFamilySectionChromeModel['sections'][number]['summary']
  surfaces: TimelinePreviewFamilySectionBodyModel['sections'][number]['surfaces']
  toggle: TimelinePreviewFamilySectionChromeModel['sections'][number]['toggle']
}

export type TimelinePreviewFamilySectionsModel = {
  listLabel: string
  sections: TimelinePreviewFamilySectionsSection[]
}

export function useTimelinePreviewFamilySectionsModel(args: {
  familySectionBody: TimelinePreviewFamilySectionBodyModel
  familySectionChrome: TimelinePreviewFamilySectionChromeModel
}): TimelinePreviewFamilySectionsModel {
  return React.useMemo(() => {
    const bodySectionByFamilyId = new Map(
      args.familySectionBody.sections.map(section => [section.familyId, section] as const),
    )
    const sections = args.familySectionChrome.sections.flatMap(sectionChrome => {
      const sectionBody = bodySectionByFamilyId.get(sectionChrome.familyId)
      if (!sectionBody) return []
      return [{
        cardsLabel: sectionBody.cardsLabel,
        familyId: sectionChrome.familyId,
        header: sectionChrome.header,
        sectionAttributes: sectionChrome.sectionAttributes,
        sectionLabel: sectionChrome.sectionLabel,
        summary: sectionChrome.summary,
        surfaces: sectionBody.surfaces,
        toggle: sectionChrome.toggle,
      }]
    })
    return {
      listLabel: args.familySectionChrome.listLabel,
      sections,
    }
  }, [args.familySectionBody, args.familySectionChrome])
}
