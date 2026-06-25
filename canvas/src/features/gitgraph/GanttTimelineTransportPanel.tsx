import React from 'react'
import { GanttTimelineTransportSurface } from './GanttTimelineTransportSurface'
import { useGanttTimelineTransportRouteModel } from './useGanttTimelineTransportRouteModel'

export function GanttTimelineTransportPanel({
  code,
  compact,
}: {
  code: string
  compact: boolean
}) {
  const transportRouteModel = useGanttTimelineTransportRouteModel({
    code,
    compact,
  })
  return <GanttTimelineTransportSurface model={transportRouteModel.surfaceModel} />
}
