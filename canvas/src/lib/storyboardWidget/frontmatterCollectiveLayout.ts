import type { EdgePathCurveOptions } from '@/lib/graph/edgeTypes'
import type { GraphEdge } from '@/lib/graph/types'

export const FRONTMATTER_COLLECTIVE_GROUP_ID_KEY = 'frontmatter:collectiveGroupId' as const
export const FRONTMATTER_COLLECTIVE_ITEM_KEY = 'frontmatter:collectiveItemKey' as const
export const FRONTMATTER_COLLECTIVE_INDEX_KEY = 'frontmatter:collectiveIndex' as const
export const FRONTMATTER_COLLECTIVE_ROLE_KEY = 'frontmatter:collectiveRole' as const
export const FRONTMATTER_COLLECTIVE_ROLE_INDEX_KEY = 'frontmatter:collectiveRoleIndex' as const
export const FRONTMATTER_BALANCED_EDGE_ROUTE = 'balanced-16x9:collective-readable' as const
export const FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID = 'director_brief.shots' as const

type NodeLike = { properties?: unknown } | null | undefined
type EdgeLike = Pick<GraphEdge, 'id' | 'properties'> | null | undefined

type FrontmatterCollectiveNodeLayout = {
  groupId: string
  itemKey: string
  itemIndex: number | null
  roleIndex: number | null
  xIndex: number | null
}

function readFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

function readString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function readEdgeProps(edge: EdgeLike): Record<string, unknown> {
  const props = edge?.properties
  return props && typeof props === 'object' && !Array.isArray(props) ? props as Record<string, unknown> : {}
}

function readNodeProps(node: NodeLike): Record<string, unknown> {
  const props = node?.properties
  return props && typeof props === 'object' && !Array.isArray(props) ? props as Record<string, unknown> : {}
}

export function readFrontmatterCollectiveNodeLayout(node: NodeLike): FrontmatterCollectiveNodeLayout {
  const props = readNodeProps(node)
  return {
    groupId: readString(props[FRONTMATTER_COLLECTIVE_GROUP_ID_KEY]),
    itemKey: readString(props[FRONTMATTER_COLLECTIVE_ITEM_KEY]),
    itemIndex: readFiniteNumber(props[FRONTMATTER_COLLECTIVE_INDEX_KEY]),
    roleIndex: readFiniteNumber(props[FRONTMATTER_COLLECTIVE_ROLE_INDEX_KEY]),
    xIndex: readFiniteNumber(props['visual:xIndex']),
  }
}

function readBalancedRoute(edge: EdgeLike): string {
  const route = readString(readEdgeProps(edge).layoutRoute).toLowerCase()
  return route.startsWith('balanced-16x9:') ? route : ''
}

export function buildFrontmatterOverlayNodeLookup<Node extends { id?: unknown }>(nodes: readonly Node[]): Map<string, Node> {
  const out = new Map<string, Node>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i]?.id || '').trim()
    if (id) out.set(id, nodes[i]!)
  }
  return out
}

export function isFrontmatterCollectiveNode(node: NodeLike): boolean {
  const layout = readFrontmatterCollectiveNodeLayout(node)
  return !!layout.groupId && !!layout.itemKey
}

export function buildFrontmatterCollectiveRoleProperties(args: {
  itemKey: string
  itemIndex: number
  role: string
  roleIndex: number
}): Record<string, unknown> {
  return {
    [FRONTMATTER_COLLECTIVE_GROUP_ID_KEY]: FRONTMATTER_DIRECTOR_BRIEF_SHOTS_GROUP_ID,
    [FRONTMATTER_COLLECTIVE_ITEM_KEY]: args.itemKey,
    [FRONTMATTER_COLLECTIVE_INDEX_KEY]: args.itemIndex,
    [FRONTMATTER_COLLECTIVE_ROLE_KEY]: args.role,
    [FRONTMATTER_COLLECTIVE_ROLE_INDEX_KEY]: args.roleIndex,
  }
}

export function withFrontmatterCollectiveRoleProperties<T extends { properties?: unknown }>(node: T, args: {
  itemKey: string
  itemIndex: number
  role: string
  roleIndex: number
}): T {
  const props = readNodeProps(node)
  return { ...node, properties: { ...buildFrontmatterCollectiveRoleProperties(args), ...props } }
}

