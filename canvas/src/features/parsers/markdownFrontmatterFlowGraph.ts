import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { splitMarkdownLines, parseMarkdownFrontmatter, parseMarkdownBlocks } from '@/lib/markdown'
import { hashText } from '@/features/parsers/hash'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'
import { FLOW_VIDEO_GENERATION_NODE_TYPE_ID } from '@/lib/config'
import {
  FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY,
  FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY,
} from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { FLOW_EDGE_DISPLAY_LABEL_KEY, FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { KG_SUBGRAPHS_KEY } from '@/lib/graph/subgraphs'

type RegistryPort = { portKey: string; direction: 'input' | 'output'; schemaPath?: string }
type RegistryEntry = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  quickEditorTypeId: string
  formId: string
  fields: unknown[]
  ports: RegistryPort[]
  updatedAt: string
}

const FRONTMATTER_REGISTRY_UPDATED_AT = '1970-01-01T00:00:00.000Z'
const FLOW_PORT_TYPES_KEY = 'flow:portTypes' as const
const FRONTMATTER_ANNOTATION_WIRING_KEY = 'frontmatterAnnotationWiring' as const
const FRONTMATTER_PRIMITIVE_KEY = 'frontmatter:primitive' as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function cleanIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

function normalizeSigilId(raw: unknown, fallbackKind?: 'node' | 'edge' | 'cluster'): string {
  const src = String(raw || '').trim()
  if (!src) return ''
  const plain = src.startsWith('@') ? src.slice(1) : src
  const prefixed = /^([a-zA-Z]+):(.*)$/.exec(plain)
  if (prefixed) {
    const kindRaw = String(prefixed[1] || '').trim().toLowerCase()
    const rest = String(prefixed[2] || '').trim().replace(/:+$/, '')
    if (!rest) return ''
    const kind =
      kindRaw === 'node' || kindRaw === 'edge' || kindRaw === 'cluster'
        ? kindRaw
        : fallbackKind || 'node'
    return `@${kind}:${rest}`
  }
  const rest = plain.trim().replace(/:+$/, '')
  if (!rest) return ''
  const kind = fallbackKind || 'node'
  return `@${kind}:${rest}`
}

function escapeRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePatternKind(raw: string): 'node' | 'edge' | 'cluster' {
  const s = String(raw || '').trim()
  if (s.startsWith('@cluster:')) return 'cluster'
  if (s.startsWith('@edge:')) return 'edge'
  return 'node'
}

function resolveSigilPattern(raw: unknown): string {
  const source = String(raw || '').trim()
  if (!source) return ''
  const kind = parsePatternKind(source)
  return normalizeSigilId(source, kind)
}

function expandSigilPattern(pattern: string, candidates: ReadonlyArray<string>): string[] {
  const token = String(pattern || '').trim()
  if (!token) return []
  if (!token.includes('*')) return [token]
  const rx = new RegExp(`^${escapeRegex(token).replace(/\\\*/g, '.*')}$`)
  const out: string[] = []
  for (let i = 0; i < candidates.length; i += 1) {
    const id = String(candidates[i] || '').trim()
    if (!id) continue
    if (rx.test(id)) out.push(id)
  }
  return out
}

function coerceFrontmatterNodeRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    const id = normalizeSigilId(raw, 'node')
    if (!id || !id.startsWith('@node:')) return null
    return {
      id,
      label: id,
      type: 'Node',
      properties: {
        [FRONTMATTER_PRIMITIVE_KEY]: 'node',
        'frontmatter:sigilId': id,
      },
    }
  }
  if (!isRecord(raw)) return null
  const explicitId = asString(raw.id)
  if (explicitId) return raw
  const pairs = Object.entries(raw)
  if (pairs.length !== 1) return null
  const [rawId, value] = pairs[0] || []
  const id = normalizeSigilId(rawId, 'node')
  if (!id || !id.startsWith('@node:')) return null
  const base = isRecord(value) ? value : {}
  const baseProps = isRecord(base.properties) ? (base.properties as Record<string, JSONValue>) : {}
  const labelFromId = id.split(':').slice(2).join(':')
  return {
    ...base,
    id,
    type: asString(base.type) || 'Node',
    label: asString(base.label) || labelFromId || id,
    properties: {
      ...baseProps,
      [FRONTMATTER_PRIMITIVE_KEY]: 'node',
      'frontmatter:sigilId': id,
    } as Record<string, JSONValue>,
  }
}

function normalizeClusters(meta: Record<string, unknown>, nodes: GraphNode[]): {
  clusterNodes: GraphNode[]
  subgraphs: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'cluster' }>
} {
  const rawClusters = Array.isArray(meta.clusters) ? meta.clusters : []
  if (rawClusters.length === 0) return { clusterNodes: [], subgraphs: [] }
  const nodeIdSet = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = asString(nodes[i]?.id)
    if (id) nodeIdSet.add(id)
  }
  const clusterNodes: GraphNode[] = []
  const subgraphs: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'cluster' }> = []
  const seenClusterIds = new Set<string>()
  for (let i = 0; i < rawClusters.length; i += 1) {
    const row = rawClusters[i]
    if (!isRecord(row)) continue
    const pairs = Object.entries(row)
    if (pairs.length !== 1) continue
    const [rawId, descriptor] = pairs[0] || []
    const id = normalizeSigilId(rawId, 'cluster')
    if (!id || seenClusterIds.has(id)) continue
    seenClusterIds.add(id)
    const rec = isRecord(descriptor) ? descriptor : {}
    const label = asString(rec.label) || id
    const color = asString(rec.color)
    const members = Array.isArray(rec.members) ? rec.members : []
    const memberNodeIds: string[] = []
    const seenMembers = new Set<string>()
    for (let j = 0; j < members.length; j += 1) {
      const member = normalizeSigilId(members[j], 'node')
      if (!member || seenMembers.has(member)) continue
      if (!nodeIdSet.has(member)) continue
      seenMembers.add(member)
      memberNodeIds.push(member)
    }
    memberNodeIds.sort((a, b) => a.localeCompare(b))
    subgraphs.push({ id, label, memberNodeIds, parentId: null, kind: 'cluster' })
    clusterNodes.push({
      id,
      label,
      type: 'ClusterRef',
      properties: {
        [FRONTMATTER_PRIMITIVE_KEY]: 'cluster',
        'frontmatter:sigilId': id,
        'visual:shape': 'circle',
        ...(color ? ({ 'visual:fill': color } as unknown as Record<string, JSONValue>) : {}),
      },
    })
  }
  return { clusterNodes, subgraphs }
}

