import {
  useGanttTimelineTransportSurfaceModel,
  type GanttTimelineTransportSurfaceModel,
} from './useGanttTimelineTransportSurfaceModel'
import type { GanttTimelineTransportMode } from './ganttTimelineTransportMode'

export type GanttTimelineTransportRouteModel = {
  surfaceModel: GanttTimelineTransportSurfaceModel
}

export function useGanttTimelineTransportRouteModel(args: {
  code: string
  compact: boolean
  mode: GanttTimelineTransportMode
}): GanttTimelineTransportRouteModel {
  const transportSurfaceModel = useGanttTimelineTransportSurfaceModel({
    code: args.code,
    compact: args.compact,
    mode: args.mode,
  })

  return {
    surfaceModel: transportSurfaceModel,
  }
}
