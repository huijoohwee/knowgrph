import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { applyMermaidSeedLayout } from '@/components/GraphCanvas/layout/mermaidSeed'
import { applyMarkdownHeadingSeedLayout } from '@/components/GraphCanvas/layout/markdownHeadingSeed'
import { applyClusterAwareHeuristicSeedLayout } from '@/components/GraphCanvas/layout/heuristic-cluster'
import { applyIndexGridSeedLayout } from '@/components/GraphCanvas/layout/indexGridSeed'
import { applyGroupGeometrySeedLayout } from '@/components/GraphCanvas/layout/groupGeometrySeed'
import { snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { readBipartiteGridSizePx, readBipartiteLaneSeparationPx, readBipartiteRowStepPx } from '@/lib/canvas/bipartiteGrid'

const applyBipartiteLaneSeedLayout = (args: { nodes: GraphNode[]; width: number; height: number; schema: GraphSchema }): void => {
  const forces = (args.schema.layout?.forces || {}) as any
  if (forces?.bipartiteMode !== true) return
  const nodes = args.nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return

  let problems = 0
  let solutions = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const t = String(nodes[i]?.type || '').trim().toLowerCase()
    if (t === 'problem') problems += 1
    else if (t === 'solution') solutions += 1
  }
  if (problems === 0 || solutions === 0) return

  const w = Math.max(1, args.width)
  const h = Math.max(1, args.height)
  const gridSize = readBipartiteGridSizePx(args.schema)
  const centerX = snapScalarToGrid(w / 2, gridSize)
  const centerY = snapScalarToGrid(h / 2, gridSize)
  const separation = readBipartiteLaneSeparationPx({ schema: args.schema, frameW: w })
  const leftX = centerX - separation
  const rightX = centerX + separation
  const rowStep = readBipartiteRowStepPx(args.schema)

  let placed = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]!
    const t = String(n.type || '').trim().toLowerCase()
    if (t !== 'problem' && t !== 'solution') continue
    const targetX = t === 'problem' ? leftX : rightX
    if (!(typeof n.x === 'number' && Number.isFinite(n.x))) n.x = targetX
    if (!(typeof n.y === 'number' && Number.isFinite(n.y))) n.y = centerY + (placed - (nodes.length - 1) / 2) * rowStep
    if (n.fx == null) n.fx = targetX
    if (n.fy != null) n.fy = null
    n.vx = 0
    n.vy = 0
    placed += 1
  }
}

export function applyForceModeSeeds(args: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  schema: GraphSchema
  groupKeyOf?: (n: GraphNode) => string | null
  groupsForBboxCollide?: GraphGroup[]
}) {
  applyBipartiteLaneSeedLayout({ nodes: args.nodes, width: args.width, height: args.height, schema: args.schema })
  applyGroupGeometrySeedLayout({
    nodes: args.nodes,
    groups: Array.isArray(args.groupsForBboxCollide) ? args.groupsForBboxCollide : [],
    width: args.width,
    height: args.height,
    schema: args.schema,
  })
  applyMermaidSeedLayout({ nodes: args.nodes, edges: args.edges, width: args.width, height: args.height, schema: args.schema })
  applyMarkdownHeadingSeedLayout({ nodes: args.nodes, edges: args.edges, width: args.width, height: args.height, schema: args.schema })
  applyClusterAwareHeuristicSeedLayout({
    nodes: args.nodes,
    width: args.width,
    height: args.height,
    schema: args.schema,
    groupKeyOf: args.groupKeyOf,
  })
  applyIndexGridSeedLayout({ nodes: args.nodes, width: args.width, height: args.height, schema: args.schema })
}
