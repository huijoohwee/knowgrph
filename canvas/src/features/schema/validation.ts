import { GraphData, GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'
import { GraphSchema, defaultSchema } from '@/lib/graph/schema'
import { parseSchemaFieldPortKey, readFlowEdgePortKey, readSchemaFieldSpecs } from '@/lib/graph/flowPorts'
import { resolveFlowSocketTypesForEdge } from '@/lib/graph/flowSocketTypes'

export type SchemaLintWarning = {
  path: string
  message: string
}

export const validateNodeProperties = (schema: GraphSchema, id: string, nextNode: GraphNode | null, data: GraphData) => {
  if (!nextNode) return true
  const rules = schema.validation?.node?.[nextNode.type] || undefined
  if (!rules) return true
  const props: Record<string, JSONValue> = { ...(nextNode.properties || {}) }
  const severity = rules.severity || 'error'
  const missing = (rules.required || []).filter(k => !(k in props))
  if (missing.length > 0 && severity === 'error') return false
  for (const [k, t] of Object.entries(rules.types || {})) {
    const val = props[k]
    const ok = (
      (t === 'string' && typeof val === 'string') ||
      (t === 'number' && typeof val === 'number') ||
      (t === 'boolean' && typeof val === 'boolean') ||
      (t === 'array' && Array.isArray(val)) ||
      (t === 'object' && val && typeof val === 'object' && !Array.isArray(val))
    )
    if (!ok && severity === 'error') return false
  }
  for (const [k, r] of Object.entries(rules.ranges || {})) {
    const v = props[k]
    if (typeof v === 'number') {
      const rr = r as { min?: number; max?: number }
      if (rr.min != null && v < rr.min && severity === 'error') return false
      if (rr.max != null && v > rr.max && severity === 'error') return false
    }
  }
  for (const [k, pat] of Object.entries(rules.patterns || {})) {
    const v = props[k]
    if (typeof v === 'string') {
      const re = new RegExp(String(pat))
      if (!re.test(v) && severity === 'error') return false
    }
  }
  for (const k of (rules.uniqueness || [])) {
    const v = props[k]
    const dup = data.nodes.some(n => {
      if (n.id === id || n.type !== nextNode!.type) return false
      const np = n.properties as Record<string, JSONValue>
      return np[k] === v
    })
    if (dup && severity === 'error') return false
  }
  return true
}

export const validateEdgeProperties = (schema: GraphSchema, id: string, nextEdge: GraphEdge | null) => {
  if (!nextEdge) return true
  const rules = schema.validation?.edge?.[nextEdge.label] || undefined
  if (!rules) return true
  const props: Record<string, JSONValue> = { ...(nextEdge.properties || {}) }
  const severity = rules.severity || 'error'
  const missing = (rules.required || []).filter(k => !(k in props))
  if (missing.length > 0 && severity === 'error') return false
  for (const [k, t] of Object.entries(rules.types || {})) {
    const val = props[k]
    const ok = (
      (t === 'string' && typeof val === 'string') ||
      (t === 'number' && typeof val === 'number') ||
      (t === 'boolean' && typeof val === 'boolean') ||
      (t === 'array' && Array.isArray(val)) ||
      (t === 'object' && val && typeof val === 'object' && !Array.isArray(val))
    )
    if (!ok && severity === 'error') return false
  }
  for (const [k, r] of Object.entries(rules.ranges || {})) {
    const v = props[k]
    if (typeof v === 'number') {
      const rr = r as { min?: number; max?: number }
      if (rr.min != null && v < rr.min && severity === 'error') return false
      if (rr.max != null && v > rr.max && severity === 'error') return false
    }
  }
  for (const [k, pat] of Object.entries(rules.patterns || {})) {
    const v = props[k]
    if (typeof v === 'string') {
      const re = new RegExp(String(pat))
      if (!re.test(v) && severity === 'error') return false
    }
  }
  return true
}

const canonicalizeSchemaFieldType = (raw: string | null | undefined): string => {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return ''
  if (s === 'int' || s === 'int4' || s === 'integer') return 'integer'
  if (s === 'bigint' || s === 'int8' || s === 'long') return 'bigint'
  if (s === 'float' || s === 'float4' || s === 'real') return 'real'
  if (s === 'double' || s === 'float8') return 'double'
  if (s === 'varchar' || s === 'character varying' || s === 'text' || s === 'string') return 'string'
  if (s === 'bool' || s === 'boolean') return 'boolean'
  return s
}

const validateSchemaPortKeysIfPresent = (edge: GraphEdge, srcNode: GraphNode, tgtNode: GraphNode): boolean => {
  const sourcePortKey = readFlowEdgePortKey(edge, 'source')
  const targetPortKey = readFlowEdgePortKey(edge, 'target')
  const srcFieldId = parseSchemaFieldPortKey(sourcePortKey)
  const tgtFieldId = parseSchemaFieldPortKey(targetPortKey)

  if (!srcFieldId && !tgtFieldId) return true

  const srcFields = readSchemaFieldSpecs(srcNode)
  const tgtFields = readSchemaFieldSpecs(tgtNode)
  const src = srcFieldId ? srcFields.find(f => f.id === srcFieldId) || null : null
  const tgt = tgtFieldId ? tgtFields.find(f => f.id === tgtFieldId) || null : null

  if (srcFieldId && !src) return false
  if (tgtFieldId && !tgt) return false

  if (src && tgt) {
    const st = canonicalizeSchemaFieldType(src.type)
    const tt = canonicalizeSchemaFieldType(tgt.type)
    if (st && tt && st !== tt) return false
  }

  return true
}

const validateTypedPortKeysIfPresent = (data: GraphData, edge: GraphEdge, srcNode: GraphNode, tgtNode: GraphNode): boolean => {
  const sourcePortKey = readFlowEdgePortKey(edge, 'source')
  const targetPortKey = readFlowEdgePortKey(edge, 'target')
  const res = resolveFlowSocketTypesForEdge({
    graphData: data,
    sourceNode: srcNode,
    targetNode: tgtNode,
    sourcePortKey,
    targetPortKey,
  })
  if (!res.outType || !res.inType) return true
  return res.ok
}

export const canAddEdge = (schema: GraphSchema, data: GraphData, edge: GraphEdge) => {
  const srcNode = data.nodes.find(n => n.id === String(edge.source))
  const tgtNode = data.nodes.find(n => n.id === String(edge.target))
  if (!srcNode || !tgtNode) return false
  if (!validateSchemaPortKeysIfPresent(edge, srcNode, tgtNode)) return false
  if (!validateTypedPortKeysIfPresent(data, edge, srcNode, tgtNode)) return false
  const em = schema.endpointMatrix?.[edge.label] || undefined
  if (em) {
    if (em.sources.length > 0 && !em.sources.includes(srcNode.type)) return false
    if (em.targets.length > 0 && !em.targets.includes(tgtNode.type)) return false
  }
  const cn = schema.cardinality?.nodeType || {}
  const countEdges = (id: string) => data.edges.filter(e => String(e.source) === id || String(e.target) === id).length
  if (srcNode) {
    const c = cn[srcNode.type]
    if (c && c.maxEdges != null && countEdges(srcNode.id) >= c.maxEdges) return false
  }
  if (tgtNode) {
    const c = cn[tgtNode.type]
    if (c && c.maxEdges != null && countEdges(tgtNode.id) >= c.maxEdges) return false
  }
  const ce = schema.cardinality?.edgeLabel?.[edge.label]
  if (ce && ce.maxPerNode != null) {
    const perSrc = data.edges.filter(e => String(e.source) === String(edge.source) && e.label === edge.label).length
    if (perSrc >= ce.maxPerNode) return false
  }
  return true
}

export const validateSchema = (s: Partial<GraphSchema>): GraphSchema => {
  const base = defaultSchema
  const next: GraphSchema = {
    ...base,
    ...s,
    metadata: { ...(base.metadata || {}), ...(s.metadata || {}) },
    nodeStyles: { ...(base.nodeStyles || {}), ...(s.nodeStyles || {}) },
    edgeStyles: { ...(base.edgeStyles || {}), ...(s.edgeStyles || {}) },
    nodeSizes: { ...(base.nodeSizes || {}), ...(s.nodeSizes || {}) },
    nodeStroke: { ...(base.nodeStroke || {}), ...(s.nodeStroke || {}) },
    labelStyles: { ...(base.labelStyles || {}), ...(s.labelStyles || {}), offset: { ...(base.labelStyles?.offset || {}), ...(s.labelStyles?.offset || {}) } },
    nodeShapes: { ...(base.nodeShapes || {}), ...(s.nodeShapes || {}) },
    edgeRouting: {
      ...(base.edgeRouting || {}),
      ...(s.edgeRouting || {}),
      curvatureByLabel: { ...(base.edgeRouting?.curvatureByLabel || {}), ...(s.edgeRouting?.curvatureByLabel || {}) },
    },
    rules: Array.isArray(s.rules) ? s.rules : (base.rules || []),
    validation: { ...(base.validation || {}), ...(s.validation || {}) } as GraphSchema['validation'],
    layout: {
      ...(base.layout || {}),
      ...(s.layout || {}),
      edges: {
        ...(base.layout?.edges || {}),
        ...(s.layout?.edges || {}),
      },
      flow: {
        ...((base.layout as NonNullable<GraphSchema['layout']>)?.flow || {}),
        ...((s.layout as Partial<NonNullable<GraphSchema['layout']>>)?.flow || {}),
      },
      forces: {
        ...(base.layout?.forces || {}),
        ...(s.layout?.forces || {}),
        linkDistanceByLabel: {
          ...(base.layout?.forces?.linkDistanceByLabel || {}),
          ...(s.layout?.forces?.linkDistanceByLabel || {}),
        },
        collisionByType: {
          ...(base.layout?.forces?.collisionByType || {}),
          ...(s.layout?.forces?.collisionByType || {}),
        },
      },
      groups: {
        ...(base.layout?.groups || {}),
        ...(s.layout?.groups || {}),
      },
      mermaid: {
        ...(base.layout?.mermaid || {}),
        ...(s.layout?.mermaid || {}),
        renderOrder: {
          ...(base.layout?.mermaid?.renderOrder || {}),
          ...(s.layout?.mermaid?.renderOrder || {}),
        },
      },
    },
    endpointMatrix: { ...(base.endpointMatrix || {}), ...(s.endpointMatrix || {}) },
    cardinality: { ...(base.cardinality || {}), ...(s.cardinality || {}) },
    templates: { ...(base.templates || {}), ...(s.templates || {}) },
    performance: {
      ...(base.performance || {}),
      ...(s.performance || {}),
      lod: { ...(base.performance?.lod || {}), ...(s.performance?.lod || {}) },
      caps: { ...(base.performance?.caps || {}), ...(s.performance?.caps || {}) },
    },
    accessibility: { ...(base.accessibility || {}), ...(s.accessibility || {}) },
    legend: { ...(base.legend || {}), ...(s.legend || {}) },
    behavior: { ...(base.behavior || {}), ...(s.behavior || {}) } as import('@/lib/graph/schema').GraphBehavior,
    serialization: {
      ...(base.serialization || {}),
      ...(s.serialization || {}),
      context: { ...(base.serialization?.context || {}), ...(s.serialization?.context || {}) },
    },
    catalog: { ...(base.catalog || {}), ...(s.catalog || {}) } as { nodeTypes: string[]; edgeLabels: string[] },
    propertySchemas: { ...(base.propertySchemas || {}), ...(s.propertySchemas || {}) },
    three: {
      ...(base.three || {}),
      ...(s.three || {}),
      edgeOpacityByLabel: { ...(base.three?.edgeOpacityByLabel || {}), ...(s.three?.edgeOpacityByLabel || {}) },
      layerOpacityByLayer: { ...(base.three?.layerOpacityByLayer || {}), ...(s.three?.layerOpacityByLayer || {}) },
      selection: { ...(base.three?.selection || {}), ...(s.three?.selection || {}) },
    },
  }

  const layoutAny = (next.layout && typeof next.layout === 'object' && !Array.isArray(next.layout))
    ? (next.layout as unknown as Record<string, unknown>)
    : null
  if (layoutAny) {
    const mode = layoutAny.mode
    if (mode === 'stratify') layoutAny.mode = 'force'
    if (Object.prototype.hasOwnProperty.call(layoutAny, 'stratify')) {
      delete layoutAny.stratify
    }
    const flowAny = (layoutAny.flow && typeof layoutAny.flow === 'object' && !Array.isArray(layoutAny.flow))
      ? (layoutAny.flow as Record<string, unknown>)
      : null
    if (flowAny && flowAny.rankdir != null) {
      const raw = String(flowAny.rankdir || '').toUpperCase()
      flowAny.rankdir = raw === 'LR' ? 'LR' : 'TB'
    }
  }

  const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    const out: string[] = []
    for (const item of value) {
      const v = String(item ?? '').trim()
      if (v) out.push(v)
    }
    return out
  }

  const nodeTypeSet = new Set<string>()
  const edgeLabelSet = new Set<string>()

  toStringArray(next.catalog?.nodeTypes).forEach(v => nodeTypeSet.add(v))
  toStringArray(next.catalog?.edgeLabels).forEach(v => edgeLabelSet.add(v))

  Object.keys(next.nodeStyles || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.nodeSizes || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.nodeStroke || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.nodeShapes || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.layout?.forces?.collisionByType || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.cardinality?.nodeType || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.validation?.node || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.templates?.node || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))
  Object.keys(next.propertySchemas?.node || {}).forEach(v => nodeTypeSet.add(String(v || '').trim()))

  Object.keys(next.edgeStyles || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))
  Object.keys(next.layout?.forces?.linkDistanceByLabel || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))
  Object.keys(next.endpointMatrix || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))
  Object.keys(next.cardinality?.edgeLabel || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))
  Object.keys(next.validation?.edge || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))
  Object.keys(next.templates?.edge || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))
  Object.keys(next.propertySchemas?.edge || {}).forEach(v => edgeLabelSet.add(String(v || '').trim()))

  for (const rule of next.rules || []) {
    if (!rule || typeof rule !== 'object') continue
    const target = (rule as { target?: unknown }).target
    const type = String((rule as { type?: unknown }).type ?? '').trim()
    if (!type) continue
    if (target === 'node') nodeTypeSet.add(type)
    if (target === 'edge') edgeLabelSet.add(type)
  }

  for (const entry of Object.values(next.endpointMatrix || {})) {
    const v = entry as { sources?: unknown; targets?: unknown } | null
    if (!v) continue
    toStringArray(v.sources).forEach(x => nodeTypeSet.add(x))
    toStringArray(v.targets).forEach(x => nodeTypeSet.add(x))
  }

  const nodeTypes = Array.from(nodeTypeSet).filter(Boolean)
  const edgeLabels = Array.from(edgeLabelSet).filter(Boolean)

  return {
    ...next,
    catalog: { nodeTypes, edgeLabels },
  }
}

