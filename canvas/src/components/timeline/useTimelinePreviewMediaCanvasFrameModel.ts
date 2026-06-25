import React from 'react'
import { buildTimelineAnimationState, type TimelineAnimationState } from './timelineAnimationEngine'
import { type TimelinePreviewMediaCanvasRenderModel } from './useTimelinePreviewMediaCanvasRenderModel'

export type TimelinePreviewMediaCanvasFrameModel = {
  animationState: TimelineAnimationState
  hostAttributes: TimelinePreviewMediaCanvasRenderModel['hostAttributes']
  renderModel: TimelinePreviewMediaCanvasRenderModel
  shellLabel: string
}

export function useTimelinePreviewMediaCanvasFrameModel(args: {
  renderModel: TimelinePreviewMediaCanvasRenderModel
}): TimelinePreviewMediaCanvasFrameModel {
  return React.useMemo(() => ({
    animationState: buildTimelineAnimationState({
      active: args.renderModel.hostAttributes.count > 0,
      itemCount: args.renderModel.hostAttributes.count,
      progress: args.renderModel.hostAttributes.count > 0
        ? args.renderModel.hostAttributes.expandedFamilyCount / Math.max(1, args.renderModel.hostAttributes.groupCount)
        : 0,
      surface: 'media-canvas',
    }),
    hostAttributes: args.renderModel.hostAttributes,
    renderModel: args.renderModel,
    shellLabel: args.renderModel.shellLabel,
  }), [args.renderModel])
}
