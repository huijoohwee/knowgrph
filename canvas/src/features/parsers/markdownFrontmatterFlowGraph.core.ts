import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { splitMarkdownLines, parseMarkdownFrontmatter } from '@/lib/markdown'
import { hashText } from '@/features/parsers/hash'
import {
  FRONTMATTER_FLOW_WARNINGS_KEY,
  normalizeMetaWithFlowBlock,
  repairFlowInlineEnvelopeBlockScalars,
  tryParseFlowBlockFromFrontmatterLines,
  tryParseFlowBlockFromMarkdownBodyLines,
} from '@/features/parsers/markdownFrontmatterFlowGraph.flowBlock'
import {
  buildConnectionWarnings,
  ensureAugmentedPortsFromDeclaredConnections,
  extractConnectionsAndSocketTypesFromMarkdownTables,
  normalizeEdgesFromNodeInputs,
  parseConnections,
} from '@/features/parsers/markdownFrontmatterFlowGraph.connections'
import {
  extractEdgesFromFrontmatterMermaidWiring,
  extractFrontmatterBodyAnnotations,
  normalizeEdgesFromSigilSpecs,
  tryParseMergedFrontmatterMetaWithNodes,
  tryParseSigilFrontmatter,
} from '@/features/parsers/markdownFrontmatterFlowGraph.sigil'
import {
  collectNodePositionWarnings,
  normalizeClusters,
  normalizeNodes,
  normalizeSubgraphsFromFrontmatter,
} from '@/features/parsers/markdownFrontmatterFlowGraph.nodes'
import {
  appendAnnotationNodes,
  buildFrontmatterFlowMetadata,
  mergeEdges,
  mergeSubgraphs,
  readSocketTypes,
} from '@/features/parsers/markdownFrontmatterFlowGraph.compose'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isChatKnowgrphDoc(meta: Record<string, unknown>): boolean {
  const topType = asString(meta.type).toLowerCase()
  if (topType === 'chatknowgrph') return true
  const doc = meta.doc
  if (!isRecord(doc)) return false
  const docType = asString(doc.type).toLowerCase()
  return docType === 'chatknowgrph'
}

