import React from 'react'
import { type TimelinePreviewFamilySectionsModel } from './useTimelinePreviewFamilySectionsModel'
import { type TimelinePreviewSurfaceShellModel } from './useTimelinePreviewSurfaceShellModel'

export type TimelinePreviewMediaCanvasRenderModel = {
  contentMode: 'empty' | 'sections'
  emptyState: {
    label: string
    message: string
  }
  header: {
    summaryLabel: string
    titleLabel: string
  }
  hostAttributes: {
    activityMode: TimelinePreviewSurfaceShellModel['shellAttributes']['activityMode']
    activeFamily?: string
    collapsedFamilyCount: number
    count: number
    expandedFamilyCount: number
    groupCount: number
  }
  listLabel: string
  sections: TimelinePreviewFamilySectionsModel['sections']
  shellLabel: string
}

export function useTimelinePreviewMediaCanvasRenderModel(args: {
  familySections: TimelinePreviewFamilySectionsModel
  surfaceShell: TimelinePreviewSurfaceShellModel
}): TimelinePreviewMediaCanvasRenderModel {
  return React.useMemo(() => ({
    contentMode: args.surfaceShell.hasItems ? 'sections' : 'empty',
    emptyState: {
      label: args.surfaceShell.emptyLabel,
      message: args.surfaceShell.emptyMessage,
    },
    header: {
      summaryLabel: args.surfaceShell.summaryLabel,
      titleLabel: args.surfaceShell.titleLabel,
    },
    hostAttributes: {
      activityMode: args.surfaceShell.shellAttributes.activityMode,
      activeFamily: args.surfaceShell.shellAttributes.activeFamilyId,
      collapsedFamilyCount: args.surfaceShell.shellAttributes.collapsedFamilyCount,
      count: args.surfaceShell.shellAttributes.count,
      expandedFamilyCount: args.surfaceShell.shellAttributes.expandedFamilyCount,
      groupCount: args.surfaceShell.shellAttributes.groupCount,
    },
    listLabel: args.familySections.listLabel,
    sections: args.familySections.sections,
    shellLabel: args.surfaceShell.shellLabel,
  }), [args.familySections, args.surfaceShell])
}