function normalizeEdgesFromSigilSpecs(args: {
  meta: Record<string, unknown>
  nodeIds: ReadonlyArray<string>
}): GraphEdge[] {
  const rawEdges = Array.isArray(args.meta.edges) ? args.meta.edges : []
  if (rawEdges.length === 0) return []
  const out: GraphEdge[] = []
  const seen = new Set<string>()
  const candidates = args.nodeIds
  for (let i = 0; i < rawEdges.length; i += 1) {
    const row = rawEdges[i]
    if (!isRecord(row)) continue
    const baseId = normalizeSigilId(row.id, 'edge') || `@edge:auto-${i + 1}`
    const sourcePattern = resolveSigilPattern(row.source)
    const targetPattern = resolveSigilPattern(row.target)
    if (!sourcePattern || !targetPattern) continue
    const rel = asString(row.rel)
    const explicitLabel = asString(row.label)
    const label = rel || explicitLabel
    const sourceIds = expandSigilPattern(sourcePattern, candidates)
    const targetIds = expandSigilPattern(targetPattern, candidates)
    if (sourceIds.length === 0 || targetIds.length === 0) continue
    let edgeOrdinal = 0
    for (let s = 0; s < sourceIds.length; s += 1) {
      const source = sourceIds[s]
      for (let t = 0; t < targetIds.length; t += 1) {
        const target = targetIds[t]
        if (!source || !target || source === target) continue
        const uniq = `${source}|${target}|${label}`
        if (seen.has(uniq)) continue
        seen.add(uniq)
        edgeOrdinal += 1
        const nextId = edgeOrdinal === 1 && sourceIds.length === 1 && targetIds.length === 1 ? baseId : `${baseId}#${edgeOrdinal}`
        out.push({
          id: nextId,
          source,
          target,
          label,
          properties: {
            [FRONTMATTER_PRIMITIVE_KEY]: 'edge',
            'frontmatter:sigilId': baseId,
            ...(rel ? ({ 'frontmatter:rel': rel } as unknown as Record<string, JSONValue>) : {}),
          },
        })
      }
    }
  }
  return out
}

function extractFrontmatterBodyAnnotations(lines: string[], startIndex: number): {
  refs: Array<{ kind: 'node' | 'edge' | 'cluster'; id: string; line: number }>
  nodeIds: string[]
  edgeIds: string[]
  clusterIds: string[]
} {
  const refs: Array<{ kind: 'node' | 'edge' | 'cluster'; id: string; line: number }> = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const clusterIds = new Set<string>()
  const rx = /<!--\s*@(node|edge|cluster):([^\s>]+)\s*-->/g
  for (let i = Math.max(0, startIndex); i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (!line.includes('<!-- @')) continue
    rx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rx.exec(line)) !== null) {
      const kind = String(m[1] || '').trim().toLowerCase()
      const token = String(m[2] || '').trim()
      if (!token) continue
      const normalized =
        kind === 'node'
          ? normalizeSigilId(`@node:${token}`, 'node')
          : kind === 'edge'
            ? normalizeSigilId(`@edge:${token}`, 'edge')
            : normalizeSigilId(`@cluster:${token}`, 'cluster')
      if (!normalized) continue
      if (kind === 'node') nodeIds.add(normalized)
      else if (kind === 'edge') edgeIds.add(normalized)
      else clusterIds.add(normalized)
      refs.push({
        kind: kind === 'node' ? 'node' : kind === 'edge' ? 'edge' : 'cluster',
        id: normalized,
        line: i + 1,
      })
    }
  }
  return {
    refs,
    nodeIds: Array.from(nodeIds).sort((a, b) => a.localeCompare(b)),
    edgeIds: Array.from(edgeIds).sort((a, b) => a.localeCompare(b)),
    clusterIds: Array.from(clusterIds).sort((a, b) => a.localeCompare(b)),
  }
}

function categoryLayerIndex(category: string): number | null {
  const key = String(category || '').trim().toLowerCase()
  if (!key) return null
  if (key === 'source') return 0
  if (key === 'timing') return 1
  if (key === 'audio') return 2
  if (key === 'visual') return 3
  if (key === 'overlay') return 4
  if (key === 'assembly') return 5
  if (key === 'publish') return 6
  if (key === 'output') return 7
  return null
}

function tierForCategory(category: string): number | null {
  const key = String(category || '').trim().toLowerCase()
  if (!key) return null
  if (key === 'source') return 0
  if (key === 'timing') return 1
  if (key === 'audio' || key === 'visual') return 1
  if (key === 'overlay') return 2
  if (key === 'assembly' || key === 'publish') return 3
  if (key === 'output') return 4
  return null
}

function buildDefaultSubgraphsFromNodes(rawNodes: ReadonlyArray<unknown>): Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null }> {
  const byCategory = new Map<string, string[]>()
  const byTier = new Map<number, string[]>()

  for (let i = 0; i < rawNodes.length; i += 1) {
    const row = rawNodes[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id) continue
    const category = asString(row.category)
    if (category) {
      const list = byCategory.get(category) || []
      list.push(id)
      byCategory.set(category, list)
    }
    const tier = tierForCategory(category)
    if (tier != null) {
      const list = byTier.get(tier) || []
      list.push(id)
      byTier.set(tier, list)
    }
  }

  const normalize = (ids: string[]): string[] => Array.from(new Set(ids)).filter(Boolean).sort((a, b) => a.localeCompare(b))

  const out: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null }> = []
  const tierIds = Array.from(byTier.keys()).sort((a, b) => a - b)
  for (let i = 0; i < tierIds.length; i += 1) {
    const t = tierIds[i]
    const ids = normalize(byTier.get(t) || [])
    if (ids.length === 0) continue
    out.push({ id: `tier-${t}`, label: `Tier ${t}`, memberNodeIds: ids, parentId: null })
  }

  const categoryKeys = Array.from(byCategory.keys()).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < categoryKeys.length; i += 1) {
    const cat = categoryKeys[i]
    const ids = normalize(byCategory.get(cat) || [])
    if (ids.length === 0) continue
    const parentTier = tierForCategory(cat)
    const parentId = parentTier != null ? `tier-${parentTier}` : null
    out.push({ id: `cat-${cleanIdPart(cat) || hashText(cat)}`, label: cat, memberNodeIds: ids, parentId })
  }

  return out
}

function normalizeSubgraphsFromFrontmatter(args: {
  meta: Record<string, unknown>
  rawNodes: ReadonlyArray<unknown>
}): Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }> | null {
  const raw = args.meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(raw)) return buildDefaultSubgraphsFromNodes(args.rawNodes)
  const nodeIdSet = new Set<string>()
  for (let i = 0; i < args.rawNodes.length; i += 1) {
    const row = args.rawNodes[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (id) nodeIdSet.add(id)
  }
  const out: Array<{ id: string; label: string; memberNodeIds: string[]; parentId?: string | null; kind?: 'subgraph' | 'cluster' }> = []
  const seen = new Set<string>()
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i]
    if (!isRecord(row)) continue
    const id = asString(row.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const label = asString(row.label) || id
    const memberNodeIds = (() => {
      const ids = Array.isArray(row.memberNodeIds) ? row.memberNodeIds : []
      const set = new Set<string>()
      for (let j = 0; j < ids.length; j += 1) {
        const nid = asString(ids[j])
        if (!nid) continue
        if (!nodeIdSet.has(nid)) continue
        set.add(nid)
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b))
    })()
    const parentId = row.parentId == null ? null : asString(row.parentId) || null
    const kindRaw = asString(row.kind)
    const kind = kindRaw === 'cluster' ? 'cluster' : kindRaw === 'subgraph' ? 'subgraph' : undefined
    out.push({
      id,
      label,
      memberNodeIds,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(kind ? { kind } : {}),
    })
  }
  return out
}

function normalizeRegistryPorts(args: { inputs: unknown; outputs: unknown }): RegistryPort[] {
  const ports: RegistryPort[] = []
  const seen = new Set<string>()
  const add = (dir: 'input' | 'output', raw: unknown) => {
    if (!isRecord(raw)) return
    const portKey = asString(raw.port)
    if (!portKey) return
    const k = `${dir}:${portKey}`
    if (seen.has(k)) return
    seen.add(k)
    ports.push({ portKey, direction: dir })
  }
  const inputs = Array.isArray(args.inputs) ? args.inputs : []
  const outputs = Array.isArray(args.outputs) ? args.outputs : []
  for (let i = 0; i < inputs.length; i += 1) add('input', inputs[i])
  for (let i = 0; i < outputs.length; i += 1) add('output', outputs[i])
  return ports
}

