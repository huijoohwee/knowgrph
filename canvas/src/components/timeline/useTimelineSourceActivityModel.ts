import React from 'react'
import { type VideoSequenceExportSegment, areVideoSequenceExportSourcesEqual } from './videoSequenceExport'
import { resolveTimelinePlanSegmentAtPosition, type VideoSequenceExportPlan } from './timelinePlanSync'
import { type VideoSequenceTimelineSource } from './videoSequenceTimeline'
import { type TimelinePreviewCollection } from './useTimelinePreviewCollection'
import { type TimelinePreviewSurfaceFamily, type TimelinePreviewSurfaceModel } from './useTimelinePreviewSurfaceModel'

export type TimelineSourceActivityMode = 'selection' | 'playhead' | 'fallback' | 'empty'

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

function resolveTimelineSourceActivityPlan(args: {
  collection: TimelinePreviewCollection
  selectionActive: boolean
}): VideoSequenceExportPlan | null {
  if (args.selectionActive) return args.collection.previewPlan || null
  return args.collection.previewPlan || args.collection.exportPlan || null
}

export function useTimelineSourceActivityModel(args: {
  collection: TimelinePreviewCollection
  positionMinutes: number
  selectedRowKey?: string | null
  surfaceModel: TimelinePreviewSurfaceModel
}): TimelineSourceActivityModel {
  return React.useMemo(() => {
    const selectionActive = typeof args.selectedRowKey === 'string' && args.selectedRowKey.trim().length > 0
    const activityPlan = resolveTimelineSourceActivityPlan({
      collection: args.collection,
      selectionActive,
    })
    const selectedSegmentResolution = selectionActive
      ? resolveTimelinePlanSegmentAtPosition({
        plan: args.collection.previewPlan,
        positionMinutes: args.positionMinutes,
      })
      : null
    const selectedSegment = selectedSegmentResolution?.contains ? selectedSegmentResolution.segment : null
    const playheadSegment = resolveTimelinePlanSegmentAtPosition({
      plan: activityPlan,
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
    const activeFamily = selectedFamily || playheadFamily || (selectionActive ? null : args.surfaceModel.groups[0] || null)
    const activeSegment = selectedSegment || playheadSegment || null
    const activeSource = activeSegment?.source || (selectionActive ? null : activeFamily?.primaryItem.videoSequenceSource || null)
    const activityMode: TimelineSourceActivityMode = selectedFamily
      ? 'selection'
      : playheadFamily
        ? 'playhead'
        : selectionActive
          ? 'empty'
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
