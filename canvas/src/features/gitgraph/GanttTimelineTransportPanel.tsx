import React from 'react'
import { GanttTimelineTransportSurface } from './GanttTimelineTransportSurface'
import { useGanttTimelineTransportRouteModel } from './useGanttTimelineTransportRouteModel'
import type { GanttTimelineTransportMode } from './ganttTimelineTransportMode'

export function GanttTimelineTransportPanel({
  code,
  compact,
  mode = 'media',
}: {
  code: string
  compact: boolean
  mode?: GanttTimelineTransportMode
}) {
  const transportRouteModel = useGanttTimelineTransportRouteModel({
    code,
    compact,
    mode,
  })
  return <GanttTimelineTransportSurface model={transportRouteModel.surfaceModel} />
}
