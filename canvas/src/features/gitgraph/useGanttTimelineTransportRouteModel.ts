import {
  useGanttTimelineTransportSurfaceModel,
  type GanttTimelineTransportSurfaceModel,
} from './useGanttTimelineTransportSurfaceModel'

export type GanttTimelineTransportRouteModel = {
  surfaceModel: GanttTimelineTransportSurfaceModel
}

export function useGanttTimelineTransportRouteModel(args: {
  code: string
  compact: boolean
}): GanttTimelineTransportRouteModel {
  const transportSurfaceModel = useGanttTimelineTransportSurfaceModel({
    code: args.code,
    compact: args.compact,
  })

  return {
    surfaceModel: transportSurfaceModel,
  }
}
