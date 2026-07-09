import { hashText } from '@/features/parsers/hash'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { readNodeProperties, unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'

export const PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND = 'storyboard-probe-tree-flowchart/v1' as const

const PROBE_EDGE_LABELS = new Set(['candidateoption', 'branches-to', 'branchesto'])
const MERMAID_ID_RX = /^[A-Za-z0-9_:-]+$/

const cleanText = (value: unknown, maxLength = 96): string => {
  const unwrapped = unwrapGraphCellValue(value)
  const text = String(unwrapped ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text
}

const escapeMermaidLabel = (value: string): string => (
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\|/g, '/')
)

const readNodeLabel = (node: GraphNode): string => {
  const properties = readNodeProperties(node)
  return (
    cleanText(properties.title)
    || cleanText(node.label)
    || cleanText(properties.label)
    || cleanText(node.id)
    || 'Storyboard card'
  )
}

const readEdgeLabel = (edge: GraphEdge): string => (
  cleanText(edge.label, 48)
  || cleanText(((edge.properties || {}) as Record<string, unknown>)['frontmatter:displayLabel'], 48)
  || 'branches-to'
)

const isProbeTreeEdge = (edge: GraphEdge): boolean => {
  const label = readEdgeLabel(edge).toLowerCase()
  if (PROBE_EDGE_LABELS.has(label)) return true
  const properties = (edge.properties || {}) as Record<string, unknown>
  return PROBE_EDGE_LABELS.has(cleanText(properties['frontmatter:rel']).toLowerCase())
}

const makeMermaidNodeId = (nodeId: string, used: Set<string>): string => {
  const direct = cleanText(nodeId, 140)
  const base = direct && MERMAID_ID_RX.test(direct)
    ? direct
    : `node_${hashText(direct || 'node').slice(0, 12)}`
  let candidate = base
  let index = 2
  while (used.has(candidate)) {
    candidate = `${base}_${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

const collectReachableProbeNodeIds = (args: {
  rootNodeId: string
  edges: readonly GraphEdge[]
}): Set<string> => {
  const reachable = new Set<string>([args.rootNodeId])
  let changed = true
  while (changed) {
    changed = false
    args.edges.forEach(edge => {
      const source = cleanText(edge.source, 140)
      const target = cleanText(edge.target, 140)
      if (!source || !target || !reachable.has(source) || reachable.has(target)) return
      reachable.add(target)
      changed = true
    })
  }
  return reachable
}

export function buildProbeTreeStoryboardMermaidFlowchart(args: {
  graphData: GraphData | null | undefined
  rootNodeId?: string | null
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
}): string {
  const graphData = args.graphData
  const sourceNodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const sourceEdges = (Array.isArray(graphData?.edges) ? graphData.edges : []).filter(isProbeTreeEdge)
  const nodeEntries: Array<[string, GraphNode]> = []
  sourceNodes.forEach(node => {
    const id = cleanText(node.id, 140)
    if (id) nodeEntries.push([id, node])
  })
  const nodeById = new Map<string, GraphNode>(nodeEntries)
  const rootNodeId = cleanText(args.rootNodeId, 140)
  const includedIds = rootNodeId
    ? collectReachableProbeNodeIds({ rootNodeId, edges: sourceEdges })
    : new Set<string>()
  if (!rootNodeId) {
    sourceEdges.forEach(edge => {
      const source = cleanText(edge.source, 140)
      const target = cleanText(edge.target, 140)
      if (source) includedIds.add(source)
      if (target) includedIds.add(target)
    })
  }
  const nodes = Array.from(includedIds)
    .map(id => nodeById.get(id) || null)
    .filter(Boolean) as GraphNode[]
  if (nodes.length === 0) return `flowchart ${args.direction || 'TB'}`

  const usedMermaidIds = new Set<string>()
  const mermaidIdByNodeId = new Map<string, string>()
  nodes.forEach(node => mermaidIdByNodeId.set(cleanText(node.id, 140), makeMermaidNodeId(cleanText(node.id, 140), usedMermaidIds)))

  const lines = [
    `flowchart ${args.direction || 'TB'}`,
    `  %% kind: ${PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND}`,
  ]
  nodes.forEach(node => {
    const nodeId = cleanText(node.id, 140)
    const mermaidId = mermaidIdByNodeId.get(nodeId)
    if (!mermaidId) return
    if (mermaidId !== nodeId) lines.push(`  %% kg:node ${mermaidId} ${encodeURIComponent(nodeId)}`)
    lines.push(`  ${mermaidId}["${escapeMermaidLabel(readNodeLabel(node))}"]`)
  })

  sourceEdges.forEach(edge => {
    const source = mermaidIdByNodeId.get(cleanText(edge.source, 140))
    const target = mermaidIdByNodeId.get(cleanText(edge.target, 140))
    if (!source || !target) return
    lines.push(`  ${source} -->|${escapeMermaidLabel(readEdgeLabel(edge))}| ${target}`)
  })

  lines.push(
    '  classDef probeRoot fill:#f7f9fc,stroke:#4b657a,color:#17212b',
    '  classDef probeCandidate fill:#eef6f1,stroke:#2f7d4f,color:#163822',
    '  classDef probeTerminal fill:#f7f2ea,stroke:#9b6a20,color:#33210a',
  )
  if (rootNodeId) lines.push(`  class ${mermaidIdByNodeId.get(rootNodeId) || rootNodeId} probeRoot`)
  const candidateIds = nodes
    .filter(node => cleanText(node.type).toLowerCase().includes('probe'))
    .map(node => mermaidIdByNodeId.get(cleanText(node.id, 140)))
    .filter(Boolean)
  if (candidateIds.length > 0) lines.push(`  class ${candidateIds.join(',')} probeCandidate`)
  return lines.join('\n')
}

const readAliasMap = (mermaid: string): Map<string, string> => {
  const out = new Map<string, string>()
  String(mermaid || '').split('\n').forEach(line => {
    const match = /^\s*%%\s+kg:node\s+([A-Za-z0-9_:-]+)\s+(\S+)\s*$/.exec(line)
    if (!match) return
    try {
      out.set(match[1] || '', decodeURIComponent(match[2] || ''))
    } catch {
      out.set(match[1] || '', match[2] || '')
    }
  })
  return out
}

export function parseProbeTreeStoryboardMermaidFlowchart(mermaid: string): GraphData | null {
  const source = String(mermaid || '').trim()
  if (!source) return null
  const parsed = tryParseMarkdownFrontmatterFlowGraph('probe-tree-storyboard-mermaid.md', [
    '---',
    'index:',
    '  mermaid: |',
    ...source.split('\n').map(line => `    ${line}`),
    '---',
    '',
  ].join('\n'))
  if (!parsed) return null
  const aliasMap = readAliasMap(source)
  const restoreId = (id: unknown): string => aliasMap.get(cleanText(id, 140)) || cleanText(id, 140)
  return {
    ...parsed.graphData,
    nodes: (parsed.graphData.nodes || []).map(node => {
      const sourceId = restoreId(node.id)
      return {
        ...node,
        id: sourceId,
        type: cleanText(node.type) === 'default' ? 'ProbeTreeStoryboardNode' : node.type,
        properties: {
          ...(node.properties || {}),
          lane: ((node.properties || {}) as Record<string, JSONValue>).lane || 'PROBE',
          'storyboard:mermaidFlowchartKind': PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
          'storyboard:mermaidNodeId': cleanText(node.id, 140),
        },
      }
    }),
    edges: (parsed.graphData.edges || []).map(edge => ({
      ...edge,
      source: restoreId(edge.source),
      target: restoreId(edge.target),
      properties: {
        ...(edge.properties || {}),
        'storyboard:mermaidFlowchartKind': PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
      },
    })),
    metadata: {
      ...(parsed.graphData.metadata || {}),
      probeTreeMermaidFlowchartKind: PROBE_TREE_STORYBOARD_MERMAID_FLOWCHART_KIND,
    } as GraphData['metadata'],
  }
}
