import React from 'react'
import { GanttTimelineTransportSurface } from './GanttTimelineTransportSurface'
import { useGanttTimelineTransportRouteModel } from './useGanttTimelineTransportRouteModel'
import type { GanttTimelineTransportMode } from './ganttTimelineTransportMode'

export function GanttTimelineTransportPanel({
  code,
  clockActive = false,
  compact,
  editable = true,
  mode = 'media',
  publishPlaybackRequest = true,
  runtimeDocumentKey = '',
  runtimeDurationSeconds = 0,
  runtimeFrameRate = 0,
  supplementalLanes,
  timeAxisControls,
  onSelectedRowKeyChange,
}: {
  code: string
  clockActive?: boolean
  compact: boolean
  editable?: boolean
  mode?: GanttTimelineTransportMode
  publishPlaybackRequest?: boolean
  runtimeDocumentKey?: string
  runtimeDurationSeconds?: number
  runtimeFrameRate?: number
  supplementalLanes?: React.ReactNode
  timeAxisControls?: React.ReactNode
  onSelectedRowKeyChange?: (rowKey: string | null) => void
}) {
  const transportRouteModel = useGanttTimelineTransportRouteModel({
    code,
    clockActive,
    compact,
    editable,
    mode,
    publishPlaybackRequest,
    runtimeDocumentKey,
    runtimeDurationSeconds,
    runtimeFrameRate,
    onSelectedRowKeyChange,
  })
  return <GanttTimelineTransportSurface model={transportRouteModel.surfaceModel} supplementalLanes={supplementalLanes} timeAxisControls={timeAxisControls} />
}