export function appendFrontmatterBalancedConnection(
  connections: unknown[],
  from: string,
  to: string,
  label: string,
  layoutLane: number,
): void {
  connections.push({ from, to, label, animated: true, layoutRoute: FRONTMATTER_BALANCED_EDGE_ROUTE, layoutLane })
}

function hasSameCollectiveItem(
  source: FrontmatterCollectiveNodeLayout,
  target: FrontmatterCollectiveNodeLayout,
): boolean {
  return !!source.groupId
    && source.groupId === target.groupId
    && !!source.itemKey
    && source.itemKey === target.itemKey
}

function hasSharedCollectiveGroup(
  source: FrontmatterCollectiveNodeLayout,
  target: FrontmatterCollectiveNodeLayout,
): boolean {
  return !!source.groupId && source.groupId === target.groupId
}

function isFrontmatterCollectiveEdge(args: {
  graphMetaKind: string | null | undefined
  edge: EdgeLike
  sourceNode: NodeLike
  targetNode: NodeLike
  sourceId: string
  targetId: string
}): boolean {
  if (String(args.graphMetaKind || '').trim() !== 'frontmatter-flow') return false
  const sourceId = String(args.sourceId || '').trim()
  const targetId = String(args.targetId || '').trim()
  if (!sourceId || !targetId || sourceId === targetId) return false
  const source = readFrontmatterCollectiveNodeLayout(args.sourceNode)
  const target = readFrontmatterCollectiveNodeLayout(args.targetNode)
  if (hasSameCollectiveItem(source, target)) return true
  return !!readBalancedRoute(args.edge) && hasSharedCollectiveGroup(source, target)
}

export function resolveFrontmatterOverlayEdgeCurveOptions(args: {
  graphMetaKind: string | null | undefined
  edge: EdgeLike
  sourceNode: NodeLike
  targetNode: NodeLike
  sourceId: string
  targetId: string
}): EdgePathCurveOptions | null {
  if (!isFrontmatterCollectiveEdge(args)) return null
  const props = readEdgeProps(args.edge)
  const source = readFrontmatterCollectiveNodeLayout(args.sourceNode)
  const target = readFrontmatterCollectiveNodeLayout(args.targetNode)
  const lane = readFiniteNumber(props.layoutLane)
  const bendRaw = readFiniteNumber(props['visual:curveBend'])
  const orbitRaw = readFiniteNumber(props['visual:orbitShift'])
  const interpolator = readString(props['visual:curveInterpolator']).toLowerCase()
  const sourceRoleIndex = source.roleIndex ?? source.xIndex ?? 0
  const targetRoleIndex = target.roleIndex ?? target.xIndex ?? sourceRoleIndex
  const itemIndex = source.itemIndex ?? target.itemIndex ?? 0
  const lanePhase = lane == null || Math.abs(lane) < 1e-6 ? null : lane < 0 ? -1 : 1
  const rolePhase = targetRoleIndex === sourceRoleIndex
    ? (itemIndex % 2 === 0 ? 1 : -1)
    : targetRoleIndex > sourceRoleIndex ? 1 : -1
  const phase = (lanePhase || rolePhase) as -1 | 1
  const bendMagnitude = Math.max(0.04, Math.min(0.42, Math.abs(bendRaw ?? 0.16)))
  return {
    bend: phase * bendMagnitude,
    orbitShift: Math.max(0, Math.min(0.45, orbitRaw ?? 0.1)),
    orbital: interpolator ? interpolator === 'orbital' : true,
    phase,
  }
}

export function resolveFrontmatterOverlayEdgeCrowdingLiftPx(args: {
  graphMetaKind: string | null | undefined
  edge: EdgeLike
  sourceNode: NodeLike
  targetNode: NodeLike
  sourceId: string
  targetId: string
  sourceY: number
  targetY: number
  sourceHeight: number
  targetHeight: number
}): number {
  if (!isFrontmatterCollectiveEdge(args)) return 0
  const sourceHeight = Number.isFinite(args.sourceHeight) ? Math.max(1, args.sourceHeight) : 1
  const targetHeight = Number.isFinite(args.targetHeight) ? Math.max(1, args.targetHeight) : 1
  const localFrame = Math.max(sourceHeight, targetHeight)
  const delta = Math.abs(args.targetY - args.sourceY)
  const crowdingThreshold = localFrame * 0.72
  if (delta <= crowdingThreshold) return 0
  return Math.max(0, Math.min(localFrame * 0.08, (delta - crowdingThreshold) * 0.08))
}
