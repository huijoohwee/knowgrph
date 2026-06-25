import React from 'react'
import {
  type TimelinePreviewFamilyCompactionFamily,
  type TimelinePreviewFamilyCompactionItem,
  type TimelinePreviewFamilyCompactionModel,
} from './useTimelinePreviewFamilyCompactionModel'
import { type TimelinePreviewFamilyDisclosureController } from './useTimelinePreviewFamilyDisclosureController'

export type TimelinePreviewFamilyDisclosureState = 'static' | 'collapsed' | 'expanded'

export type TimelinePreviewFamilyDisclosureItem = TimelinePreviewFamilyCompactionItem & {
  familyDisclosureState: TimelinePreviewFamilyDisclosureState
  familyExpanded: boolean
  familyExpandable: boolean
}

export type TimelinePreviewFamilyDisclosureFamily = Omit<TimelinePreviewFamilyCompactionFamily, 'allItems' | 'items'> & {
  allItems: TimelinePreviewFamilyDisclosureItem[]
  expanded: boolean
  expandable: boolean
  items: TimelinePreviewFamilyDisclosureItem[]
  disclosureState: TimelinePreviewFamilyDisclosureState
}

export type TimelinePreviewFamilyDisclosureModel = {
  collapsedFamilyCount: number
  count: number
  expandedFamilyCount: number
  families: TimelinePreviewFamilyDisclosureFamily[]
  items: TimelinePreviewFamilyDisclosureItem[]
  toggleFamily: (familyId: string) => void
}

function resolveTimelinePreviewFamilyDisclosureState(args: {
  collapsed: boolean
  expanded: boolean
}): TimelinePreviewFamilyDisclosureState {
  if (!args.collapsed) return 'static'
  return args.expanded ? 'expanded' : 'collapsed'
}

function buildTimelinePreviewFamilyDisclosureItem(args: {
  disclosureState: TimelinePreviewFamilyDisclosureState
  expanded: boolean
  expandable: boolean
  item: TimelinePreviewFamilyCompactionItem
}): TimelinePreviewFamilyDisclosureItem {
  return {
    ...args.item,
    familyCollapsed: args.disclosureState === 'collapsed',
    familyDisclosureState: args.disclosureState,
    familyExpanded: args.expanded,
    familyExpandable: args.expandable,
  }
}

export function useTimelinePreviewFamilyDisclosureModel(args: {
  controller: TimelinePreviewFamilyDisclosureController
  familyCompaction: TimelinePreviewFamilyCompactionModel
}): TimelinePreviewFamilyDisclosureModel {
  return React.useMemo(() => {
    const families = args.familyCompaction.families.map(family => {
      const expandable = family.collapsed && family.hiddenItemCount > 0
      const expanded = expandable && args.controller.expandedFamilyIds.has(family.familyId)
      const disclosureState = resolveTimelinePreviewFamilyDisclosureState({
        collapsed: family.collapsed,
        expanded,
      })
      const allItems = family.allItems.map(item => buildTimelinePreviewFamilyDisclosureItem({
        disclosureState,
        expanded,
        expandable,
        item,
      }))
      const items = (expanded ? allItems : family.items).map(item => buildTimelinePreviewFamilyDisclosureItem({
        disclosureState,
        expanded,
        expandable,
        item,
      }))
      return {
        ...family,
        allItems,
        disclosureState,
        expanded,
        expandable,
        items,
      } satisfies TimelinePreviewFamilyDisclosureFamily
    })
    return {
      collapsedFamilyCount: families.filter(family => family.disclosureState === 'collapsed').length,
      count: families.reduce((total, family) => total + family.items.length, 0),
      expandedFamilyCount: families.filter(family => family.expanded).length,
      families,
      items: families.flatMap(family => family.items),
      toggleFamily: args.controller.toggleFamily,
    }
  }, [args.controller, args.familyCompaction])
}
