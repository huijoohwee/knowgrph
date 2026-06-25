import React from 'react'
import {
  type TimelinePreviewFamilyDisclosureSurfaceFamily,
  type TimelinePreviewFamilyDisclosureSurfaceModel,
} from './useTimelinePreviewFamilyDisclosureSurfaceModel'

export type TimelinePreviewFamilySectionLayoutSection = {
  cardsLabel: string
  familySurface: TimelinePreviewFamilyDisclosureSurfaceFamily
  familySummaryLabel: string
  familySummaryVisible: boolean
  itemCount: number
  sectionAttributes: {
    activeFamilyId?: string
    autoOpen?: '1'
    disclosureState: string
    expandable?: '1'
    expanded?: '1'
    surfaceTone: string
  }
  sectionLabel: string
}

export type TimelinePreviewFamilySectionLayoutModel = {
  emptyLabel: string
  emptyMessage: string
  listLabel: string
  summaryLabel: string
  sections: TimelinePreviewFamilySectionLayoutSection[]
}

function buildTimelinePreviewFamilySectionSummaryLabel(count: number): string {
  return `${count} source${count === 1 ? '' : 's'}`
}

export function useTimelinePreviewFamilySectionLayoutModel(args: {
  familyDisclosureSurface: TimelinePreviewFamilyDisclosureSurfaceModel
}): TimelinePreviewFamilySectionLayoutModel {
  return React.useMemo(() => {
    const sections = args.familyDisclosureSurface.families.map((familySurface): TimelinePreviewFamilySectionLayoutSection => ({
      cardsLabel: `${familySurface.headerLabel} media cards`,
      familySurface,
      familySummaryLabel: familySurface.summaryLabel,
      familySummaryVisible: familySurface.summaryVisible,
      itemCount: familySurface.items.length,
      sectionAttributes: {
        activeFamilyId: familySurface.familyId || undefined,
        autoOpen: familySurface.autoOpen ? '1' : undefined,
        disclosureState: familySurface.family.disclosureState,
        expandable: familySurface.family.expandable ? '1' : undefined,
        expanded: familySurface.family.expanded ? '1' : undefined,
        surfaceTone: familySurface.tone,
      },
      sectionLabel: `${familySurface.headerLabel} media family`,
    }))
    return {
      emptyLabel: 'No media canvas sources',
      emptyMessage: 'No rich media sources found in the active document.',
      listLabel: 'Rich media canvas sources',
      summaryLabel: buildTimelinePreviewFamilySectionSummaryLabel(args.familyDisclosureSurface.count),
      sections,
    }
  }, [args.familyDisclosureSurface])
}
