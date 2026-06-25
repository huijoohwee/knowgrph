import React from 'react'
import {
  type TimelinePreviewFamilyDisclosureFamily,
  type TimelinePreviewFamilyDisclosureModel,
} from './useTimelinePreviewFamilyDisclosureModel'

export type TimelinePreviewFamilyDisclosureSurfaceTone = 'active' | 'muted' | 'neutral'
export type TimelinePreviewFamilyDisclosureSurfaceToggleMode = 'expand' | 'collapse' | 'none'

export type TimelinePreviewFamilyDisclosureSurfaceFamily = {
  autoOpen: boolean
  family: TimelinePreviewFamilyDisclosureFamily
  familyId: string
  headerLabel: string
  headerVisible: boolean
  items: TimelinePreviewFamilyDisclosureFamily['items']
  summaryLabel: string
  summaryVisible: boolean
  toggleLabel: string
  toggleMode: TimelinePreviewFamilyDisclosureSurfaceToggleMode
  toggleTitle: string
  toggleVisible: boolean
  tone: TimelinePreviewFamilyDisclosureSurfaceTone
}

export type TimelinePreviewFamilyDisclosureSurfaceModel = {
  count: number
  families: TimelinePreviewFamilyDisclosureSurfaceFamily[]
}

function resolveTimelinePreviewFamilyDisclosureSurfaceTone(
  family: TimelinePreviewFamilyDisclosureFamily,
): TimelinePreviewFamilyDisclosureSurfaceTone {
  if (family.active) return 'active'
  if (family.dimmed) return 'muted'
  return 'neutral'
}

function buildTimelinePreviewFamilyDisclosureSummaryLabel(
  family: TimelinePreviewFamilyDisclosureFamily,
): string {
  if (family.expanded) {
    return `${family.allItems.length} variants shown`
  }
  if (family.hiddenItemCount > 0) {
    return `${family.hiddenItemCount} hidden variant${family.hiddenItemCount === 1 ? '' : 's'}`
  }
  return ''
}

function buildTimelinePreviewFamilyDisclosureToggleLabel(
  family: TimelinePreviewFamilyDisclosureFamily,
): string {
  if (!family.expandable) return ''
  return family.expanded ? 'Hide variants' : `Show ${family.hiddenItemCount} more`
}

export function useTimelinePreviewFamilyDisclosureSurfaceModel(args: {
  familyDisclosure: TimelinePreviewFamilyDisclosureModel
}): TimelinePreviewFamilyDisclosureSurfaceModel {
  return React.useMemo(() => {
    const families = args.familyDisclosure.families.map(family => {
      const autoOpen = family.expanded && family.active && family.activityMode !== 'fallback'
      const toggleVisible = family.expandable
      const toggleMode: TimelinePreviewFamilyDisclosureSurfaceToggleMode = !toggleVisible
        ? 'none'
        : family.expanded
          ? 'collapse'
          : 'expand'
      const summaryLabel = buildTimelinePreviewFamilyDisclosureSummaryLabel(family)
      return {
        autoOpen,
        family,
        familyId: family.familyId,
        headerLabel: family.family.label,
        headerVisible: toggleVisible,
        items: family.items,
        summaryLabel,
        summaryVisible: summaryLabel.length > 0,
        toggleLabel: buildTimelinePreviewFamilyDisclosureToggleLabel(family),
        toggleMode,
        toggleTitle: autoOpen
          ? `${family.family.label} follows the active preview family`
          : buildTimelinePreviewFamilyDisclosureToggleLabel(family),
        toggleVisible,
        tone: resolveTimelinePreviewFamilyDisclosureSurfaceTone(family),
      } satisfies TimelinePreviewFamilyDisclosureSurfaceFamily
    })
    return {
      count: families.reduce((total, family) => total + family.items.length, 0),
      families,
    }
  }, [args.familyDisclosure])
}
