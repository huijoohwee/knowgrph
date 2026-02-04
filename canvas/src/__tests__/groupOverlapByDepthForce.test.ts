import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { createGroupBboxCollideForceByDepth } from '@/components/GraphCanvas/layout/groupOverlapByDepth'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { DEFAULT_GROUP_STROKE_WIDTH } from '@/lib/graph/layoutDefaults'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'

const computeGroupAabb = (args: {
  nodes: GraphNode[]
  schema: GraphSchema
  groups: GraphGroup[]
  groupId: string
  padding: number
}): { cx: number; cy: number; halfW: number; halfH: number } | null => {
  const group = args.groups.find(g => String(g.id) === args.groupId) || null
  if (!group) return null

  const groupPad =
    typeof args.schema.layout?.groups?.padding === 'number' && Number.isFinite(args.schema.layout.groups.padding)
      ? Math.max(0, args.schema.layout.groups.padding)
      : 24
  const nestedPaddingStep =
    typeof args.schema.layout?.groups?.nestedPaddingStep === 'number' && Number.isFinite(args.schema.layout.groups.nestedPaddingStep)
      ? Math.max(0, args.schema.layout.groups.nestedPaddingStep)
      : 0
  const topLabelExtra = readGroupLabelTopExtra(args.schema)
  const strokeWidthRaw = args.schema.layout?.groups?.strokeWidth
  const strokeWidth = typeof strokeWidthRaw === 'number' && Number.isFinite(strokeWidthRaw) ? Math.max(0, strokeWidthRaw) : DEFAULT_GROUP_STROKE_WIDTH
  const groupBbox = readCollisionConfig(args.schema).groupBbox
  const borderGapPx = computeBorderGapPx(strokeWidth, groupBbox.borderGapPx)

  let maxDepth = 0
  for (let i = 0; i < args.groups.length; i += 1) {
    const d = args.groups[i]
    const depth = typeof d.depth === 'number' && Number.isFinite(d.depth) ? Math.max(0, Math.floor(d.depth)) : 0
    maxDepth = Math.max(maxDepth, depth)
  }

  const depth = typeof group.depth === 'number' && Number.isFinite(group.depth) ? Math.max(0, Math.floor(group.depth)) : 0
  const depthExtra = nestedPaddingStep > 0 ? nestedPaddingStep * Math.max(0, maxDepth - depth) : 0
  const pad = Math.max(0, args.padding + groupPad + depthExtra + borderGapPx + groupBbox.extraGapPx)

  const memberNodeIds = Array.isArray(group.memberNodeIds) ? group.memberNodeIds : []
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < args.nodes.length; i += 1) {
    nodeById.set(String(args.nodes[i]!.id), args.nodes[i]!)
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let saw = false
  for (let i = 0; i < memberNodeIds.length; i += 1) {
    const id = String(memberNodeIds[i] || '').trim()
    if (!id) continue
    const n = nodeById.get(id)
    if (!n) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    const ext = getNodeAabbHalfExtentsWithLabel(n, args.schema)
    const loX = x - ext.halfW - pad
    const hiX = x + ext.halfW + pad
    const loY = y - ext.halfH - pad - topLabelExtra
    const hiY = y + ext.halfH + pad
    if (loX < minX) minX = loX
    if (hiX > maxX) maxX = hiX
    if (loY < minY) minY = loY
    if (hiY > maxY) maxY = hiY
    saw = true
  }
  if (!saw) return null
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, halfW: w / 2, halfH: h / 2 }
}

const overlapOf = (a: { cx: number; cy: number; halfW: number; halfH: number }, b: { cx: number; cy: number; halfW: number; halfH: number }) => {
  const ox = a.halfW + b.halfW - Math.abs(a.cx - b.cx)
  const oy = a.halfH + b.halfH - Math.abs(a.cy - b.cy)
  return { ox, oy, overlapped: ox > 0 && oy > 0 }
}

