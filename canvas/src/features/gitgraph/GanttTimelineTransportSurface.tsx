import { GanttTimelineTransportAudioPlaybackBridge } from './GanttTimelineTransportAudioPlaybackBridge'
import { GanttTimelineTransportShell } from './GanttTimelineTransportShell'
import type { GanttTimelineTransportSurfaceModel } from './useGanttTimelineTransportSurfaceModel'

export type GanttTimelineTransportSurfaceProps = {
  model: GanttTimelineTransportSurfaceModel
}

export function GanttTimelineTransportSurface(args: GanttTimelineTransportSurfaceProps) {
  return (
    <>
      <GanttTimelineTransportShell
        chromeModel={args.model.chromeModel}
        rulerModel={args.model.rulerModel}
        shellModel={args.model.shellModel}
      />
      <GanttTimelineTransportAudioPlaybackBridge model={args.model.audioPlaybackBridgeModel} />
    </>
  )
}
