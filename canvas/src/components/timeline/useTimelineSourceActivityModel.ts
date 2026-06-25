import React from 'react'
import { type VideoSequenceExportSegment, areVideoSequenceExportSourcesEqual } from './videoSequenceExport'
import { resolveTimelinePlanSegmentAtPosition, type VideoSequenceExportPlan } from './timelinePlanSync'
import { type VideoSequenceTimelineSource } from './videoSequenceTimeline'
import { type TimelinePreviewCollection } from './useTimelinePreviewCollection'
import { type TimelinePreviewSurfaceFamily, type TimelinePreviewSurfaceModel } from './useTimelinePreviewSurfaceModel'

export type TimelineSourceActivityMode = 'selection' | 'playhead' | 'fallback'

export type TimelinePreviewFamilyActivity = {
  active: boolean
  containsPlayhead: boolean
  family: TimelinePreviewSurfaceFamily
  familyId: string
  matchesSelection: boolean
}

export type TimelineSourceActivityModel = {
  activeFamily: TimelinePreviewSurfaceFamily | null
  activeFamilyId: string
  activeSegment: VideoSequenceExportSegment | null
  activeSource: VideoSequenceTimelineSource | null
  activityMode: TimelineSourceActivityMode
  familyActivity: TimelinePreviewFamilyActivity[]
  playheadSegment: VideoSequenceExportSegment | null
  selectedSegment: VideoSequenceExportSegment | null
  selectionActive: boolean
}

function resolveTimelinePreviewFamilyForSource(args: {
  source: VideoSequenceTimelineSource | null
  surfaceModel: TimelinePreviewSurfaceModel
}): TimelinePreviewSurfaceFamily | null {
  if (!args.source) return null
  return args.surfaceModel.groups.find(group =>
    group.items.some(item => item.videoSequenceSource && areVideoSequenceExportSourcesEqual(item.videoSequenceSource, args.source)),
  ) || null
}

function resolveTimelineSourceActivityPlan(collection: TimelinePreviewCollection): VideoSequenceExportPlan | null {
  return collection.exportPlan || collection.previewPlan || null
}

export function useTimelineSourceActivityModel(args: {
  collection: TimelinePreviewCollection
  positionMinutes: number
  selectedRowKey?: string | null
  surfaceModel: TimelinePreviewSurfaceModel
}): TimelineSourceActivityModel {
  return React.useMemo(() => {
    const selectionActive = typeof args.selectedRowKey === 'string' && args.selectedRowKey.trim().length > 0
    const selectedSegment = args.collection.previewPlan?.segments[0] || null
    const playheadSegment = resolveTimelinePlanSegmentAtPosition({
      plan: resolveTimelineSourceActivityPlan(args.collection),
      positionMinutes: args.positionMinutes,
    })?.segment || null
    const selectedFamily = resolveTimelinePreviewFamilyForSource({
      source: selectedSegment?.source || null,
      surfaceModel: args.surfaceModel,
    })
    const playheadFamily = resolveTimelinePreviewFamilyForSource({
      source: playheadSegment?.source || null,
      surfaceModel: args.surfaceModel,
    })
    const activeFamily = selectedFamily || playheadFamily || args.surfaceModel.groups[0] || null
    const activeSegment = selectedSegment || playheadSegment || null
    const activeSource = activeSegment?.source || activeFamily?.primaryItem.videoSequenceSource || null
    const activityMode: TimelineSourceActivityMode = selectedFamily
      ? 'selection'
      : playheadFamily
        ? 'playhead'
        : 'fallback'
    return {
      activeFamily,
      activeFamilyId: activeFamily?.familyId || '',
      activeSegment,
      activeSource,
      activityMode,
      familyActivity: args.surfaceModel.groups.map(family => ({
        active: family.familyId === activeFamily?.familyId,
        containsPlayhead: family.familyId === playheadFamily?.familyId,
        family,
        familyId: family.familyId,
        matchesSelection: family.familyId === selectedFamily?.familyId,
      })),
      playheadSegment,
      selectedSegment,
      selectionActive,
    }
  }, [args.collection, args.positionMinutes, args.selectedRowKey, args.surfaceModel])
}