function isChatKnowgrphFrontmatterText(args: {
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
}): boolean {
  const lines = Array.isArray(args.lines) ? args.lines : []
  const start = Math.max(0, Math.floor(args.frontmatterStartLine))
  const endExclusive = Math.min(lines.length, Math.max(start, Math.floor(args.frontmatterEndLineExclusive)))
  if (endExclusive <= start) return false
  for (let i = start; i < endExclusive; i += 1) {
    const line = String(lines[i] || '').trim()
    if (!line || line.startsWith('#')) continue
    if (/^type\s*:\s*["']?chatknowgrph["']?\s*$/i.test(line)) return true
  }
  return false
}

function cleanIdPart(v: unknown): string {
  return String(typeof v === 'string' ? v : '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

function readFrontmatterFlowDirection(metaRecord: Record<string, unknown>): 'LR' | 'RL' | 'TB' | 'BT' {
  const settings = isRecord(metaRecord.frontmatterFlowSettings)
    ? (metaRecord.frontmatterFlowSettings as Record<string, unknown>)
    : null
  const raw = settings ? asString(settings.direction).toUpperCase() : ''
  return raw === 'RL' || raw === 'TB' || raw === 'BT' ? raw : 'LR'
}

function shouldSeedBalancedNodeLayout(nodes: ReadonlyArray<GraphNode>): boolean {
  if (!Array.isArray(nodes) || nodes.length === 0) return false
  const seen = new Set<string>()
  let missing = false
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const props = isRecord(node?.properties) ? (node.properties as Record<string, unknown>) : null
    if (props?.['frontmatter:autoSeededPos'] === true) return true
    const x = typeof node?.x === 'number' && Number.isFinite(node.x) ? node.x : null
    const y = typeof node?.y === 'number' && Number.isFinite(node.y) ? node.y : null
    if (x == null || y == null) {
      missing = true
      continue
    }
    const key = `${Math.round(x)}:${Math.round(y)}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return missing
}

function assignBalancedViewportSpread(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  direction: 'LR' | 'RL' | 'TB' | 'BT'
}): GraphNode[] {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  if (nodes.length === 0) return nodes
  const nodeIds = new Set<string>()
  const indegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  const rank = new Map<string, number>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = asString(nodes[i]?.id)
    if (!id) continue
    nodeIds.add(id)
    indegree.set(id, 0)
    outgoing.set(id, [])
    rank.set(id, 0)
  }
  for (let i = 0; i < args.edges.length; i += 1) {
    const edge = args.edges[i]
    const source = asString(edge?.source)
    const target = asString(edge?.target)
    if (!source || !target || source === target || !nodeIds.has(source) || !nodeIds.has(target)) continue
    outgoing.get(source)?.push(target)
    indegree.set(target, (indegree.get(target) || 0) + 1)
  }
  const queue = Array.from(nodeIds).filter(id => (indegree.get(id) || 0) === 0).sort((a, b) => a.localeCompare(b))
  while (queue.length > 0) {
    const id = queue.shift()!
    const neighbors = outgoing.get(id) || []
    for (let i = 0; i < neighbors.length; i += 1) {
      const target = neighbors[i]!
      rank.set(target, Math.max(rank.get(target) || 0, (rank.get(id) || 0) + 1))
      const nextIn = (indegree.get(target) || 0) - 1
      indegree.set(target, nextIn)
      if (nextIn === 0) {
        queue.push(target)
        queue.sort((a, b) => a.localeCompare(b))
      }
    }
  }

  const buckets = new Map<number, GraphNode[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!
    const bucket = rank.get(asString(node.id)) || 0
    const list = buckets.get(bucket) || []
    list.push(node)
    buckets.set(bucket, list)
  }
  const bucketIds = Array.from(buckets.keys()).sort((a, b) => a - b)
  const STEP_X = 380
  const STEP_Y = 240
  const out: GraphNode[] = []
  for (let bi = 0; bi < bucketIds.length; bi += 1) {
    const bucket = bucketIds[bi]!
    const group = (buckets.get(bucket) || []).slice().sort((a, b) => {
      const typeCompare = asString(a.type).localeCompare(asString(b.type))
      if (typeCompare !== 0) return typeCompare
      return asString(a.id).localeCompare(asString(b.id))
    })
    const centerOffset = (group.length - 1) / 2
    for (let gi = 0; gi < group.length; gi += 1) {
      const node = group[gi]!
      const props = isRecord(node.properties)
        ? ({ ...(node.properties as Record<string, JSONValue>) } as Record<string, JSONValue>)
        : ({} as Record<string, JSONValue>)
      const primary = bucket * STEP_X
      const secondary = Math.round((gi - centerOffset) * STEP_Y)
      let x = primary
      let y = secondary
      if (args.direction === 'RL') x = -primary
      if (args.direction === 'TB' || args.direction === 'BT') {
        x = secondary
        y = primary
      }
      if (args.direction === 'BT') y = -primary
      if (typeof props['visual:xIndex'] === 'undefined') props['visual:xIndex'] = Math.floor(x / 320) as unknown as JSONValue
      if (typeof props['visual:yIndex'] === 'undefined') props['visual:yIndex'] = Math.floor(y / 220) as unknown as JSONValue
      if (typeof props['visual:zIndex'] === 'undefined') props['visual:zIndex'] = bucket as unknown as JSONValue
      if (props['frontmatter:autoSeededPos'] === true) delete props['frontmatter:autoSeededPos']
      out.push({ ...node, x, y, properties: props })
    }
  }
  return out
}

function readFlowWarnings(metaRecord: Record<string, unknown>): string[] {
  const raw = metaRecord[FRONTMATTER_FLOW_WARNINGS_KEY]
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const warning = asString(raw[i])
    if (!warning) continue
    out.push(warning)
  }
  return out
}

function countIndent(rawLine: string): number {
  let i = 0
  while (i < rawLine.length && rawLine[i] === ' ') i += 1
  return i
}

function coerceFrontmatterScalar(raw: string): unknown {
  const value = String(raw || '').trim()
  if (!value) return ''
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  const lower = value.toLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  if (lower === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

function stripYamlInlineComment(raw: string): string {
  const src = String(raw || '')
  if (!src.includes('#')) return src
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }
    if (ch === '"' && !inSingle) {
      const prev = i > 0 ? src[i - 1] : ''
      if (prev !== '\\') inDouble = !inDouble
      continue
    }
    if (ch === '#' && !inSingle && !inDouble) {
      const prev = i > 0 ? src[i - 1] : ''
      if (!prev || /\s/.test(prev)) return src.slice(0, i).trimEnd()
    }
  }
  return src
}

function readFrontmatterScalarFallback(args: {
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const lines = Array.isArray(args.lines) ? args.lines : []
  const start = Math.max(0, Math.floor(args.frontmatterStartLine))
  const endExclusive = Math.min(lines.length, Math.max(start, Math.floor(args.frontmatterEndLineExclusive)))
  for (let i = start; i < endExclusive; i += 1) {
    const rawLine = String(lines[i] || '')
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (countIndent(rawLine) !== 0) continue
    const m = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(trimmed)
    if (!m) continue
    const key = asString(m[1])
    if (!key || Object.prototype.hasOwnProperty.call(out, key)) continue
    const rawValue = stripYamlInlineComment(String(m[2] || ''))
    const value = rawValue.trim()
    if (!value || value === '|' || value === '>') continue
    out[key] = coerceFrontmatterScalar(value)
  }
  return out
}

function buildSourceFrontmatterMeta(meta: Record<string, unknown>): Record<string, unknown> | null {
  if (!isRecord(meta)) return null
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    const k = asString(key)
    if (!k) continue
    if (k === 'nodes' || k === 'connections' || k === 'socket_types') continue
    if (k === 'frontmatterFlowSettings' || k === 'frontmatterFlowWarnings') continue
    if (k === 'frontmatter:chatKnowgrphRelaxed') continue
    out[k] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

function readFrontmatterStableId(frontmatterMeta: Record<string, unknown> | null, fallbackName: string): string {
  const id = asString(frontmatterMeta?.id)
  if (id) return id
  const graphId = asString(frontmatterMeta?.graphId)
  if (graphId) return graphId
  return cleanIdPart(fallbackName) || 'frontmatter'
}

function readTopLevelFrontmatterSectionValue(args: {
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
  key: 'runtime' | 'pipeline' | 'mermaid' | 'flow'
}): unknown {
  const lines = Array.isArray(args.lines) ? args.lines : []
  const start = Math.max(0, Math.floor(args.frontmatterStartLine))
  const endExclusive = Math.min(lines.length, Math.max(start, Math.floor(args.frontmatterEndLineExclusive)))
  if (endExclusive <= start) return undefined
  let sectionStart = -1
  for (let i = start; i < endExclusive; i += 1) {
    const raw = String(lines[i] || '')
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (countIndent(raw) !== 0) continue
    if (trimmed.startsWith(`${args.key}:`)) {
      sectionStart = i
      break
    }
  }
  if (sectionStart < 0) return undefined
  let sectionEnd = endExclusive
  for (let i = sectionStart + 1; i < endExclusive; i += 1) {
    const raw = String(lines[i] || '')
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (countIndent(raw) !== 0) continue
    if (/^[A-Za-z0-9_.-]+\s*:/.test(trimmed)) {
      sectionEnd = i
      break
    }
  }
  const synthetic = ['---', ...lines.slice(sectionStart, sectionEnd), '---']
  try {
    const parsed = parseMarkdownFrontmatter(synthetic)
    const meta = parsed.meta
    if (!isRecord(meta)) return undefined
    return (meta as Record<string, unknown>)[args.key]
  } catch {
    return undefined
  }
}

function enrichSourceFrontmatterMetaFromRawLines(args: {
  sourceFrontmatterMeta: Record<string, unknown> | null
  lines: string[]
  frontmatterStartLine: number
  frontmatterEndLineExclusive: number
}): Record<string, unknown> | null {
  const base = isRecord(args.sourceFrontmatterMeta) ? { ...args.sourceFrontmatterMeta } : {}
  const keys: Array<'runtime' | 'pipeline' | 'mermaid' | 'flow'> = ['runtime', 'pipeline', 'mermaid', 'flow']
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]
    if (typeof base[key] !== 'undefined') continue
    const value = readTopLevelFrontmatterSectionValue({
      lines: args.lines,
      frontmatterStartLine: args.frontmatterStartLine,
      frontmatterEndLineExclusive: args.frontmatterEndLineExclusive,
      key,
    })
    if (typeof value === 'undefined') continue
    base[key] = value
  }
  return Object.keys(base).length > 0 ? base : null
}

export function tryParseMarkdownFrontmatterFlowGraph(
  name: string,
  text: string,
): { graphData: GraphData; warnings: string[] } | null {
  const raw = repairFlowInlineEnvelopeBlockScalars(String(text || '').replace(/^\uFEFF/, ''))
  if (!raw.trimStart().startsWith('---')) {
    const lines = splitMarkdownLines(raw)
    const flowFromBody = tryParseFlowBlockFromMarkdownBodyLines({ lines })
    if (!flowFromBody) return null

    const metaRecord = normalizeMetaWithFlowBlock({ flow: flowFromBody } as Record<string, unknown>)
    const normalized = normalizeNodes(metaRecord)
    if (!normalized) return null

    const connParsed = parseConnections(metaRecord)
    ensureAugmentedPortsFromDeclaredConnections({ nodes: normalized.nodes, registry: normalized.registry, declared: connParsed.declared })

    const edges = connParsed.edges
    const layoutedNodes = shouldSeedBalancedNodeLayout(normalized.nodes)
      ? assignBalancedViewportSpread({
          nodes: normalized.nodes,
          edges,
          direction: readFrontmatterFlowDirection(metaRecord),
        })
      : normalized.nodes
    const frontmatterMeta = buildSourceFrontmatterMeta(metaRecord)
    const stableId = readFrontmatterStableId(frontmatterMeta, name)
    const sourceLayerHash = hashText(`frontmatter-flow|${stableId}`)
    const socketTypes = readSocketTypes(metaRecord)
    const warnings = [...readFlowWarnings(metaRecord), ...buildConnectionWarnings({ meta: metaRecord, socketTypes, declared: connParsed.declared })]
    const flowSettings = isRecord(metaRecord.frontmatterFlowSettings) ? (metaRecord.frontmatterFlowSettings as Record<string, unknown>) : null
    const metadata = buildFrontmatterFlowMetadata({
      sourceLayerHash,
      frontmatterMeta,
      socketTypes,
      flowSettings,
      annotations: { refs: [], nodeIds: [], edgeIds: [], clusterIds: [] },
      registry: normalized.registry,
      subgraphs: [],
    })

    warnings.sort((a, b) => a.localeCompare(b))
    return {
      graphData: {
        type: 'Graph',
        context: 'frontmatter-flow',
        nodes: layoutedNodes,
        edges,
        metadata,
      },
      warnings,
    }
  }

  const lines = splitMarkdownLines(raw)
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return null
  let frontmatterClose = -1
  for (let i = lead + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') {
      frontmatterClose = i
      break
    }
  }
  if (frontmatterClose < 0) return null

  const initialSegment = lines.slice(lead, frontmatterClose + 1)
  const initial = parseMarkdownFrontmatter(initialSegment)
  const initialMeta = initial.meta
  let meta: Record<string, unknown> = {}
  let startIndex = frontmatterClose + 1
  if (initialMeta && typeof initialMeta === 'object' && !Array.isArray(initialMeta)) {
    meta = initialMeta as Record<string, unknown>
  }
  const hasFlowBlock = isRecord((meta as Record<string, unknown>).flow)
  const initialNormalized = normalizeNodes(hasFlowBlock ? normalizeMetaWithFlowBlock(meta) : meta)
  if (!initialNormalized) {
    if (!hasFlowBlock) {
      const merged = tryParseMergedFrontmatterMetaWithNodes(lines)
      if (merged) {
        meta = merged.meta
        startIndex = merged.startIndex
      }
    }
  }
  if (!normalizeNodes(hasFlowBlock ? normalizeMetaWithFlowBlock(meta) : meta) && !hasFlowBlock) {
    const fallback = tryParseSigilFrontmatter(lines, lead)
    if (fallback) {
      meta = fallback.meta
      startIndex = fallback.startIndex
    }
  }

  const flowFallback = tryParseFlowBlockFromFrontmatterLines({
    lines,
    frontmatterStartLine: lead + 1,
    frontmatterEndLineExclusive: frontmatterClose + 1,
  })
  const metaWithFlowFallback =
    !isRecord((meta as Record<string, unknown>).flow) && flowFallback
      ? { ...meta, flow: flowFallback }
      : meta
  const scalarFallback = readFrontmatterScalarFallback({
    lines,
    frontmatterStartLine: lead + 1,
    frontmatterEndLineExclusive: frontmatterClose + 1,
  })
  const metaWithScalarFallback = { ...scalarFallback, ...metaWithFlowFallback }
  const chatKnowgrphDoc =
    isChatKnowgrphDoc(metaWithScalarFallback) ||
    isChatKnowgrphFrontmatterText({
      lines,
      frontmatterStartLine: lead + 1,
      frontmatterEndLineExclusive: frontmatterClose + 1,
    })
  const metaForNormalization = chatKnowgrphDoc
    ? ({ ...metaWithScalarFallback, 'frontmatter:chatKnowgrphRelaxed': true } as Record<string, unknown>)
    : metaWithScalarFallback

  const metaRecord = normalizeMetaWithFlowBlock(metaForNormalization as Record<string, unknown>)
  const sourceFrontmatterMeta = enrichSourceFrontmatterMetaFromRawLines({
    sourceFrontmatterMeta: buildSourceFrontmatterMeta(metaWithScalarFallback),
    lines,
    frontmatterStartLine: lead + 1,
    frontmatterEndLineExclusive: frontmatterClose,
  })
  const extracted = chatKnowgrphDoc
    ? { connections: [], socketTypes: null as Record<string, unknown> | null }
    : extractConnectionsAndSocketTypesFromMarkdownTables({
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

  const normalized = normalizeNodes(metaRecord)
  if (!normalized) return null

  const hasFlowDerivedNodes = isRecord(metaRecord.flow)
  const annotations = chatKnowgrphDoc || hasFlowDerivedNodes
    ? { refs: [], nodeIds: [], edgeIds: [], clusterIds: [] }
    : extractFrontmatterBodyAnnotations(lines, startIndex)
  const mermaidWiring = hasFlowDerivedNodes
    ? { edges: [], edgeNodeIds: [] as string[] }
    : extractEdgesFromFrontmatterMermaidWiring({
        lines,
        frontmatterStartLine: lead,
        frontmatterEndLineExclusive: startIndex - 1,
      })
  const knownNodeIds = appendAnnotationNodes({
    nodes: normalized.nodes,
    annotations,
    mermaidEdgeNodeIds: mermaidWiring.edgeNodeIds,
  })

  const clusters = hasFlowDerivedNodes
    ? { clusterNodes: [], subgraphs: [] as Array<Record<string, unknown>> }
    : normalizeClusters(metaRecord, normalized.nodes)
  if (!hasFlowDerivedNodes) {
    for (let i = 0; i < clusters.clusterNodes.length; i += 1) {
      const n = clusters.clusterNodes[i]
      const id = asString(n.id)
      if (!id || knownNodeIds.has(id)) continue
      knownNodeIds.add(id)
      normalized.nodes.push(n)
    }
  }

  const connParsed = parseConnections(metaRecord)
  ensureAugmentedPortsFromDeclaredConnections({ nodes: normalized.nodes, registry: normalized.registry, declared: connParsed.declared })
  const edgesFromConnections = connParsed.edges
  const sigilEdges = chatKnowgrphDoc || hasFlowDerivedNodes
    ? []
    : normalizeEdgesFromSigilSpecs({
        meta: metaRecord,
        nodeIds: Array.from(knownNodeIds),
      })
  const rawNodes = Array.isArray(metaRecord.nodes) ? (metaRecord.nodes as unknown[]) : []
  const nodeInputEdges = normalizeEdgesFromNodeInputs(rawNodes as Record<string, unknown>[])
  const baseEdges = edgesFromConnections.length > 0 ? edgesFromConnections : nodeInputEdges
  const edges = mergeEdges({
    mermaidEdges: mermaidWiring.edges,
    baseEdges,
    sigilEdges,
  })
  const layoutedNodes = shouldSeedBalancedNodeLayout(normalized.nodes)
    ? assignBalancedViewportSpread({
        nodes: normalized.nodes,
        edges,
        direction: readFrontmatterFlowDirection(metaRecord),
      })
    : normalized.nodes
  const subgraphsBase = normalizeSubgraphsFromFrontmatter({ meta: metaRecord, rawNodes }) || []
  const mergedSubgraphs = mergeSubgraphs({
    baseSubgraphs: subgraphsBase,
    clusterSubgraphs: clusters.subgraphs,
  })
  const subgraphs = mergedSubgraphs

  const stableId = readFrontmatterStableId(sourceFrontmatterMeta, name)
  const sourceLayerHash = hashText(`frontmatter-flow|${stableId}`)

  const socketTypes = readSocketTypes(metaRecord)
  const warnings = [
    ...readFlowWarnings(metaRecord),
    ...buildConnectionWarnings({
      meta: metaRecord,
      socketTypes,
      declared: connParsed.declared,
    }),
    ...collectNodePositionWarnings(rawNodes),
  ]
  const flowSettings = isRecord(metaRecord.frontmatterFlowSettings) ? (metaRecord.frontmatterFlowSettings as Record<string, unknown>) : null
  const metadata = buildFrontmatterFlowMetadata({
    sourceLayerHash,
    frontmatterMeta: sourceFrontmatterMeta,
    socketTypes,
    flowSettings,
    annotations,
    registry: normalized.registry,
    subgraphs,
  })

  const graphData: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: layoutedNodes,
    edges,
    metadata,
  }

  warnings.sort((a, b) => a.localeCompare(b))
  return { graphData, warnings }
}
