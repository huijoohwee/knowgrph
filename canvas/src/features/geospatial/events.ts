export const GEOSPATIAL_MODE_CHANGED_EVENT = 'kg:geospatialModeChanged' as const

export type GeospatialModeChangedDetail = {
  enabled?: boolean
}
