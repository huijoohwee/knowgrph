import { parseGraph } from '@/lib/graph/io/adapter'
import { arrayRecordsToGraphData } from '@/lib/graph/geo/arrayRecordsToGraph'
import { recordsToPointFeatureCollection } from '@/lib/geospatial/geojson'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGeospatialParseGeoJsonDerivesPointGeo() {
  const fc = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'p1',
        properties: { name: 'Point A' },
        geometry: { type: 'Point', coordinates: [13.388, 52.517] },
      },
      {
        type: 'Feature',
        id: 'poly1',
        properties: { name: 'Polygon B' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[13.0, 52.0], [13.5, 52.0], [13.5, 52.5], [13.0, 52.5], [13.0, 52.0]]],
        },
      },
    ],
  }
  const { data } = parseGraph('demo.geojson', JSON.stringify(fc))
  if (data.type !== 'Graph') throw new Error('expected GraphData')
  if (data.nodes.length !== 2) throw new Error(`expected 2 nodes, got ${data.nodes.length}`)
  const p = data.nodes.find(n => n.id === 'p1')
  if (!p) throw new Error('missing point node')
  const geoValue = (p.properties as Record<string, unknown>).geo as unknown
  if (!geoValue || typeof geoValue !== 'object' || Array.isArray(geoValue)) throw new Error('missing geo on point node')
  const geo = geoValue as Record<string, unknown>
  const lat = typeof geo.lat === 'number' ? geo.lat : null
  const lng = typeof geo.lng === 'number' ? geo.lng : null
  if (lat === null || lng === null) throw new Error('missing geo on point node')
  if (lat !== 52.517 || lng !== 13.388) throw new Error('geo lat/lng mismatch')
}

export function testGeospatialArrayRecordsDerivesGeo() {
  const raw = [
    { id: 'a', name: 'A', lat: '1.5', lng: 2.25 },
    { id: 'b', name: 'B', latitude: 10, longitude: 11 },
    { id: 'c', name: 'C' },
  ]
  const g = arrayRecordsToGraphData(raw)
  if (!g) throw new Error('expected GraphData')
  const a = g.nodes.find(n => n.id === 'a')
  if (!a) throw new Error('missing a')
  const geoAValue = (a.properties as Record<string, unknown>).geo as unknown
  if (!geoAValue || typeof geoAValue !== 'object' || Array.isArray(geoAValue)) throw new Error('missing/invalid geo on record a')
  const geoA = geoAValue as Record<string, unknown>
  const geoALat = typeof geoA.lat === 'number' ? geoA.lat : null
  const geoALng = typeof geoA.lng === 'number' ? geoA.lng : null
  if (geoALat !== 1.5 || geoALng !== 2.25) throw new Error('missing/invalid geo on record a')
  const b = g.nodes.find(n => n.id === 'b')
  if (!b) throw new Error('missing b')
  const geoBValue = (b.properties as Record<string, unknown>).geo as unknown
  if (!geoBValue || typeof geoBValue !== 'object' || Array.isArray(geoBValue)) throw new Error('missing/invalid geo on record b')
  const geoB = geoBValue as Record<string, unknown>
  const geoBLat = typeof geoB.lat === 'number' ? geoB.lat : null
  const geoBLng = typeof geoB.lng === 'number' ? geoB.lng : null
  if (geoBLat !== 10 || geoBLng !== 11) throw new Error('missing/invalid geo on record b')
}

export function testGeospatialRecordsToPointFeatureCollection() {
  const rawArray = [
    { id: 'a', name: 'A', lat: 1, lng: 2 },
    { id: 'b', name: 'B', latitude: 3, longitude: 4 },
    { id: 'c', name: 'C' },
  ]
  const fcArray = recordsToPointFeatureCollection(rawArray)
  if (!fcArray) throw new Error('expected FeatureCollection')
  if (fcArray.features.length !== 2) throw new Error(`expected 2 features, got ${fcArray.features.length}`)

  const airportsPath = resolve(process.cwd(), 'src/__tests__/demo/airports.sample.json')
  const airportsRaw = JSON.parse(readFileSync(airportsPath, 'utf8')) as unknown
  const fcObject = recordsToPointFeatureCollection(airportsRaw)
  if (!fcObject) throw new Error('expected FeatureCollection')
  if (fcObject.features.length !== 2) throw new Error(`expected 2 features, got ${fcObject.features.length}`)
}