function normalizeFlowPortTypes(args: { inputs: unknown; outputs: unknown }): JSONValue | null {
  const inByKey: Record<string, JSONValue> = {}
  const outByKey: Record<string, JSONValue> = {}
  const add = (dir: 'in' | 'out', raw: unknown) => {
    if (!isRecord(raw)) return
    const portKey = asString(raw.port)
    if (!portKey) return
    const type = asString(raw.type)
    if (!type) return
    if (dir === 'in') inByKey[portKey] = type
    else outByKey[portKey] = type
  }
  const inputs = Array.isArray(args.inputs) ? args.inputs : []
  const outputs = Array.isArray(args.outputs) ? args.outputs : []
  for (let i = 0; i < inputs.length; i += 1) add('in', inputs[i])
  for (let i = 0; i < outputs.length; i += 1) add('out', outputs[i])
  if (Object.keys(inByKey).length === 0 && Object.keys(outByKey).length === 0) return null
  return { in: inByKey, out: outByKey } as unknown as JSONValue
}

function normalizeVisualOverrides(raw: unknown): Record<string, JSONValue> {
  if (!isRecord(raw)) return {}
  const out: Record<string, JSONValue> = {}
  for (const k of Object.keys(raw)) {
    const key = String(k || '').trim()
    if (!key) continue
    const destKey = key.startsWith('visual:') ? key : `visual:${key}`
    const v = raw[key]
    const numLike = destKey === 'visual:opacity' || destKey === 'visual:zIndex' || destKey === 'visual:layer' || destKey === 'visual:depth' || destKey === 'visual:width' || destKey === 'visual:height' || destKey === 'visual:xIndex' || destKey === 'visual:yIndex'
    if (numLike) {
      const n = asFiniteNumber(v)
      if (n != null) {
        out[destKey] = destKey === 'visual:opacity' ? Math.max(0, Math.min(1, n)) : Math.floor(n)
        continue
      }
    }
    out[destKey] = v as JSONValue
  }
  return out
}

