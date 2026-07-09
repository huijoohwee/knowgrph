import React from 'react'
import { GanttTimelineTransportSurface } from './GanttTimelineTransportSurface'
import { useGanttTimelineTransportRouteModel } from './useGanttTimelineTransportRouteModel'
import type { GanttTimelineTransportMode } from './ganttTimelineTransportMode'

export function GanttTimelineTransportPanel({
  code,
  compact,
  mode = 'media',
  onSelectedRowKeyChange,
}: {
  code: string
  compact: boolean
  mode?: GanttTimelineTransportMode
  onSelectedRowKeyChange?: (rowKey: string | null) => void
}) {
  const transportRouteModel = useGanttTimelineTransportRouteModel({
    code,
    compact,
    mode,
    onSelectedRowKeyChange,
  })
  return <GanttTimelineTransportSurface model={transportRouteModel.surfaceModel} />
}
