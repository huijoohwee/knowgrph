import React from 'react'
import { type TimelineSourceActivityMode } from './useTimelineSourceActivityModel'
import { type TimelinePreviewFamilyDisclosureModel } from './useTimelinePreviewFamilyDisclosureModel'
import { type TimelinePreviewFamilySectionLayoutModel } from './useTimelinePreviewFamilySectionLayoutModel'

export type TimelinePreviewSurfaceShellModel = {
  emptyLabel: string
  emptyMessage: string
  hasItems: boolean
  shellAttributes: {
    activeFamilyId?: string
    activityMode: TimelineSourceActivityMode
    collapsedFamilyCount: number
    count: number
    expandedFamilyCount: number
    groupCount: number
  }
  shellLabel: string
  summaryLabel: string
  titleLabel: string
}

export function useTimelinePreviewSurfaceShellModel(args: {
  activeFamilyId: string
  activityMode: TimelineSourceActivityMode
  familyDisclosure: TimelinePreviewFamilyDisclosureModel
  familySectionLayout: TimelinePreviewFamilySectionLayoutModel
}): TimelinePreviewSurfaceShellModel {
  return React.useMemo(() => {
    return {
      emptyLabel: args.familySectionLayout.emptyLabel,
      emptyMessage: args.familySectionLayout.emptyMessage,
      hasItems: args.familyDisclosure.items.length > 0,
      shellAttributes: {
        activeFamilyId: args.activeFamilyId || undefined,
        activityMode: args.activityMode,
        collapsedFamilyCount: args.familyDisclosure.collapsedFamilyCount,
        count: args.familyDisclosure.count,
        expandedFamilyCount: args.familyDisclosure.expandedFamilyCount,
        groupCount: args.familySectionLayout.sections.length,
      },
      shellLabel: 'Media canvas',
      summaryLabel: args.familySectionLayout.summaryLabel,
      titleLabel: 'Media',
    }
  }, [args.activeFamilyId, args.activityMode, args.familyDisclosure, args.familySectionLayout])
}
