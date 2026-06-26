import React from 'react'
import { type TimelinePreviewCollectionItem } from './useTimelinePreviewCollection'
import { type TimelinePreviewSurfaceFamily, type TimelinePreviewSurfaceModel } from './useTimelinePreviewSurfaceModel'
import { type TimelinePreviewFamilyActivity, type TimelineSourceActivityMode } from './useTimelineSourceActivityModel'

export type TimelinePreviewActivitySurfaceStyleMode = 'active' | 'dimmed' | 'idle'

export type TimelinePreviewActivitySurfaceItem = {
  active: boolean
  activityMode: TimelineSourceActivityMode
  containsPlayhead: boolean
  dimmed: boolean
  familyId: string
  item: TimelinePreviewCollectionItem
  itemKey: string
  matchesSelection: boolean
  styleMode: TimelinePreviewActivitySurfaceStyleMode
}

export type TimelinePreviewActivitySurfaceFamily = {
  active: boolean
  activityMode: TimelineSourceActivityMode
  containsPlayhead: boolean
  dimmed: boolean
  family: TimelinePreviewSurfaceFamily
  familyId: string
  items: TimelinePreviewActivitySurfaceItem[]
  matchesSelection: boolean
  styleMode: TimelinePreviewActivitySurfaceStyleMode
}

export type TimelinePreviewActivitySurfaceModel = {
  activityMode: TimelineSourceActivityMode
  count: number
  families: TimelinePreviewActivitySurfaceFamily[]
  items: TimelinePreviewActivitySurfaceItem[]
}

function resolveTimelinePreviewActivitySurfaceStyleMode(args: {
  active: boolean
  dimmed: boolean
}): TimelinePreviewActivitySurfaceStyleMode {
  if (args.active) return 'active'
  if (args.dimmed) return 'dimmed'
  return 'idle'
}

export function useTimelinePreviewActivitySurfaceModel(args: {
  activityMode: TimelineSourceActivityMode
  familyActivity: TimelinePreviewFamilyActivity[]
  surfaceModel: TimelinePreviewSurfaceModel
}): TimelinePreviewActivitySurfaceModel {
  return React.useMemo(() => {
    if (args.activityMode === 'empty') {
      return {
        activityMode: args.activityMode,
        count: 0,
        families: [],
        items: [],
      }
    }
    const familyActivityById = new Map(args.familyActivity.map(activity => [activity.familyId, activity]))
    const shouldDimInactive = args.activityMode === 'selection' || args.activityMode === 'playhead'
    const families = args.surfaceModel.groups.map(family => {
      const familyActivity = familyActivityById.get(family.familyId)
      const active = !!familyActivity?.active
      const containsPlayhead = !!familyActivity?.containsPlayhead
      const matchesSelection = !!familyActivity?.matchesSelection
      const dimmed = shouldDimInactive && !active
      const styleMode = resolveTimelinePreviewActivitySurfaceStyleMode({ active, dimmed })
      return {
        active,
        activityMode: args.activityMode,
        containsPlayhead,
        dimmed,
        family,
        familyId: family.familyId,
        items: family.visibleItems.map(item => ({
          active,
          activityMode: args.activityMode,
          containsPlayhead,
          dimmed,
          familyId: family.familyId,
          item,
          itemKey: item.key,
          matchesSelection,
          styleMode,
        })),
        matchesSelection,
        styleMode,
      } satisfies TimelinePreviewActivitySurfaceFamily
    })
    return {
      activityMode: args.activityMode,
      count: families.reduce((total, family) => total + family.items.length, 0),
      families,
      items: families.flatMap(family => family.items),
    }
  }, [args.activityMode, args.familyActivity, args.surfaceModel])
}