function normalizeNodes(meta: Record<string, unknown>): { nodes: GraphNode[]; registry: RegistryEntry[] } | null {
  const rawNodes = Array.isArray(meta.nodes) ? meta.nodes : null
  if (!rawNodes || rawNodes.length === 0) return null

  const nodes: GraphNode[] = []
  const registry: RegistryEntry[] = []
  const seenIds = new Set<string>()

  for (let i = 0; i < rawNodes.length; i += 1) {
    const row = coerceFrontmatterNodeRecord(rawNodes[i])
    if (!row) continue
    const id = asString(row.id)
    if (!id) continue
    if (seenIds.has(id)) continue
    seenIds.add(id)

    const type = asString(row.type) || 'Node'
    const label = asString(row.label) || id
    const pos = isRecord(row.pos) ? row.pos : null
    const x = pos ? asFiniteNumber(pos.x) : asFiniteNumber((row as Record<string, unknown>).pos_x)
    const y = pos ? asFiniteNumber(pos.y) : asFiniteNumber((row as Record<string, unknown>).pos_y)
    const category = asString(row.category)
    const layer = categoryLayerIndex(category)
    const ports = normalizeRegistryPorts({ inputs: row.inputs, outputs: row.outputs })
    const portTypes = normalizeFlowPortTypes({ inputs: row.inputs, outputs: row.outputs })

    const formId = `fm:${cleanIdPart(id) || hashText(id)}`

    const propsFromRow = isRecord(row.properties) ? (row.properties as Record<string, JSONValue>) : ({} as Record<string, JSONValue>)
    const visualOverrides = normalizeVisualOverrides(row.visual)
    const paramsFromRow = isRecord(row.params) ? (row.params as unknown as JSONValue) : null

    const properties: Record<string, JSONValue> = {
      ...propsFromRow,
      ...(category && propsFromRow.category == null ? ({ category } as unknown as Record<string, JSONValue>) : {}),
      ...(category && propsFromRow['visual:layer'] == null ? ({ 'visual:layer': category } as unknown as Record<string, JSONValue>) : {}),
      ...(layer != null && propsFromRow['visual:depth'] == null ? ({ 'visual:depth': layer } as unknown as Record<string, JSONValue>) : {}),
      ...(x != null && propsFromRow['visual:xIndex'] == null ? ({ 'visual:xIndex': Math.floor(x / 320) } as unknown as Record<string, JSONValue>) : {}),
      ...(y != null && propsFromRow['visual:yIndex'] == null ? ({ 'visual:yIndex': Math.floor(y / 220) } as unknown as Record<string, JSONValue>) : {}),
      ...visualOverrides,
      ...(portTypes != null && propsFromRow[FLOW_PORT_TYPES_KEY] == null ? ({ [FLOW_PORT_TYPES_KEY]: portTypes } as unknown as Record<string, JSONValue>) : {}),
      ...(paramsFromRow != null ? ({ params: paramsFromRow } as unknown as Record<string, JSONValue>) : {}),
      ...(propsFromRow[FRONTMATTER_PRIMITIVE_KEY] == null
        ? ({
            [FRONTMATTER_PRIMITIVE_KEY]: String(id).startsWith('@cluster:') ? 'cluster' : 'node',
          } as unknown as Record<string, JSONValue>)
        : {}),
      ...(type === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
        ? ({
            [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: 'ports',
            [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: formId,
          } as unknown as Record<string, JSONValue>)
        : row[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] == null
          ? ({ [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: formId } as unknown as Record<string, JSONValue>)
          : {}),
    }

    nodes.push({
      id,
      label,
      type,
      ...(x != null ? { x } : {}),
      ...(y != null ? { y } : {}),
      properties,
    })

    if (ports.length > 0) {
      registry.push({
        id: `qer-fm-${cleanIdPart(type) || 'node'}-${cleanIdPart(id) || hashText(id)}`,
        isEnabled: true,
        nodeTypeId: type,
        quickEditorTypeId: type === FLOW_VIDEO_GENERATION_NODE_TYPE_ID ? 'ports' : 'default',
        formId,
        fields: [],
        ports,
        updatedAt: FRONTMATTER_REGISTRY_UPDATED_AT,
      })
    }
  }

  if (nodes.length === 0) return null
  return { nodes, registry }
}

function normalizeEdgesFromConnections(meta: Record<string, unknown>): GraphEdge[] {
  return parseConnections(meta).edges
}

function normalizeEdgesFromNodeInputs(nodes: ReadonlyArray<Record<string, unknown>>): GraphEdge[] {
  const out: GraphEdge[] = []
  const seen = new Set<string>()
  let n = 0

  const buildDisplayLabel = (fromPort: string, toPort: string, socketType: string): string => {
    const base = `${fromPort} → ${toPort}`
    const t = String(socketType || '').trim()
    return t ? `${base} · ${t}` : base
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (!isRecord(node)) continue
    const target = asString(node.id)
    if (!target) continue
    const inputs = Array.isArray(node.inputs) ? node.inputs : []
    for (let j = 0; j < inputs.length; j += 1) {
      const inp = inputs[j]
      if (!isRecord(inp)) continue
      const toPort = asString(inp.port)
      const from = asString(inp.from)
      if (!toPort || !from) continue
      const dot = from.lastIndexOf('.')
      const source = dot >= 0 ? from.slice(0, dot).trim() : ''
      const fromPort = dot >= 0 ? from.slice(dot + 1).trim() : ''
      if (!source || !fromPort) continue

      const uniq = `${source}|${fromPort}|${target}|${toPort}`
      if (seen.has(uniq)) continue
      seen.add(uniq)
      const id = `fm-e${String(++n).padStart(2, '0')}-${hashText(uniq)}`
      const socketType = asString(inp.type)

      out.push({
        id,
        source,
        target,
        label: '',
        ...(socketType ? { type: socketType } : {}),
        properties: {
          [FLOW_EDGE_SOURCE_PORT_KEY]: fromPort,
          [FLOW_EDGE_TARGET_PORT_KEY]: toPort,
          [FLOW_EDGE_DISPLAY_LABEL_KEY]: buildDisplayLabel(fromPort, toPort, socketType),
          ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
        },
      })
    }
  }

  return out
}

function buildEdgeUniqKey(args: { source: string; fromPort: string; target: string; toPort: string }): string {
  return `${args.source}|${args.fromPort}|${args.target}|${args.toPort}`
}

type ParsedConnection = {
  id: string
  uniq: string
  source: string
  target: string
  fromPort: string
  toPort: string
  socketType: string
}

function parseDotEndpoint(raw: unknown): { nodeId: string; portKey: string } | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const dot = s.lastIndexOf('.')
  if (dot < 0) return null
  const nodeId = s.slice(0, dot).trim()
  const portKey = s.slice(dot + 1).trim()
  if (!nodeId || !portKey) return null
  return { nodeId, portKey }
}

function extractConnectionEndpoints(row: Record<string, unknown>): { source: string; target: string; fromPort: string; toPort: string } | null {
  const source = asString(row.from_node)
  const target = asString(row.to_node)
  const fromPort = asString(row.from_port)
  const toPort = asString(row.to_port)
  if (source && target && fromPort && toPort) return { source, target, fromPort, toPort }
  const from = asString(row.from)
  const to = asString(row.to)
  const pFrom = parseDotEndpoint(from)
  const pTo = parseDotEndpoint(to)
  if (!pFrom || !pTo) return null
  return { source: pFrom.nodeId, target: pTo.nodeId, fromPort: pFrom.portKey, toPort: pTo.portKey }
}

function parseConnections(meta: Record<string, unknown>): { edges: GraphEdge[]; declared: ParsedConnection[] } {
  const raw = Array.isArray(meta.connections) ? meta.connections : []
  const edges: GraphEdge[] = []
  const declared: ParsedConnection[] = []
  const seen = new Set<string>()

  const buildDisplayLabel = (fromPort: string, toPort: string, socketType: string): string => {
    const base = `${fromPort} → ${toPort}`
    const t = String(socketType || '').trim()
    return t ? `${base} · ${t}` : base
  }

  for (let i = 0; i < raw.length; i += 1) {
    const rowRaw = raw[i]
    if (!isRecord(rowRaw)) continue
    const row = rowRaw as Record<string, unknown>
    const id = asString(row.id) || `e${i + 1}`
    const socketType = asString(row.type)
    const endpoints = extractConnectionEndpoints(row)
    if (!endpoints) continue
    const uniq = buildEdgeUniqKey({ source: endpoints.source, fromPort: endpoints.fromPort, target: endpoints.target, toPort: endpoints.toPort })
    if (seen.has(uniq)) continue
    seen.add(uniq)

    declared.push({ id, uniq, ...endpoints, socketType })

    const properties: Record<string, JSONValue> = {
      [FLOW_EDGE_SOURCE_PORT_KEY]: endpoints.fromPort,
      [FLOW_EDGE_TARGET_PORT_KEY]: endpoints.toPort,
      [FLOW_EDGE_DISPLAY_LABEL_KEY]: buildDisplayLabel(endpoints.fromPort, endpoints.toPort, socketType),
      ...(socketType ? ({ 'flow:socketType': socketType } as unknown as Record<string, JSONValue>) : {}),
    }
    edges.push({
      id,
      source: endpoints.source,
      target: endpoints.target,
      label: '',
      ...(socketType ? { type: socketType } : {}),
      properties,
    })
  }

  return { edges, declared }
}

function collectNodeInputConnections(meta: Record<string, unknown>): Set<string> {
  const rawNodes = Array.isArray(meta.nodes) ? (meta.nodes as unknown[]) : []
  const set = new Set<string>()
  for (let i = 0; i < rawNodes.length; i += 1) {
    const node = rawNodes[i]
    if (!isRecord(node)) continue
    const target = asString(node.id)
    if (!target) continue
    const inputs = Array.isArray(node.inputs) ? node.inputs : []
    for (let j = 0; j < inputs.length; j += 1) {
      const inp = inputs[j]
      if (!isRecord(inp)) continue
      const toPort = asString(inp.port)
      const from = asString(inp.from)
      if (!toPort || !from) continue
      const dot = from.lastIndexOf('.')
      const source = dot >= 0 ? from.slice(0, dot).trim() : ''
      const fromPort = dot >= 0 ? from.slice(dot + 1).trim() : ''
      if (!source || !fromPort) continue
      set.add(buildEdgeUniqKey({ source, fromPort, target, toPort }))
    }
  }
  return set
}

function collectDeclaredPortTypes(meta: Record<string, unknown>): {
  inputTypeByNodeId: Record<string, Record<string, string>>
  outputTypeByNodeId: Record<string, Record<string, string>>
} {
  const rawNodes = Array.isArray(meta.nodes) ? (meta.nodes as unknown[]) : []
  const inputTypeByNodeId: Record<string, Record<string, string>> = {}
  const outputTypeByNodeId: Record<string, Record<string, string>> = {}
  for (let i = 0; i < rawNodes.length; i += 1) {
    const node = rawNodes[i]
    if (!isRecord(node)) continue
    const nodeId = asString(node.id)
    if (!nodeId) continue
    const inputs = Array.isArray(node.inputs) ? node.inputs : []
    for (let j = 0; j < inputs.length; j += 1) {
      const inp = inputs[j]
      if (!isRecord(inp)) continue
      const port = asString(inp.port)
      const type = asString(inp.type)
      if (!port || !type) continue
      const byPort = inputTypeByNodeId[nodeId] || {}
      if (!Object.prototype.hasOwnProperty.call(byPort, port)) {
        byPort[port] = type
        inputTypeByNodeId[nodeId] = byPort
      }
    }
    const outputs = Array.isArray(node.outputs) ? node.outputs : []
    for (let j = 0; j < outputs.length; j += 1) {
      const out = outputs[j]
      if (!isRecord(out)) continue
      const port = asString(out.port)
      const type = asString(out.type)
      if (!port || !type) continue
      const byPort = outputTypeByNodeId[nodeId] || {}
      if (!Object.prototype.hasOwnProperty.call(byPort, port)) {
        byPort[port] = type
        outputTypeByNodeId[nodeId] = byPort
      }
    }
  }
  return { inputTypeByNodeId, outputTypeByNodeId }
}

function coercePortTypesFromNode(node: GraphNode): { in: Record<string, string>; out: Record<string, string> } {
  const props = (node.properties || {}) as Record<string, unknown>
  const raw = props[FLOW_PORT_TYPES_KEY]
  if (!isRecord(raw)) return { in: {}, out: {} }
  const rec = raw as Record<string, unknown>
  const inRec = isRecord(rec.in) ? (rec.in as Record<string, unknown>) : {}
  const outRec = isRecord(rec.out) ? (rec.out as Record<string, unknown>) : {}
  const outIn: Record<string, string> = {}
  const outOut: Record<string, string> = {}
  for (const [k, v] of Object.entries(inRec)) {
    const key = String(k || '').trim()
    const val = typeof v === 'string' ? v.trim() : ''
    if (key && val) outIn[key] = val
  }
  for (const [k, v] of Object.entries(outRec)) {
    const key = String(k || '').trim()
    const val = typeof v === 'string' ? v.trim() : ''
    if (key && val) outOut[key] = val
  }
  return { in: outIn, out: outOut }
}

function ensureAugmentedPortsFromDeclaredConnections(args: {
  nodes: GraphNode[]
  registry: RegistryEntry[]
  declared: ParsedConnection[]
}): void {
  if (args.declared.length === 0) return
  const nodeById = new Map<string, GraphNode>()
  const formIdByNodeId = new Map<string, string>()
  const nodeTypeByNodeId = new Map<string, string>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    const n = args.nodes[i]
    const id = String(n.id || '').trim()
    if (!id) continue
    nodeById.set(id, n)
    nodeTypeByNodeId.set(id, String(n.type || 'Node') || 'Node')
    const props = (n.properties || {}) as Record<string, unknown>
    const formId = typeof props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] === 'string' ? String(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] || '').trim() : ''
    if (formId) formIdByNodeId.set(id, formId)
  }

  const registryByFormId = new Map<string, RegistryEntry>()
  for (let i = 0; i < args.registry.length; i += 1) {
    const entry = args.registry[i]
    const formId = String(entry.formId || '').trim()
    if (!formId) continue
    registryByFormId.set(formId, entry)
  }

  const ensureRegistryEntryForNode = (nodeId: string): RegistryEntry | null => {
    const node = nodeById.get(nodeId)
    if (!node) return null
    const formId = formIdByNodeId.get(nodeId) || ''
    if (!formId) return null
    const existing = registryByFormId.get(formId)
    if (existing) return existing
    const type = nodeTypeByNodeId.get(nodeId) || 'Node'
    const created: RegistryEntry = {
      id: `qer-fm-${cleanIdPart(type) || 'node'}-${cleanIdPart(nodeId) || hashText(nodeId)}`,
      isEnabled: true,
      nodeTypeId: type,
      quickEditorTypeId: 'default',
      formId,
      fields: [],
      ports: [],
      updatedAt: FRONTMATTER_REGISTRY_UPDATED_AT,
    }
    args.registry.push(created)
    registryByFormId.set(formId, created)
    return created
  }

  const ensureRegistryPort = (entry: RegistryEntry, direction: 'input' | 'output', portKey: string) => {
    const key = String(portKey || '').trim()
    if (!key) return
    const ports = Array.isArray(entry.ports) ? entry.ports : []
    for (let i = 0; i < ports.length; i += 1) {
      const p = ports[i]
      if (!p) continue
      if (p.direction === direction && p.portKey === key) return
    }
    entry.ports = [...ports, { portKey: key, direction }]
  }

  const ensureNodePortType = (nodeId: string, dir: 'input' | 'output', portKey: string, socketType: string) => {
    const node = nodeById.get(nodeId)
    if (!node) return
    const type = String(socketType || '').trim()
    if (!type) return
    const key = String(portKey || '').trim()
    if (!key) return
    const existing = coercePortTypesFromNode(node)
    const cur = dir === 'input' ? existing.in[key] : existing.out[key]
    if (cur === type) return
    const nextIn = dir === 'input' ? { ...existing.in, [key]: type } : existing.in
    const nextOut = dir === 'output' ? { ...existing.out, [key]: type } : existing.out
    node.properties = {
      ...((node.properties || {}) as Record<string, JSONValue>),
      [FLOW_PORT_TYPES_KEY]: { in: nextIn, out: nextOut } as unknown as JSONValue,
    }
  }

  for (let i = 0; i < args.declared.length; i += 1) {
    const d = args.declared[i]
    const socketType = String(d.socketType || '').trim()
    if (!socketType) continue
    const srcEntry = ensureRegistryEntryForNode(d.source)
    if (srcEntry) ensureRegistryPort(srcEntry, 'output', d.fromPort)
    ensureNodePortType(d.source, 'output', d.fromPort, socketType)

    const tgtEntry = ensureRegistryEntryForNode(d.target)
    if (tgtEntry) ensureRegistryPort(tgtEntry, 'input', d.toPort)
    ensureNodePortType(d.target, 'input', d.toPort, socketType)
  }
}

