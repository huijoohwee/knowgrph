import { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import {
  KG_CLASS_PREFIX,
  KG_PROP_PREFIX,
  KG_NODE_TYPE_CLASS,
  KG_EDGE_LABEL_CLASS,
  KG_PROPERTY_CLASS,
} from '@/lib/agenticrag'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function schemaToJsonLd(schema: GraphSchema): {
  '@context': Record<string, unknown>
  '@graph': Array<Record<string, unknown>>
  metadata?: Record<string, unknown>
} {
  const ctx: Record<string, unknown> = { kg: 'http://example.org/kg#' }
  const schemaContext = schema.serialization?.context
  if (schemaContext && typeof schemaContext === 'object' && !Array.isArray(schemaContext)) {
    Object.assign(ctx, schemaContext)
  }
  const graph: Array<Record<string, unknown>> = []
  const nodeTypes = Array.isArray(schema.catalog?.nodeTypes) ? schema.catalog?.nodeTypes : []
  const edgeLabels = Array.isArray(schema.catalog?.edgeLabels) ? schema.catalog?.edgeLabels : []
  nodeTypes.forEach((nt) => {
    graph.push({ '@id': `${KG_CLASS_PREFIX}${nt}`, '@type': KG_NODE_TYPE_CLASS, name: nt })
  })
  edgeLabels.forEach((el) => {
    graph.push({ '@id': `${KG_PROP_PREFIX}${el}`, '@type': KG_EDGE_LABEL_CLASS, name: el })
  })
  const nodeProps = schema.propertySchemas?.node || {}
  Object.keys(nodeProps).forEach((owner) => {
    const propsForOwner = nodeProps[owner] || {}
    Object.keys(propsForOwner).forEach((p) => {
      const spec = propsForOwner[p]
      graph.push({ '@id': `${KG_PROP_PREFIX}${p}`, '@type': KG_PROPERTY_CLASS, name: p, owner, range: spec.type })
    })
  })
  const edgeProps = schema.propertySchemas?.edge || {}
  Object.keys(edgeProps).forEach((owner) => {
    const propsForOwner = edgeProps[owner] || {}
    Object.keys(propsForOwner).forEach((p) => {
      const spec = propsForOwner[p]
      graph.push({ '@id': `${KG_PROP_PREFIX}${p}`, '@type': KG_PROPERTY_CLASS, name: p, owner, range: spec.type })
    })
  })
  const metadata = schema.metadata
  const doc: {
    '@context': Record<string, unknown>
    '@graph': Array<Record<string, unknown>>
    metadata?: Record<string, unknown>
  } = { '@context': ctx, '@graph': graph }
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata) && Object.keys(metadata).length > 0) {
    doc.metadata = metadata as unknown as Record<string, unknown>
  }
  return doc
}

const asPropType = (t: unknown): PropertySpec['type'] => {
  const s = String(t || '').trim()
  if (s === 'number' || s === 'boolean' || s === 'array' || s === 'object') return s
  return 'string'
}

export function schemaFromJsonLd(jsonld: unknown): GraphSchema {
  const root = isRecord(jsonld) ? jsonld : null
  const graphArray: unknown[] = (() => {
    if (Array.isArray(jsonld)) return jsonld
    if (isRecord(jsonld)) {
      const rawGraph = jsonld['@graph']
      if (Array.isArray(rawGraph)) return rawGraph
    }
    return []
  })()

  const base: GraphSchema = {
    nodeStyles: {},
    edgeStyles: {},
    metadata: {},
    labelStyles: {},
    behavior: { allowEdgeCreation: true, allowNodeDrag: true },
    layout: { forces: {} },
    endpointMatrix: {},
    cardinality: { nodeType: {}, edgeLabel: {} },
    templates: { node: {}, edge: {} },
    performance: { lod: {}, caps: {} },
    accessibility: {},
    legend: {},
    rules: [],
    nodeShapes: {},
    nodeSizes: {},
    nodeStroke: {},
    edgeRouting: { curvatureByLabel: {}, mode: 'straight' },
    catalog: { nodeTypes: [], edgeLabels: [] },
    propertySchemas: { node: {}, edge: {} },
    serialization: {},
  }

  const rawContext = root ? root['@context'] : null
  if (rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)) {
    base.serialization = { ...(base.serialization || {}), context: rawContext as unknown as Record<string, JSONValue> }
  }
  const rawMetadata = root ? root.metadata : null
  if (rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) {
    base.metadata = rawMetadata as unknown as Record<string, JSONValue>
  }

  const nodeSchemas = base.propertySchemas?.node || {}
  const edgeSchemas = base.propertySchemas?.edge || {}

  const nodeTypeOwners = new Set<string>()
  const edgeLabelOwners = new Set<string>()

  for (const raw of graphArray) {
    if (!isRecord(raw)) continue
    const name = String(raw.name ?? '').trim()
    if (!name) continue
    const typeTag = raw['@type']
    if (typeTag === 'kg:NodeType') {
      base.catalog?.nodeTypes.push(name)
      nodeTypeOwners.add(name)
      continue
    }
    if (typeTag === 'kg:EdgeLabel') {
      base.catalog?.edgeLabels.push(name)
      edgeLabelOwners.add(name)
      continue
    }
    if (typeTag === 'kg:Property') {
      const owner = String(raw.owner ?? '').trim()
      const range = asPropType(raw.range)
      if (!owner) continue
      const isNodeOwner = nodeTypeOwners.has(owner)
      const isEdgeOwner = edgeLabelOwners.has(owner)
      if (isNodeOwner) {
        if (!nodeSchemas[owner]) {
          nodeSchemas[owner] = {}
        }
        nodeSchemas[owner]![name] = { type: range }
        continue
      }
      if (isEdgeOwner) {
        if (!edgeSchemas[owner]) {
          edgeSchemas[owner] = {}
        }
        edgeSchemas[owner]![name] = { type: range }
        continue
      }
      if (!nodeSchemas[owner]) {
        nodeSchemas[owner] = {}
      }
      nodeSchemas[owner]![name] = { type: range }
    }
  }

  base.propertySchemas = {
    node: nodeSchemas,
    edge: edgeSchemas,
  }

  return base
}
