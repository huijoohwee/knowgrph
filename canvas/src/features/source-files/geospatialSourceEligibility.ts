export type GeospatialSourceFileLike = {
  enabled?: unknown
  geoLayerEnabled?: unknown
}

export const isGeospatialSourceFileEligible = (file: GeospatialSourceFileLike | null | undefined): boolean => {
  if (!file || file.enabled !== true) return false
  if (typeof file.geoLayerEnabled === 'boolean' && file.geoLayerEnabled !== true) return false
  return true
}