function normalizeHeaderKey(v: unknown): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function stripAllBackticks(v: unknown): string {
  return String(v || '').replace(/`+/g, '').trim()
}

function parseHexColor(v: unknown): string {
  const s = String(v || '')
  const m = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})/.exec(s)
  if (!m) return ''
  const hex = String(m[0] || '').trim()
  if (!hex.startsWith('#')) return ''
  return hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex
}

function extractConnectionsAndSocketTypesFromMarkdownTables(args: {
  lines: string[]
  startIndex: number
  existingConnections?: unknown
  existingSocketTypes?: unknown
}): { connections: Array<Record<string, unknown>>; socketTypes: Record<string, unknown> | null } {
  const hasConnections = Array.isArray(args.existingConnections) && args.existingConnections.length > 0
  const hasSocketTypes = isRecord(args.existingSocketTypes) && Object.keys(args.existingSocketTypes).length > 0
  if (hasConnections && hasSocketTypes) return { connections: [], socketTypes: null }

  const blocks = parseMarkdownBlocks(args.lines, args.startIndex)
  const connections: Array<Record<string, unknown>> = []
  const seenConn = new Set<string>()
  const socketTypes: Record<string, unknown> = {}

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]
    if (!b || b.kind !== 'table') continue
    const header = Array.isArray(b.tableHeader) ? b.tableHeader : null
    const rows = Array.isArray(b.tableRows) ? b.tableRows : null
    if (!header || !rows) continue

    const headerKeys = header.map(normalizeHeaderKey)
    const idx = (k: string): number => headerKeys.indexOf(k)

    if (!hasConnections) {
      const edgeIdx = idx('edge')
      const fromPortIdx = idx('fromport')
      const toPortIdx = idx('toport')
      const typeIdx = idx('type')
      const isEdgeTable = edgeIdx >= 0 && fromPortIdx >= 0 && toPortIdx >= 0 && typeIdx >= 0
      if (isEdgeTable) {
        for (let r = 0; r < rows.length; r += 1) {
          const row = rows[r] || []
          const id = stripAllBackticks(row[edgeIdx])
          const from = stripAllBackticks(row[fromPortIdx])
          const to = stripAllBackticks(row[toPortIdx])
          const socketType = stripAllBackticks(row[typeIdx])
          if (!id || !from || !to) continue
          const uniq = `${from}→${to}`
          if (seenConn.has(uniq)) continue
          seenConn.add(uniq)
          connections.push({ id, from, to, ...(socketType ? { type: socketType } : {}) })
        }
        continue
      }
    }

    if (!hasSocketTypes) {
      const typeIdx = idx('type')
      const colorIdx = (() => {
        const c1 = idx('colour')
        if (c1 >= 0) return c1
        return idx('color')
      })()
      const isSocketLegend = typeIdx >= 0 && colorIdx >= 0
      if (isSocketLegend) {
        for (let r = 0; r < rows.length; r += 1) {
          const row = rows[r] || []
          const typeId = stripAllBackticks(row[typeIdx])
          const color = parseHexColor(row[colorIdx])
          if (!typeId || !color) continue
          if (!Object.prototype.hasOwnProperty.call(socketTypes, typeId)) {
            socketTypes[typeId] = { color, accepts: [typeId] }
          }
        }
      }
    }
  }

  return { connections, socketTypes: Object.keys(socketTypes).length > 0 ? socketTypes : null }
}

function mergeFrontmatterMeta(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const k of Object.keys(b)) {
    const av = out[k]
    const bv = b[k]
    if (Array.isArray(av) && Array.isArray(bv)) {
      out[k] = [...av, ...bv]
      continue
    }
    if (isRecord(av) && isRecord(bv)) {
      out[k] = mergeFrontmatterMeta(av, bv)
      continue
    }
    out[k] = bv
  }
  return out
}

function findFrontmatterEndIndex(lines: string[], startDashLine: number): number {
  for (let i = startDashLine + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') return i
  }
  return -1
}

function parseInlineScalar(raw: string): unknown {
  const s = String(raw || '').trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  if (s === 'true') return true
  if (s === 'false') return false
  const n = Number(s)
  if (Number.isFinite(n) && String(n) === s) return n
  return s
}

function parseInlineObject(raw: string): Record<string, unknown> {
  const text = String(raw || '').trim()
  if (!text) return {}
  const pairs = text
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  const out: Record<string, unknown> = {}
  for (let i = 0; i < pairs.length; i += 1) {
    const part = pairs[i]
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (!key) continue
    out[key] = parseInlineScalar(val)
  }
  return out
}

function extractEdgesFromFrontmatterMermaidWiring(args: {
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
}): { edges: GraphEdge[]; edgeNodeIds: string[] } {
  const aliasToSigil = new Map<string, string>()
  const edgeNodeIds = new Set<string>()
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  const normalizeKindFromSigil = (sigil: string): 'node' | 'edge' | 'cluster' => {
    const s = String(sigil || '').trim()
    if (s.startsWith('@edge:')) return 'edge'
    if (s.startsWith('@cluster:')) return 'cluster'
    return 'node'
  }

  const resolveEndpoint = (raw: string): string => {
    const key = String(raw || '').trim()
    if (!key) return ''
    if (key.startsWith('@')) {
      const kind = normalizeKindFromSigil(key)
      return normalizeSigilId(key, kind)
    }
    const viaAlias = aliasToSigil.get(key)
    if (!viaAlias) return ''
    const kind = normalizeKindFromSigil(viaAlias)
    return normalizeSigilId(viaAlias, kind)
  }

  const addAliasFromSigilLine = (line: string) => {
    const trimmed = String(line || '').trim()
    if (!trimmed || trimmed.startsWith('%%')) return
    const subgraphMatch = /^subgraph\s+([A-Za-z0-9_.-]+).*"(@(?:node|edge|cluster):[^"·\s]+)[^"]*"/.exec(trimmed)
    if (subgraphMatch) {
      const alias = String(subgraphMatch[1] || '').trim()
      const sigilRaw = String(subgraphMatch[2] || '').trim()
      const sigil = normalizeSigilId(sigilRaw, normalizeKindFromSigil(sigilRaw))
      if (alias && sigil) aliasToSigil.set(alias, sigil)
      if (sigil.startsWith('@edge:')) edgeNodeIds.add(sigil)
      return
    }
    const nodeMatch = /^([A-Za-z0-9_.-]+)\s*.*"(@(?:node|edge|cluster):[^"·\s]+)[^"]*"/.exec(trimmed)
    if (!nodeMatch) return
    const alias = String(nodeMatch[1] || '').trim()
    const sigilRaw = String(nodeMatch[2] || '').trim()
    const sigil = normalizeSigilId(sigilRaw, normalizeKindFromSigil(sigilRaw))
    if (alias && sigil) aliasToSigil.set(alias, sigil)
    if (sigil.startsWith('@edge:')) edgeNodeIds.add(sigil)
  }

  for (let i = args.frontmatterStartLine + 1; i < args.frontmatterEndLineExclusive; i += 1) {
    addAliasFromSigilLine(args.lines[i] || '')
  }

  let edgeCounter = 0
  for (let i = args.frontmatterStartLine + 1; i < args.frontmatterEndLineExclusive; i += 1) {
    const raw = String(args.lines[i] || '')
    const line = raw.trim()
    if (!line || line.startsWith('%%')) continue
    if (!line.includes('-->')) continue
    const parts = line
      .split(/(-->\s*(?:\|[^|]*\|)?\s*)/g)
      .map(v => String(v || ''))
    const endpoints = parts
      .filter((_, idx) => idx % 2 === 0)
      .map(v => v.trim())
      .filter(Boolean)
    const labels = parts
      .filter((_, idx) => idx % 2 === 1)
      .map(token => {
        const m = /-->\s*(?:\|([^|]*)\|)?\s*/.exec(token)
        return String(m?.[1] || '').trim()
      })
    const partsCount = Math.min(endpoints.length - 1, labels.length)
    if (partsCount < 1) continue
    for (let j = 0; j < partsCount; j += 1) {
      const src = resolveEndpoint(endpoints[j] || '')
      const tgt = resolveEndpoint(endpoints[j + 1] || '')
      if (!src || !tgt || src === tgt) continue
      const edgeLabel = String(labels[j] || '').trim()
      const uniq = `${src}|${tgt}|${edgeLabel}|line:${i + 1}|idx:${j}`
      if (seen.has(uniq)) continue
      seen.add(uniq)
      const id = `fm-mmd-e${String(++edgeCounter).padStart(3, '0')}-${hashText(uniq)}`
      edges.push({
        id,
        source: src,
        target: tgt,
        label: edgeLabel,
        properties: {
          [FRONTMATTER_PRIMITIVE_KEY]: 'edge',
          'frontmatter:edgeSource': 'mermaid-wiring',
          'frontmatter:line': i + 1,
          ...(edgeLabel ? ({ 'frontmatter:displayLabel': edgeLabel } as unknown as Record<string, JSONValue>) : {}),
        },
      })
      if (src.startsWith('@edge:')) edgeNodeIds.add(src)
      if (tgt.startsWith('@edge:')) edgeNodeIds.add(tgt)
    }
  }

  return {
    edges,
    edgeNodeIds: Array.from(edgeNodeIds).sort((a, b) => a.localeCompare(b)),
  }
}

function tryParseSigilFrontmatter(lines: string[], startDashLine: number): { meta: Record<string, unknown>; startIndex: number } | null {
  const end = findFrontmatterEndIndex(lines, startDashLine)
  if (end < 0) return null
  const nodes: unknown[] = []
  const edges: Array<Record<string, unknown>> = []
  const clusters: Array<Record<string, unknown>> = []
  let section: '' | 'nodes' | 'edges' | 'clusters' = ''
  let currentEdge: Record<string, unknown> | null = null
  let currentCluster: { id: string; label?: string; color?: string; members: string[]; inMembers: boolean } | null = null
  for (let i = startDashLine + 1; i < end; i += 1) {
    const raw = String(lines[i] || '')
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (/^[A-Za-z0-9_-]+\s*:\s*$/.test(trimmed)) {
      const key = trimmed.slice(0, trimmed.indexOf(':')).trim().toLowerCase()
      if (key === 'nodes' || key === 'edges' || key === 'clusters') {
        if (currentEdge) {
          edges.push(currentEdge)
          currentEdge = null
        }
        if (currentCluster) {
          clusters.push({
            [currentCluster.id]: {
              ...(currentCluster.label ? { label: currentCluster.label } : {}),
              ...(currentCluster.color ? { color: currentCluster.color } : {}),
              ...(currentCluster.members.length > 0 ? { members: currentCluster.members } : {}),
            },
          })
          currentCluster = null
        }
        section = key
      } else {
        section = ''
      }
      continue
    }
    if (section === 'nodes') {
      const m = /^\s*-\s*(@node:[^:]+(?::[^:]+)*)\s*:\s*\{(.*)\}\s*$/.exec(raw)
      if (!m) continue
      const id = normalizeSigilId(m[1], 'node')
      if (!id) continue
      const attrs = parseInlineObject(m[2] || '')
      nodes.push({ [id]: attrs })
      continue
    }
    if (section === 'edges') {
      const start = /^\s*-\s*id\s*:\s*(.+)$/.exec(raw)
      if (start) {
        if (currentEdge) edges.push(currentEdge)
        currentEdge = { id: parseInlineScalar(start[1] || '') }
        continue
      }
      if (!currentEdge) continue
      const m = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/.exec(raw)
      if (!m) continue
      const key = String(m[1] || '').trim()
      if (!key) continue
      currentEdge[key] = parseInlineScalar(m[2] || '')
      continue
    }
    if (section === 'clusters') {
      const start = /^\s*-\s*(@cluster:[^:]+(?::[^:]+)*)\s*:\s*$/.exec(raw)
      if (start) {
        if (currentCluster) {
          clusters.push({
            [currentCluster.id]: {
              ...(currentCluster.label ? { label: currentCluster.label } : {}),
              ...(currentCluster.color ? { color: currentCluster.color } : {}),
              ...(currentCluster.members.length > 0 ? { members: currentCluster.members } : {}),
            },
          })
        }
        const id = normalizeSigilId(start[1], 'cluster')
        if (!id) {
          currentCluster = null
          continue
        }
        currentCluster = { id, members: [], inMembers: false }
        continue
      }
      if (!currentCluster) continue
      const membersHeader = /^\s*members\s*:\s*$/.exec(trimmed)
      if (membersHeader) {
        currentCluster.inMembers = true
        continue
      }
      if (currentCluster.inMembers) {
        const member = /^\s*-\s*(.+)$/.exec(trimmed)
        if (member) {
          const normalizedMember = normalizeSigilId(parseInlineScalar(member[1] || ''), 'node')
          if (normalizedMember) currentCluster.members.push(normalizedMember)
          continue
        }
      }
      const m = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/.exec(trimmed)
      if (!m) continue
      const key = String(m[1] || '').trim()
      const val = String(parseInlineScalar(m[2] || '') || '').trim()
      if (!key || !val) continue
      if (key === 'label') currentCluster.label = val
      if (key === 'color') currentCluster.color = val
    }
  }
  if (currentEdge) edges.push(currentEdge)
  if (currentCluster) {
    clusters.push({
      [currentCluster.id]: {
        ...(currentCluster.label ? { label: currentCluster.label } : {}),
        ...(currentCluster.color ? { color: currentCluster.color } : {}),
        ...(currentCluster.members.length > 0 ? { members: currentCluster.members } : {}),
      },
    })
  }
  if (nodes.length === 0 && edges.length === 0 && clusters.length === 0) return null
  const meta: Record<string, unknown> = {}
  if (nodes.length > 0) meta.nodes = nodes
  if (edges.length > 0) meta.edges = edges
  if (clusters.length > 0) meta.clusters = clusters
  return { meta, startIndex: end + 1 }
}

function tryParseMergedFrontmatterMetaWithNodes(lines: string[]): { meta: Record<string, unknown>; startIndex: number } | null {
  const dashIdx: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') dashIdx.push(i)
    if (dashIdx.length >= 10) break
  }
  if (dashIdx.length < 4) return null

  let merged: Record<string, unknown> = {}
  for (let seg = 0; seg < dashIdx.length - 1; seg += 1) {
    const a = dashIdx[seg] ?? -1
    const b = dashIdx[seg + 1] ?? -1
    if (a < 0 || b < 0) continue
    if (b <= a + 1) continue
    const segmentLines = ['---', ...lines.slice(a + 1, b), '---']
    const parsed = parseMarkdownFrontmatter(segmentLines).meta
    if (!isRecord(parsed)) continue
    merged = mergeFrontmatterMeta(merged, parsed)
    if (Array.isArray(merged.nodes) && merged.nodes.length > 0) {
      return { meta: merged, startIndex: b + 1 }
    }
  }
  return null
}

export function tryParseMarkdownFrontmatterFlowGraph(
  name: string,
  text: string,
): { graphData: GraphData; warnings: string[] } | null {
  const raw = String(text || '').replace(/^\uFEFF/, '')
  if (!raw.trimStart().startsWith('---')) return null

  const lines = splitMarkdownLines(raw)
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return null

  const initialSegment = lead > 0 ? lines.slice(lead) : lines
  const initial = parseMarkdownFrontmatter(initialSegment)
  const initialMeta = initial.meta
  if (!initialMeta || typeof initialMeta !== 'object' || Array.isArray(initialMeta)) return null
  let meta: Record<string, unknown> = initialMeta as Record<string, unknown>
  let startIndex = initial.startIndex + lead
  const initialNormalized = normalizeNodes(meta)
  if (!initialNormalized) {
    const merged = tryParseMergedFrontmatterMetaWithNodes(lines)
    if (merged) {
      meta = merged.meta
      startIndex = merged.startIndex
    }
  }
  if (!normalizeNodes(meta)) {
    const fallback = tryParseSigilFrontmatter(lines, lead)
    if (fallback) {
      meta = fallback.meta
      startIndex = fallback.startIndex
    }
  }

  const metaRecord = meta as Record<string, unknown>
  const extracted = extractConnectionsAndSocketTypesFromMarkdownTables({
    lines,
    startIndex,
    existingConnections: metaRecord.connections,
    existingSocketTypes: metaRecord.socket_types,
  })
  if ((!Array.isArray(metaRecord.connections) || metaRecord.connections.length === 0) && extracted.connections.length > 0) {
    metaRecord.connections = extracted.connections
  }
  if ((!isRecord(metaRecord.socket_types) || Object.keys(metaRecord.socket_types).length === 0) && extracted.socketTypes) {
    metaRecord.socket_types = extracted.socketTypes
  }

  const normalized = normalizeNodes(meta)
  if (!normalized) return null

  const annotations = extractFrontmatterBodyAnnotations(lines, startIndex)
  const mermaidWiring = extractEdgesFromFrontmatterMermaidWiring({
    lines,
    frontmatterStartLine: lead,
    frontmatterEndLineExclusive: startIndex - 1,
  })
  const knownNodeIds = new Set<string>()
  for (let i = 0; i < normalized.nodes.length; i += 1) {
    const id = asString(normalized.nodes[i]?.id)
    if (id) knownNodeIds.add(id)
  }
  for (let i = 0; i < annotations.nodeIds.length; i += 1) {
    const id = annotations.nodeIds[i]
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    normalized.nodes.push({
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
  for (let i = 0; i < annotations.clusterIds.length; i += 1) {
    const id = annotations.clusterIds[i]
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    normalized.nodes.push({
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
  for (let i = 0; i < mermaidWiring.edgeNodeIds.length; i += 1) {
    const id = mermaidWiring.edgeNodeIds[i]
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    normalized.nodes.push({
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

  const clusters = normalizeClusters(meta, normalized.nodes)
  for (let i = 0; i < clusters.clusterNodes.length; i += 1) {
    const n = clusters.clusterNodes[i]
    const id = asString(n.id)
    if (!id || knownNodeIds.has(id)) continue
    knownNodeIds.add(id)
    normalized.nodes.push(n)
  }

  const connParsed = parseConnections(meta)
  ensureAugmentedPortsFromDeclaredConnections({ nodes: normalized.nodes, registry: normalized.registry, declared: connParsed.declared })
  const edgesFromConnections = connParsed.edges
  const sigilEdges = normalizeEdgesFromSigilSpecs({
    meta,
    nodeIds: Array.from(knownNodeIds),
  })
  const rawNodes = Array.isArray((meta as Record<string, unknown>).nodes) ? ((meta as Record<string, unknown>).nodes as unknown[]) : []
  const nodeInputEdges = normalizeEdgesFromNodeInputs(rawNodes as Record<string, unknown>[])
  const baseEdges = edgesFromConnections.length > 0 ? edgesFromConnections : nodeInputEdges
  const edges = (() => {
    if (mermaidWiring.edges.length > 0) return mermaidWiring.edges
    if (sigilEdges.length === 0) return baseEdges
    if (baseEdges.length === 0) return sigilEdges
    const out: GraphEdge[] = [...baseEdges]
    const uniq = new Set<string>()
    for (let i = 0; i < baseEdges.length; i += 1) {
      const e = baseEdges[i]
      uniq.add(`${asString(e.source)}|${asString(e.target)}|${asString(e.label)}`)
    }
    for (let i = 0; i < sigilEdges.length; i += 1) {
      const e = sigilEdges[i]
      const k = `${asString(e.source)}|${asString(e.target)}|${asString(e.label)}`
      if (uniq.has(k)) continue
      uniq.add(k)
      out.push(e)
    }
    return out
  })()
  const subgraphsBase = normalizeSubgraphsFromFrontmatter({ meta, rawNodes }) || []
  const subgraphs = (() => {
    if (clusters.subgraphs.length === 0) return subgraphsBase
    const out = [...subgraphsBase]
    const seen = new Set<string>()
    for (let i = 0; i < out.length; i += 1) {
      const id = asString(out[i]?.id)
      if (id) seen.add(id)
    }
    for (let i = 0; i < clusters.subgraphs.length; i += 1) {
      const row = clusters.subgraphs[i]
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
    return out
  })()

  const frontmatterMeta = isRecord(meta.meta) ? (meta.meta as Record<string, unknown>) : null
  const stableId = asString(frontmatterMeta?.id) || cleanIdPart(name) || 'frontmatter'
  const sourceLayerHash = hashText(`frontmatter-flow|${stableId}`)

  const warnings: string[] = []
  const socketTypes = isRecord(meta.socket_types) ? (meta.socket_types as Record<string, unknown>) : null

  const declared = connParsed.declared
  if (declared.length > 0) {
    const declaredPortTypes = collectDeclaredPortTypes(meta)
    const inputs = collectNodeInputConnections(meta)
    const declaredSet = new Set<string>()
    for (let i = 0; i < declared.length; i += 1) {
      const d = declared[i]
      declaredSet.add(d.uniq)
      if (!d.socketType) {
        warnings.push(`Untyped connection: ${d.source}.${d.fromPort} → ${d.target}.${d.toPort}`)
      } else if (socketTypes && !Object.prototype.hasOwnProperty.call(socketTypes, d.socketType)) {
        warnings.push(`Unknown socket type "${d.socketType}" on connection: ${d.source}.${d.fromPort} → ${d.target}.${d.toPort}`)
      } else {
        const outType = declaredPortTypes.outputTypeByNodeId[d.source]?.[d.fromPort] || ''
        const inType = declaredPortTypes.inputTypeByNodeId[d.target]?.[d.toPort] || ''
        if (!outType) {
          warnings.push(`Connection source port missing type: ${d.source}.${d.fromPort}`)
        } else if (outType !== d.socketType) {
          warnings.push(`Connection type mismatch at source port: ${d.source}.${d.fromPort} expected ${outType} got ${d.socketType}`)
        }
        if (!inType) {
          warnings.push(`Connection target port missing type: ${d.target}.${d.toPort}`)
        } else if (inType !== d.socketType) {
          warnings.push(`Connection type mismatch at target port: ${d.target}.${d.toPort} expected ${inType} got ${d.socketType}`)
        }
      }
    }
    for (const uniq of inputs) {
      if (!declaredSet.has(uniq)) warnings.push(`Missing connection for node input: ${uniq}`)
    }
    for (const uniq of declaredSet) {
      if (!inputs.has(uniq)) warnings.push(`Connection not mirrored in node inputs: ${uniq}`)
    }
  }

  const rawNodesForPos = Array.isArray(meta.nodes) ? (meta.nodes as unknown[]) : []
  const hasAnyPos = (() => {
    for (let i = 0; i < rawNodesForPos.length; i += 1) {
      const row = coerceFrontmatterNodeRecord(rawNodesForPos[i])
      if (!row) continue
      const pos = isRecord(row.pos) ? row.pos : null
      const x = pos ? asFiniteNumber(pos.x) : asFiniteNumber((row as Record<string, unknown>).pos_x)
      const y = pos ? asFiniteNumber(pos.y) : asFiniteNumber((row as Record<string, unknown>).pos_y)
      if (x != null || y != null) return true
    }
    return false
  })()
  if (hasAnyPos) {
    for (let i = 0; i < rawNodesForPos.length; i += 1) {
      const row = coerceFrontmatterNodeRecord(rawNodesForPos[i])
      if (!row) continue
      const id = asString(row.id)
      if (!id) continue
      const pos = isRecord(row.pos) ? row.pos : null
      const x = pos ? asFiniteNumber(pos.x) : asFiniteNumber((row as Record<string, unknown>).pos_x)
      const y = pos ? asFiniteNumber(pos.y) : asFiniteNumber((row as Record<string, unknown>).pos_y)
      if (x == null || y == null) warnings.push(`Node missing pos: ${id}`)
    }
  }

  const metadata: Record<string, JSONValue> = {
    kind: 'frontmatter-flow',
    sourceLayerHash,
    ...(frontmatterMeta ? ({ frontmatterMeta: frontmatterMeta as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(socketTypes ? ({ socketTypes: meta.socket_types as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
    ...(annotations.refs.length > 0
      ? ({
          [FRONTMATTER_ANNOTATION_WIRING_KEY]: {
            refs: annotations.refs,
            nodeIds: annotations.nodeIds,
            edgeIds: annotations.edgeIds,
            clusterIds: annotations.clusterIds,
          } as unknown as JSONValue,
        } as unknown as Record<string, JSONValue>)
      : {}),
    ...(normalized.registry.length > 0
      ? ({ [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: normalized.registry as unknown as JSONValue } as unknown as Record<string, JSONValue>)
      : {}),
    ...(subgraphs && subgraphs.length > 0 ? ({ [KG_SUBGRAPHS_KEY]: subgraphs as unknown as JSONValue } as unknown as Record<string, JSONValue>) : {}),
  }

  const graphData: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: normalized.nodes,
    edges,
    metadata,
  }

  warnings.sort((a, b) => a.localeCompare(b))
  return { graphData, warnings }
}