export function testGroupBboxCollideByDepthSeparatesOuterAndInnerSiblings() {
  const schema: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      groups: { ...(defaultSchema.layout?.groups || {}), enabled: true, padding: 24, nestedPaddingStep: 18 },
    },
  }

  const mk = (id: string, x: number, y: number): GraphNode => ({
    id,
    label: id,
    type: 'Entity',
    x,
    y,
    vx: 0,
    vy: 0,
    properties: {},
  })

  const nodes: GraphNode[] = [mk('a1', 0, 0), mk('a2', 10, 0), mk('b1', 0, 0), mk('b2', -10, 0)]

  const groups: GraphGroup[] = [
    { id: 'outerA', label: 'outerA', depth: 0, memberNodeIds: ['a1', 'a2'], style: {} },
    { id: 'outerB', label: 'outerB', depth: 0, memberNodeIds: ['b1', 'b2'], style: {} },
    { id: 'innerA', label: 'innerA', depth: 1, memberNodeIds: ['a1', 'a2'], style: {} },
    { id: 'innerB', label: 'innerB', depth: 1, memberNodeIds: ['b1', 'b2'], style: {} },
  ]

  const pad = 8
  const outerA0 = computeGroupAabb({ nodes, schema, groups, groupId: 'outerA', padding: pad })
  const outerB0 = computeGroupAabb({ nodes, schema, groups, groupId: 'outerB', padding: pad })
  const innerA0 = computeGroupAabb({ nodes, schema, groups, groupId: 'innerA', padding: pad })
  const innerB0 = computeGroupAabb({ nodes, schema, groups, groupId: 'innerB', padding: pad })
  if (!outerA0 || !outerB0 || !innerA0 || !innerB0) throw new Error('expected initial groups to exist')
  const outerOverlap0 = overlapOf(outerA0, outerB0)
  const innerOverlap0 = overlapOf(innerA0, innerB0)
  if (!outerOverlap0.overlapped) throw new Error('expected initial outer group overlap')
  if (!innerOverlap0.overlapped) throw new Error('expected initial inner group overlap')

  const groupBbox = readCollisionConfig(schema).groupBbox
  const f = createGroupBboxCollideForceByDepth({
    schema,
    groups,
    paddingX: pad,
    paddingY: pad,
    extraGapPx: groupBbox.extraGapPx,
    strength: 0.9,
    iterations: 2,
  })
  f.initialize(nodes, Math.random)
  const apply = f as unknown as (alpha: number) => void
  for (let step = 0; step < 12; step += 1) {
    apply(0.9 - step * 0.06)
    for (const n of nodes) {
      const vx = typeof n.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
      const vy = typeof n.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
      n.x = (typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0) + vx
      n.y = (typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0) + vy
      n.vx = vx * 0.25
      n.vy = vy * 0.25
    }
  }

  const outerA1 = computeGroupAabb({ nodes, schema, groups, groupId: 'outerA', padding: pad })
  const outerB1 = computeGroupAabb({ nodes, schema, groups, groupId: 'outerB', padding: pad })
  const innerA1 = computeGroupAabb({ nodes, schema, groups, groupId: 'innerA', padding: pad })
  const innerB1 = computeGroupAabb({ nodes, schema, groups, groupId: 'innerB', padding: pad })
  if (!outerA1 || !outerB1 || !innerA1 || !innerB1) throw new Error('expected final groups to exist')

  const outerOverlap1 = overlapOf(outerA1, outerB1)
  const innerOverlap1 = overlapOf(innerA1, innerB1)
  if (outerOverlap1.overlapped && outerOverlap1.ox >= outerOverlap0.ox && outerOverlap1.oy >= outerOverlap0.oy) {
    throw new Error('expected outer depth group overlap to decrease')
  }
  if (innerOverlap1.overlapped && innerOverlap1.ox >= innerOverlap0.ox && innerOverlap1.oy >= innerOverlap0.oy) {
    throw new Error('expected inner depth group overlap to decrease')
  }

  const eps = readCollisionConfig(schema).groupBbox.touchEpsilonPx
  if (outerOverlap1.ox > -eps && outerOverlap1.oy > -eps) {
    throw new Error('expected outer sibling groups to not touch')
  }
  if (innerOverlap1.ox > -eps && innerOverlap1.oy > -eps) {
    throw new Error('expected inner sibling groups to not touch')
  }
}
