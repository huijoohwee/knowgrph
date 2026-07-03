import { VideoSequenceTimelineRuler } from '@/components/timeline/VideoSequenceTimelineRuler'
import { type GanttTimelineTransportRulerModel } from './useGanttTimelineTransportRulerModel'

export type GanttTimelineTransportRulerProps = {
  model: GanttTimelineTransportRulerModel['ruler']
}

export function GanttTimelineTransportRuler(args: GanttTimelineTransportRulerProps) {
  return (
    <VideoSequenceTimelineRuler
      contentRef={args.model.contentRef}
      disabledLaneIds={args.model.disabledLaneIds}
      displayTicks={args.model.displayTicks}
      dragPreview={args.model.dragPreview}
      draggingRowKey={args.model.draggingRowKey}
      maxMinutes={args.model.maxMinutes}
      mediaDurationSeconds={args.model.mediaDurationSeconds}
      mediaFrameRate={args.model.mediaFrameRate}
      playheadPercent={args.model.playheadPercent}
      selectedRowKey={args.model.selectedRowKey}
      scopes={args.model.scopes}
      sourceThumbnails={args.model.sourceThumbnails}
      sourceThumbnailWindows={args.model.sourceThumbnailWindows}
      taskSpans={args.model.taskSpans}
      timelineZoom={args.model.timelineZoom}
      onDropMedia={args.model.onDropMedia}
      onRulerPointerDown={args.model.onRulerPointerDown}
      onSelectRowKey={args.model.onSelectRowKey}
      onSelectRowPosition={args.model.onSelectRowPosition}
      onTrackPointerStart={args.model.onTrackPointerStart}
    />
  )
}
