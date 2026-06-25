import React from 'react'
import {
  type TimelinePreviewActivitySurfaceFamily,
  type TimelinePreviewActivitySurfaceItem,
  type TimelinePreviewActivitySurfaceModel,
} from './useTimelinePreviewActivitySurfaceModel'
import { type TimelinePreviewSurfaceIntent } from './useTimelinePreviewSurfaceModel'

export type TimelinePreviewFamilyCompactionItem = TimelinePreviewActivitySurfaceItem & {
  familyCollapsed: boolean
  familyHiddenItemCount: number
  familyItemCount: number
  familyLabel: string
  familyRepresentative: boolean
}

export type TimelinePreviewFamilyCompactionFamily = Omit<TimelinePreviewActivitySurfaceFamily, 'items'> & {
  allItems: TimelinePreviewFamilyCompactionItem[]
  collapsed: boolean
  hiddenItemCount: number
  items: TimelinePreviewFamilyCompactionItem[]
  visibleCount: number
}

export type TimelinePreviewFamilyCompactionModel = {
  collapsedFamilyCount: number
  count: number
  families: TimelinePreviewFamilyCompactionFamily[]
  items: TimelinePreviewFamilyCompactionItem[]
}

function shouldCollapseTimelinePreviewFamily(args: {
  family: TimelinePreviewActivitySurfaceFamily
  intent: TimelinePreviewSurfaceIntent
}): boolean {
  if (args.intent !== 'media') return false
  if (args.family.items.length <= 1) return false
  return !args.family.active && !args.family.containsPlayhead && !args.family.matchesSelection
}

function readTimelinePreviewFamilyPriority(family: TimelinePreviewActivitySurfaceFamily, index: number): number {
  return (
    (family.active ? 400 : 0)
    + (family.matchesSelection ? 200 : 0)
    + (family.containsPlayhead ? 100 : 0)
    - index
  )
}

export function useTimelinePreviewFamilyCompactionModel(args: {
  activitySurface: TimelinePreviewActivitySurfaceModel
  intent: TimelinePreviewSurfaceIntent
}): TimelinePreviewFamilyCompactionModel {
  return React.useMemo(() => {
    const families = args.activitySurface.families
      .map((family, index) => ({ family, index }))
      .sort((left, right) => readTimelinePreviewFamilyPriority(right.family, right.index) - readTimelinePreviewFamilyPriority(left.family, left.index))
      .map(({ family }) => {
        const collapsed = shouldCollapseTimelinePreviewFamily({
          family,
          intent: args.intent,
        })
        const allItems = family.items.map((item, itemIndex) => ({
          ...item,
          familyCollapsed: collapsed,
          familyHiddenItemCount: Math.max(0, family.items.length - (collapsed ? 1 : family.items.length)),
          familyItemCount: family.items.length,
          familyLabel: family.family.label,
          familyRepresentative: itemIndex === 0,
        }))
        const visibleFamilyItems = collapsed ? allItems.slice(0, 1) : allItems
        const hiddenItemCount = Math.max(0, allItems.length - visibleFamilyItems.length)
        return {
          ...family,
          allItems,
          collapsed,
          hiddenItemCount,
          items: visibleFamilyItems.map(item => ({
            ...item,
            familyHiddenItemCount: hiddenItemCount,
          })),
          visibleCount: visibleFamilyItems.length,
        } satisfies TimelinePreviewFamilyCompactionFamily
      })
    return {
      collapsedFamilyCount: families.filter(family => family.collapsed).length,
      count: families.reduce((total, family) => total + family.items.length, 0),
      families,
      items: families.flatMap(family => family.items),
    }
  }, [args.activitySurface, args.intent])
}
