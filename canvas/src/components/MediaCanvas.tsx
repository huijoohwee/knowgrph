import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import { TimelinePreviewMediaCanvasFrame } from '@/components/timeline/TimelinePreviewMediaCanvasFrame'
import { useTimelinePreviewMediaCanvasBinding } from '@/components/timeline/useTimelinePreviewMediaCanvasBinding'

export default function MediaCanvas() {
  const mediaCanvasBinding = useTimelinePreviewMediaCanvasBinding()

  return (
    <TimelinePreviewMediaCanvasFrame
      className={`${CANVAS_SURFACE_CLASS} ${CANVAS_INTERACTIVE_CLASS} h-full min-h-0 w-full overflow-auto bg-[var(--kg-canvas-bg)] p-4 text-[var(--kg-text-primary)]`}
      model={mediaCanvasBinding.frameModel}
    />
  )
}
