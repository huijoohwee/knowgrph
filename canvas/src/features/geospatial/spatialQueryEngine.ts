import type { FeatureCollection, Point } from 'geojson'
import type { GeoEntityDistance, LngLat } from '@/features/geospatial/types'
import type { MapEntityFeatureProperties } from '@/features/geospatial/mapLibreAdapter'

export async function proximitySearchFromFeatures(args: {
  center: LngLat
  radiusKm: number
  features: FeatureCollection<Point, MapEntityFeatureProperties>
  limit: number
}): Promise<GeoEntityDistance[]> {
  const radiusKm = Number.isFinite(args.radiusKm) ? Math.max(0, args.radiusKm) : 0
  const limit = Number.isFinite(args.limit) ? Math.max(0, Math.floor(args.limit)) : 0
  if (radiusKm <= 0 || limit <= 0) return []

  const { default: turfDistance } = await import('@turf/distance')
  const { point } = await import('@turf/helpers')

  const centerPt = point(args.center)
  const matches: GeoEntityDistance[] = []

  for (const feature of args.features.features) {
    const coords = feature.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    const lng = coords[0]
    const lat = coords[1]
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    const d = turfDistance(centerPt, point([lng, lat]), { units: 'kilometers' })
    if (!Number.isFinite(d)) continue
    if (d <= radiusKm) {
      matches.push({ id: feature.properties.entityId, distanceKm: d })
    }
  }

  matches.sort((a, b) => a.distanceKm - b.distanceKm)
  if (matches.length > limit) matches.length = limit
  return matches
}

