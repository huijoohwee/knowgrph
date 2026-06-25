import React from 'react'
import { buildVideoSequenceTimelineScopes, type VideoSequenceTimelineScope } from './videoSequenceTimeline'
import { type TimelinePreviewMediaContext } from './useTimelinePreviewMediaContext'

export type TimelinePreviewScopeProjection = {
  monitorScopes: VideoSequenceTimelineScope[]
}

export function useTimelinePreviewScopeProjection(args: {
  maxMinutes: number
  mediaContext: TimelinePreviewMediaContext
  positionMinutes: number
  sourceCount?: number
  spanCount?: number
}): TimelinePreviewScopeProjection {
  return React.useMemo(() => {
    const sourceCount = Math.max(
      0,
      Number.isFinite(args.sourceCount)
        ? Number(args.sourceCount)
        : args.mediaContext.surfaceModel.groups.filter(group => group.source === 'video-sequence').length,
    )
    const spanCount = Math.max(
      0,
      Number.isFinite(args.spanCount)
        ? Number(args.spanCount)
        : args.mediaContext.surfaceModel.items.length,
    )
    return {
      monitorScopes: buildVideoSequenceTimelineScopes({
        activeFamilyId: args.mediaContext.activeFamilyId,
        activityMode: args.mediaContext.activityMode,
        maxMinutes: args.maxMinutes,
        positionMinutes: args.positionMinutes,
        selectionActive: args.mediaContext.selectionActive,
        sourceCount,
        spanCount,
      }),
    }
  }, [
    args.maxMinutes,
    args.mediaContext,
    args.positionMinutes,
    args.sourceCount,
    args.spanCount,
  ])
}
