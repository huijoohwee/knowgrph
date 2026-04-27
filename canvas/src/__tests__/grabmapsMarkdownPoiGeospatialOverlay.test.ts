import { buildGeospatialOverlayGraphData } from '@/features/geospatial/geospatialOverlayGraphData'

export const testGrabMapsMarkdownPoiTablesProduceGeospatialOverlayNodes = () => {
  const markdownText = [
    '# GrabMaps Nearby Example',
    '',
    '| # | name | poi_id | street | postcode | location (lat,lng) | business_type |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| 1 | Lau Pa Sat | poi-1 | Raffles Quay | 048582 | 1.2801, 103.8502 | hawker |',
    '| 2 | Maxwell Food Centre | poi-2 | Kadayanallur St | 069184 | 1.2803, 103.8445 | hawker |',
    '',
  ].join('\n')

  const baseGraph = {
    type: 'Graph',
    context: 'workspace',
    metadata: { kind: 'workspace', source: 'workspace:test', graphId: 'workspace:workspace:test' },
    nodes: [],
    edges: [],
  }

  const overlay = buildGeospatialOverlayGraphData({
    graphData: baseGraph as any,
    markdownText,
    sourceDocumentPath: 'workspace:grabmaps-poi-geodata-table.md',
    sourceFiles: [],
  })

  const nodes = Array.isArray((overlay as any).nodes) ? ((overlay as any).nodes as any[]) : []
  if (nodes.length === 0) {
    const meta = ((overlay as any).metadata || {}) as any
    const debug = meta.kgGeospatialOverlayDebug
    throw new Error(`Expected GrabMaps markdown POI tables to produce overlay nodes, got 0 (debug=${JSON.stringify(debug)})`)
  }
  const nodesWithGeo = nodes.filter(n => {
    const props = (n?.properties || {}) as any
    const geo = props.geo as any
    const lat = Number(geo?.lat)
    const lng = Number(geo?.lng)
    return Number.isFinite(lat) && Number.isFinite(lng)
  })
  if (nodesWithGeo.length === 0) {
    throw new Error('Expected GrabMaps overlay nodes to carry properties.geo.{lat,lng}')
  }
  const nodesWithAdmin = nodesWithGeo.filter(n => {
    const props = (n?.properties || {}) as any
    const admin = props.admin as any
    return admin && admin.countryCode === 'SGP' && typeof admin.postalDistrict === 'string'
  })
  if (nodesWithAdmin.length === 0) {
    throw new Error('Expected at least one geospatial overlay node to include derived SGP admin fields')
  }
}
