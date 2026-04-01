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

export const testGeoJsonImportWithForeignMembers = () => {
  const geoJsonText = JSON.stringify({
    type: 'FeatureCollection',
    metadata: { name: 'singapoly-like' },
    knowledgeGraph: { edges: [{ source: 1, target: 2, type: 'district' }] },
    features: [
      {
        type: 'Feature',
        id: 1,
        properties: { name: 'Point A' },
        geometry: { type: 'Point', coordinates: [103.81, 1.31] },
      },
      {
        type: 'Feature',
        id: 2,
        properties: { name: 'Point B' },
        geometry: { type: 'Point', coordinates: [103.91, 1.35] },
      },
    ],
  })

  const { data } = parseGraph('singapoly-like.json', geoJsonText)
  if (data.context !== 'geojson') {
    throw new Error(`Expected context=geojson for foreign-member FeatureCollection, got ${data.context}`)
  }
  if (!Array.isArray(data.nodes) || data.nodes.length !== 2) {
    throw new Error(`Expected 2 geojson nodes, got ${data.nodes?.length}`)
  }
  const hasGeo = data.nodes.every(node => {
    const props = (node.properties || {}) as Record<string, unknown>
    const geo = props.geo as Record<string, unknown> | undefined
    return !!geo && Number.isFinite(geo.lat as number) && Number.isFinite(geo.lng as number)
  })
  if (!hasGeo) throw new Error('Expected all nodes to include properties.geo.{lat,lng}')
}
