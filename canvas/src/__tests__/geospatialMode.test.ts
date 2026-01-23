import { transformGraphNodesToGeoJson } from '@/features/geospatial/mapLibreAdapter'
import { proximitySearchFromFeatures } from '@/features/geospatial/spatialQueryEngine'
import type { GraphNode } from '@/lib/graph/types'

export const testGeospatialAdapterTransformsGeo = () => {
  const nodes: GraphNode[] = [
    {
      id: 'n1',
      label: 'A',
      type: 'Thing',
      properties: { geo: { lat: 52.517, lng: 13.388 } },
    },
    {
      id: 'n2',
      label: 'B',
      type: 'Thing',
      properties: { geo: { lat: -91, lng: 0 } },
    },
    {
      id: 'n3',
      label: 'C',
      type: 'Thing',
      properties: {},
    },
  ]
  const fc = transformGraphNodesToGeoJson(nodes)
  if (fc.type !== 'FeatureCollection') throw new Error('expected FeatureCollection')
  if (fc.features.length !== 1) throw new Error(`expected 1 feature, got ${fc.features.length}`)
  const f = fc.features[0]
  if (f.properties.entityId !== 'n1') throw new Error('entityId mismatch')
  if (f.geometry.type !== 'Point') throw new Error('geometry mismatch')
  if (f.geometry.coordinates[0] !== 13.388) throw new Error('lng mismatch')
  if (f.geometry.coordinates[1] !== 52.517) throw new Error('lat mismatch')
}

export const testGeospatialProximitySearchMatchesAndSorts = async () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', properties: { geo: { lat: 0, lng: 0 } } },
    { id: 'b', label: 'b', type: 'T', properties: { geo: { lat: 0, lng: 0.5 } } },
    { id: 'c', label: 'c', type: 'T', properties: { geo: { lat: 10, lng: 10 } } },
  ]
  const fc = transformGraphNodesToGeoJson(nodes)
  const res = await proximitySearchFromFeatures({
    center: [0, 0],
    radiusKm: 100,
    features: fc,
    limit: 10,
  })
  const ids = res.map(r => r.id)
  if (ids.length !== 2) throw new Error(`expected 2 matches, got ${ids.length}`)
  if (ids[0] !== 'a') throw new Error('expected closest match first')
  if (ids[1] !== 'b') throw new Error('expected second closest match second')
  if (!(res[0].distanceKm <= res[1].distanceKm)) throw new Error('expected ascending distance')
}
