import React from 'react'
import { GanttTimelineTransportAudioPlaybackBridge } from './GanttTimelineTransportAudioPlaybackBridge'
import { GanttTimelineTransportShell } from './GanttTimelineTransportShell'
import type { GanttTimelineTransportSurfaceModel } from './useGanttTimelineTransportSurfaceModel'

export type GanttTimelineTransportSurfaceProps = {
  model: GanttTimelineTransportSurfaceModel
  supplementalLanes?: React.ReactNode
  timeAxisControls?: React.ReactNode
}

export function GanttTimelineTransportSurface(args: GanttTimelineTransportSurfaceProps) {
  return (
    <>
      <GanttTimelineTransportShell
        chromeModel={args.model.chromeModel}
        mediaPlayerModel={args.model.mediaPlayerModel}
        rulerModel={args.model.rulerModel}
        shellModel={args.model.shellModel}
        supplementalLanes={args.supplementalLanes}
        timeAxisControls={args.timeAxisControls}
      />
      <GanttTimelineTransportAudioPlaybackBridge model={args.model.audioPlaybackBridgeModel} />
    </>
  )
}