const metadataLikePatterns: RegExp[] = [
  /^metadata$/i,
  /^meta[:._-]/i,
  /^provenance/i,
  /^rag[:._-]/i,
  /^rag[-_]?config$/i,
  /^version$/i,
  /^created$/i,
  /^source$/i,
  /^domain$/i,
  /^title$/i,
  /^include[A-Z][a-zA-Z]*$/,
  /^enable[A-Z][a-zA-Z]*$/,
  /^filterBy[A-Z][a-zA-Z]*$/,
  /^embeddingDimension$/,
  /^embeddingVector$/,
  /^contextSize$/,
  /^similarityThreshold$/,
  /^maxHops$/,
  /^topK$/,
  /^retrievalMethod$/,
  /^contextStrategy$/,
  /^contextPriority$/,
  /^vectorSpace$/,
  /^distanceMetric$/,
  /^overlapTokens$/,
  /^queryText$/,
  /^ruleType$/,
  /^ruleCondition$/,
  /^ruleAction$/,
  /^rulePriority$/,
  /^allowedRelations$/,
  /^blockedRelations$/,
  /^depthLimit$/,
  /^branchingLimit$/,
  /^modelName$/,
  /^temperature$/,
  /^maxTokens$/,
  /^promptTemplate$/,
]

export const lintSchemaMetadata = (schema: GraphSchema): SchemaLintWarning[] => {
  const warnings: SchemaLintWarning[] = []
  const nodeSchemas = schema.propertySchemas?.node || {}
  const edgeSchemas = schema.propertySchemas?.edge || {}
  const check = (ownerKind: 'node' | 'edge', ownerKey: string, props: Record<string, unknown>) => {
    Object.keys(props).forEach((propKey) => {
      if (!metadataLikePatterns.some(re => re.test(propKey))) return
      warnings.push({
        path: `${ownerKind}.${ownerKey}.${propKey}`,
        message: `Property "${propKey}" on ${ownerKind} "${ownerKey}" looks like metadata; prefer top-level context/metadata for shared presets.`,
      })
    })
  }
  Object.entries(nodeSchemas).forEach(([k, v]) => {
    check('node', k, v || {})
  })
  Object.entries(edgeSchemas).forEach(([k, v]) => {
    check('edge', k, v || {})
  })
  return warnings
}

export const parseSchemaLintOwner = (
  path: string,
): { ownerKind: 'node' | 'edge'; ownerKey: string } | null => {
  const trimmed = String(path || '').trim()
  if (!trimmed) return null
  const parts = trimmed.split('.')
  if (parts.length < 2) return null
  const ownerKind: 'node' | 'edge' = parts[0] === 'edge' ? 'edge' : 'node'
  const ownerKey = parts[1]
  if (!ownerKey) return null
  return { ownerKind, ownerKey }
}
