import React from 'react'
import { type TimelinePreviewFamilyDisclosureModel } from './useTimelinePreviewFamilyDisclosureModel'
import { type TimelinePreviewFamilySectionLayoutModel } from './useTimelinePreviewFamilySectionLayoutModel'

export type TimelinePreviewFamilySectionChromeToggleIcon = 'expand' | 'collapse'

export type TimelinePreviewFamilySectionChromeSection = {
  familyId: string
  header: {
    label: string
    visible: boolean
  }
  sectionAttributes: TimelinePreviewFamilySectionLayoutModel['sections'][number]['sectionAttributes']
  sectionLabel: string
  summary: {
    dataValue?: string
    label: string
    visible: boolean
  }
  toggle: {
    ariaExpanded: boolean
    handleToggle: () => void
    icon: TimelinePreviewFamilySectionChromeToggleIcon
    label: string
    mode: TimelinePreviewFamilySectionLayoutModel['sections'][number]['familySurface']['toggleMode']
    state: string
    title: string
    visible: boolean
  }
}

export type TimelinePreviewFamilySectionChromeModel = {
  listLabel: string
  sections: TimelinePreviewFamilySectionChromeSection[]
}

export function useTimelinePreviewFamilySectionChromeModel(args: {
  familyDisclosure: TimelinePreviewFamilyDisclosureModel
  familySectionLayout: TimelinePreviewFamilySectionLayoutModel
}): TimelinePreviewFamilySectionChromeModel {
  return React.useMemo(() => {
    const sections = args.familySectionLayout.sections.map((sectionLayout): TimelinePreviewFamilySectionChromeSection => ({
      familyId: sectionLayout.familySurface.familyId,
      header: {
        label: sectionLayout.familySurface.headerLabel,
        visible: sectionLayout.familySurface.headerVisible,
      },
      sectionAttributes: sectionLayout.sectionAttributes,
      sectionLabel: sectionLayout.sectionLabel,
      summary: {
        dataValue: sectionLayout.familySummaryVisible ? sectionLayout.familySummaryLabel : undefined,
        label: sectionLayout.familySummaryLabel,
        visible: sectionLayout.familySummaryVisible,
      },
      toggle: {
        ariaExpanded: sectionLayout.familySurface.family.expanded,
        handleToggle: () => args.familyDisclosure.toggleFamily(sectionLayout.familySurface.familyId),
        icon: sectionLayout.familySurface.toggleMode === 'collapse' ? 'collapse' : 'expand',
        label: sectionLayout.familySurface.toggleLabel,
        mode: sectionLayout.familySurface.toggleMode,
        state: sectionLayout.familySurface.family.disclosureState,
        title: sectionLayout.familySurface.toggleTitle,
        visible: sectionLayout.familySurface.toggleVisible,
      },
    }))
    return {
      listLabel: args.familySectionLayout.listLabel,
      sections,
    }
  }, [args.familyDisclosure, args.familySectionLayout])
}
