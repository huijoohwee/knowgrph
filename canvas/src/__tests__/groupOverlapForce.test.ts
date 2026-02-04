import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { defaultSchema } from '@/lib/graph/schema'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { createGroupBboxCollideForce } from '@/components/GraphCanvas/layout/groupOverlap'
import { readCollisionConfig } from '@/components/GraphCanvas/layout/collisionConfig'
import { DEFAULT_GROUP_STROKE_WIDTH } from '@/lib/graph/layoutDefaults'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'

const computeGroupAabb = (args: {
  nodes: GraphNode[]
  schema: GraphSchema
  groupId: string
  padding: number
}): { cx: number; cy: number; halfW: number; halfH: number } | null => {
  const groupPad =
    typeof args.schema.layout?.groups?.padding === 'number' && Number.isFinite(args.schema.layout.groups.padding)
      ? Math.max(0, args.schema.layout.groups.padding)
      : 24
  const groupBbox = readCollisionConfig(args.schema).groupBbox
  const strokeWidthRaw = args.schema.layout?.groups?.strokeWidth
  const strokeWidth = typeof strokeWidthRaw === 'number' && Number.isFinite(strokeWidthRaw) ? Math.max(0, strokeWidthRaw) : DEFAULT_GROUP_STROKE_WIDTH
  const borderGapPx = computeBorderGapPx(strokeWidth, groupBbox.borderGapPx)
  const pad = Math.max(0, args.padding + groupPad + borderGapPx + groupBbox.extraGapPx)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let saw = false
  for (const n of args.nodes) {
    const p = (n.properties || {}) as Record<string, unknown>
    const top = typeof p['visual:topParentId'] === 'string' ? String(p['visual:topParentId']) : ''
    if (top !== args.groupId) continue
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) continue
    const ext = getNodeAabbHalfExtentsWithLabel(n, args.schema)
    const loX = x - ext.halfW - pad
    const hiX = x + ext.halfW + pad
    const loY = y - ext.halfH - pad
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

export function testGroupBboxCollideSeparatesTopParentGroups() {
  const schema: GraphSchema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      groups: { ...(defaultSchema.layout?.groups || {}), enabled: true, padding: 24 },
    },
  }

  const mk = (id: string, groupId: string, x: number, y: number): GraphNode => ({
    id,
    label: id,
    type: 'Entity',
    x,
    y,
    vx: 0,
    vy: 0,
    properties: { 'visual:topParentId': groupId },
  })

  const nodes: GraphNode[] = [
    mk('a1', 'gA', 0, 0),
    mk('a2', 'gA', 10, 0),
    mk('b1', 'gB', 0, 0),
    mk('b2', 'gB', -10, 0),
  ]

  const pad = 8
  const gA0 = computeGroupAabb({ nodes, schema, groupId: 'gA', padding: pad })
  const gB0 = computeGroupAabb({ nodes, schema, groupId: 'gB', padding: pad })
  if (!gA0 || !gB0) throw new Error('expected initial groups to exist')
  const ox0 = gA0.halfW + gB0.halfW - Math.abs(gA0.cx - gB0.cx)
  const oy0 = gA0.halfH + gB0.halfH - Math.abs(gA0.cy - gB0.cy)
  if (!(ox0 > 0 && oy0 > 0)) throw new Error('expected initial group overlap')

  const f = createGroupBboxCollideForce({ schema, paddingX: pad, paddingY: pad, strength: 0.9, iterations: 2 })
  f.initialize(nodes, Math.random)
  const apply = f as unknown as (alpha: number) => void
  for (let step = 0; step < 10; step += 1) {
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

  const gA1 = computeGroupAabb({ nodes, schema, groupId: 'gA', padding: pad })
  const gB1 = computeGroupAabb({ nodes, schema, groupId: 'gB', padding: pad })
  if (!gA1 || !gB1) throw new Error('expected final groups to exist')
  const ox1 = gA1.halfW + gB1.halfW - Math.abs(gA1.cx - gB1.cx)
  const oy1 = gA1.halfH + gB1.halfH - Math.abs(gA1.cy - gB1.cy)
  const overlapped1 = ox1 > 0 && oy1 > 0
  if (overlapped1 && ox1 >= ox0 && oy1 >= oy0) {
    throw new Error('expected group overlap to decrease after applying group bbox collide')
  }

  const eps = readCollisionConfig(schema).groupBbox.touchEpsilonPx
  const allowedOverlap = pad + eps
  
  if (ox1 > allowedOverlap && oy1 > allowedOverlap) {
    throw new Error(`expected groups to respect X-Index spacing (max gap), found overlap ${ox1} > ${allowedOverlap}`)
  }
}
