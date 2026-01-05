import { GraphSchema, PropertySpec } from '@/lib/graph/schema'

function v(x: string | number | undefined): string {
  const s = String(x ?? '')
  return '"' + s.replace(/"/g, '""') + '"'
}

export function exportSchemaAsCSV(schema: GraphSchema): string {
  const header = 'row_type,name,owner,type\n'
  const rows: string[] = []
  const nodeTypes = schema.catalog?.nodeTypes || []
  const edgeLabels = schema.catalog?.edgeLabels || []
  nodeTypes.forEach(nt => rows.push([v('node_type'), v(nt), v(''), v('')].join(',')))
  edgeLabels.forEach(el => rows.push([v('edge_label'), v(el), v(''), v('')].join(',')))
  const nodeProps = schema.propertySchemas?.node || {}
  Object.keys(nodeProps).forEach(owner => {
    Object.keys(nodeProps[owner] || {}).forEach(p => {
      const spec = nodeProps[owner][p]
      rows.push([v('property_node'), v(p), v(owner), v(spec.type)].join(','))
    })
  })
  const edgeProps = schema.propertySchemas?.edge || {}
  Object.keys(edgeProps).forEach(owner => {
    Object.keys(edgeProps[owner] || {}).forEach(p => {
      const spec = edgeProps[owner][p]
      rows.push([v('property_edge'), v(p), v(owner), v(spec.type)].join(','))
    })
  })
  return header + rows.join('\n') + '\n'
}

const asPropType = (t: string): PropertySpec['type'] => {
  const s = (t || '').trim()
  if (s === 'number' || s === 'boolean' || s === 'array' || s === 'object') return s
  return 'string'
}

export function loadSchemaFromCSV(text: string): GraphSchema {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  const base: GraphSchema = {
    nodeStyles: {}, edgeStyles: {}, labelStyles: {}, behavior: { allowEdgeCreation: true, allowNodeDrag: true },
    layout: { forces: {} }, endpointMatrix: {}, cardinality: { nodeType: {}, edgeLabel: {} }, templates: { node: {}, edge: {} },
    performance: { lod: {}, caps: {} }, accessibility: {}, legend: {}, rules: [], nodeShapes: {}, nodeSizes: {}, nodeStroke: {}, edgeRouting: { curvatureByLabel: {}, mode: 'straight' },
    catalog: { nodeTypes: [], edgeLabels: [] }, propertySchemas: { node: {}, edge: {} }, serialization: {}
  }
  if (!lines.length) return base
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const idxRow = header.indexOf('row_type')
  const idxName = header.indexOf('name')
  const idxOwner = header.indexOf('owner')
  const idxType = header.indexOf('type')
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const rt = (cols[idxRow] || '').replace(/^"|"$/g, '')
    const name = (cols[idxName] || '').replace(/^"|"$/g, '')
    const owner = (cols[idxOwner] || '').replace(/^"|"$/g, '')
    const type = (cols[idxType] || '').replace(/^"|"$/g, '')
    if (!name) continue
    if (rt === 'node_type') base.catalog!.nodeTypes.push(name)
    else if (rt === 'edge_label') base.catalog!.edgeLabels.push(name)
    else if (rt === 'property_node') {
      const cur = base.propertySchemas!.node![owner] || {}
      cur[name] = { type: asPropType(type) }
      base.propertySchemas!.node![owner] = cur
    } else if (rt === 'property_edge') {
      const cur = base.propertySchemas!.edge![owner] || {}
      cur[name] = { type: asPropType(type) }
      base.propertySchemas!.edge![owner] = cur
    }
  }
  return base
}
