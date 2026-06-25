import { VideoSequenceTimelineRuler } from '@/components/timeline/VideoSequenceTimelineRuler'
import { type GanttTimelineTransportRulerModel } from './useGanttTimelineTransportRulerModel'

export type GanttTimelineTransportRulerProps = {
  model: GanttTimelineTransportRulerModel['ruler']
}

export function GanttTimelineTransportRuler(args: GanttTimelineTransportRulerProps) {
  return (
    <VideoSequenceTimelineRuler
      contentRef={args.model.contentRef}
      displayTicks={args.model.displayTicks}
      dragPreview={args.model.dragPreview}
      draggingRowKey={args.model.draggingRowKey}
      maxMinutes={args.model.maxMinutes}
      playheadPercent={args.model.playheadPercent}
      selectedRowKey={args.model.selectedRowKey}
      scopes={args.model.scopes}
      taskSpans={args.model.taskSpans}
      timelineZoom={args.model.timelineZoom}
      onRulerPointerDown={args.model.onRulerPointerDown}
      onSelectRowKey={args.model.onSelectRowKey}
      onTrackPointerStart={args.model.onTrackPointerStart}
    />
  )
}
