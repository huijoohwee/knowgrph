import type { GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { KG_SUBGRAPHS_KEY } from '@/lib/graph/subgraphs'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'

const FRONTMATTER_ANNOTATION_WIRING_KEY = 'frontmatterAnnotationWiring' as const
const FRONTMATTER_PRIMITIVE_KEY = 'frontmatter:primitive' as const

type AnnotationRefs = {
  refs: Array<{ kind: 'node' | 'edge' | 'cluster'; id: string; line: number }>
  nodeIds: string[]
  edgeIds: string[]
  clusterIds: string[]
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function appendAnnotationNodes(args: {
  nodes: GraphNode[]
  annotations: AnnotationRefs
  mermaidEdgeNodeIds: string[]
}): Set<string> {
  const knownNodeIds = new Set<string>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const id = asString(args.nodes[i]?.id)
    if (id) knownNodeIds.add(id)
  }
  for (let i = 0; i < args.annotations.nodeIds.length; i += 1) {
    const id = args.annotations.nodeIds[i]
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    args.nodes.push({
      id,
      label: id,
      type: 'Node',
      properties: {
        [FRONTMATTER_PRIMITIVE_KEY]: 'node',
        'frontmatter:sigilId': id,
        'frontmatter:annotationOnly': true,
        'visual:shape': 'rect',
      },
    })
  }
  for (let i = 0; i < args.annotations.clusterIds.length; i += 1) {
    const id = args.annotations.clusterIds[i]
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    args.nodes.push({
      id,
      label: id,
      type: 'ClusterRef',
      properties: {
        [FRONTMATTER_PRIMITIVE_KEY]: 'cluster',
        'frontmatter:sigilId': id,
        'frontmatter:annotationOnly': true,
        'visual:shape': 'circle',
      },
    })
  }
  for (let i = 0; i < args.mermaidEdgeNodeIds.length; i += 1) {
    const id = args.mermaidEdgeNodeIds[i]
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    args.nodes.push({
      id,
      label: id,
      type: 'EdgePrimitive',
      properties: {
        [FRONTMATTER_PRIMITIVE_KEY]: 'edge',
        'frontmatter:sigilId': id,
        'frontmatter:annotationOnly': true,
        'visual:shape': 'hex',
      },
    })
  }
  return knownNodeIds
}

export function mergeEdges(args: {
  mermaidEdges: GraphEdge[]
  baseEdges: GraphEdge[]
  sigilEdges: GraphEdge[]
}): GraphEdge[] {
  if (args.mermaidEdges.length > 0) return args.mermaidEdges
  if (args.sigilEdges.length === 0) return args.baseEdges
  if (args.baseEdges.length === 0) return args.sigilEdges
  const out: GraphEdge[] = [...args.baseEdges]
  const uniq = new Set<string>()
  for (let i = 0; i < args.baseEdges.length; i += 1) {
    const e = args.baseEdges[i]
    uniq.add(`${asString(e.source)}|${asString(e.target)}|${asString(e.label)}`)
  }
  for (let i = 0; i < args.sigilEdges.length; i += 1) {
    const e = args.sigilEdges[i]
    const k = `${asString(e.source)}|${asString(e.target)}|${asString(e.label)}`
    if (uniq.has(k)) continue
    uniq.add(k)
    out.push(e)
  }
  return out
}

export function mergeSubgraphs(args: {
  baseSubgraphs: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }>
  clusterSubgraphs: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'cluster' }>
}): Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }> {
  if (args.clusterSubgraphs.length === 0) return args.baseSubgraphs
  const out = [...args.baseSubgraphs]
  const seen = new Set<string>()
  for (let i = 0; i < out.length; i += 1) {
    const id = asString(out[i]?.id)
    if (id) seen.add(id)
  }
  for (let i = 0; i < args.clusterSubgraphs.length; i += 1) {
    const row = args.clusterSubgraphs[i]
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export function buildFrontmatterFlowMetadata(args: {
  sourceLayerHash: string
  frontmatterMeta: Record<string, unknown> | null
  socketTypes: Record<string, unknown> | null
  flowSettings: Record<string, unknown> | null
  annotations: AnnotationRefs
  registry: unknown[]
  subgraphs: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }>
}): Record<string, JSONValue> {
  return {
    kind: 'frontmatter-flow',
    sourceLayerHash: args.sourceLayerHash,
    ...(args.frontmatterMeta ? ({ frontmatterMeta: args.frontmatterMeta as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(args.socketTypes ? ({ socketTypes: args.socketTypes as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(args.flowSettings ? ({ frontmatterFlowSettings: args.flowSettings as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(args.annotations.refs.length > 0
      ? ({
          [FRONTMATTER_ANNOTATION_WIRING_KEY]: {
            refs: args.annotations.refs,
            nodeIds: args.annotations.nodeIds,
            edgeIds: args.annotations.edgeIds,
            clusterIds: args.annotations.clusterIds,
          } as unknown as JSONValue,
        } as unknown as Record<string, JSONValue>)
      : {}),
    ...(args.registry.length > 0
      ? ({ [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: args.registry as unknown as JSONValue } as unknown as Record<string, JSONValue>)
      : {}),
    ...(args.subgraphs && args.subgraphs.length > 0 ? ({ [KG_SUBGRAPHS_KEY]: args.subgraphs as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
  }
}

export function readSocketTypes(metaRecord: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(metaRecord.socket_types) ? (metaRecord.socket_types as Record<string, unknown>) : null
}
