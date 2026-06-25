import { type ReactNode } from 'react'
import { TimelinePreviewMediaCanvasRender } from './TimelinePreviewMediaCanvasRender'
import { type TimelinePreviewMediaCanvasFrameModel } from './useTimelinePreviewMediaCanvasFrameModel'

export type TimelinePreviewMediaCanvasFrameProps = {
  className?: string
  model: TimelinePreviewMediaCanvasFrameModel
}

export function TimelinePreviewMediaCanvasFrame(args: TimelinePreviewMediaCanvasFrameProps) {
  return (
    <section
      className={args.className}
      aria-label={args.model.shellLabel}
      data-kg-media-canvas="1"
      data-kg-media-canvas-activity-mode={args.model.hostAttributes.activityMode}
      data-kg-media-canvas-active-family={args.model.hostAttributes.activeFamily}
      data-kg-media-canvas-collapsed-family-count={args.model.hostAttributes.collapsedFamilyCount}
      data-kg-media-canvas-count={args.model.hostAttributes.count}
      data-kg-media-canvas-expanded-family-count={args.model.hostAttributes.expandedFamilyCount}
      data-kg-media-canvas-group-count={args.model.hostAttributes.groupCount}
    >
      <TimelinePreviewMediaCanvasRender model={args.model.renderModel} />
    </section>
  )
}
