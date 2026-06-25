import React from 'react'
import { type TimelinePreviewMediaCanvasRenderModel } from './useTimelinePreviewMediaCanvasRenderModel'

export type TimelinePreviewMediaCanvasFrameModel = {
  hostAttributes: TimelinePreviewMediaCanvasRenderModel['hostAttributes']
  renderModel: TimelinePreviewMediaCanvasRenderModel
  shellLabel: string
}

export function useTimelinePreviewMediaCanvasFrameModel(args: {
  renderModel: TimelinePreviewMediaCanvasRenderModel
}): TimelinePreviewMediaCanvasFrameModel {
  return React.useMemo(() => ({
    hostAttributes: args.renderModel.hostAttributes,
    renderModel: args.renderModel,
    shellLabel: args.renderModel.shellLabel,
  }), [args.renderModel])
}
