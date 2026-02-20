import { parseGraph } from '@/lib/graph/io/adapter'

export const testGeoJsonImport = () => {
  const geoJsonText = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Test Point' },
        geometry: { type: 'Point', coordinates: [103.8, 1.3] },
      },
    ],
  })

  const { data } = parseGraph('test.geojson', geoJsonText)

  if (data.context !== 'geojson') {
    throw new Error(`Expected context=geojson, got ${data.context}`)
  }
  if (!data.nodes || data.nodes.length !== 1) {
    throw new Error(`Expected 1 node, got ${data.nodes?.length}`)
  }
  const n = data.nodes[0]
  const props = n.properties as Record<string, unknown>
  const geo = props.geo as { lat: number; lng: number } | undefined
  if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
    throw new Error('Node missing valid geo properties')
  }
  if (Math.abs(geo.lng - 103.8) > 0.0001 || Math.abs(geo.lat - 1.3) > 0.0001) {
    throw new Error(`Geo coordinates mismatch: ${JSON.stringify(geo)}`)
  }
}
