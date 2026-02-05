import { defaultSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import { createGroupBboxCollideForceByDepth } from '@/components/GraphCanvas/layout/groupOverlapByDepth'
import { readCollisionConfig, readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { computeBorderGapPx } from '@/lib/graph/collision/borderGap'
import { readGroupStrokeWidthPx, readNodeStrokeWidthPx } from '@/lib/graph/collision/strokeWidth'
import { DEFAULT_GROUP_PADDING } from '@/lib/graph/layoutDefaults'

export function testGroupNodeNoStickSeparatesExternalNodeFromGroupBorder() {
  const schema = defaultSchema
  const collision = readCollisionConfig(schema)

  const nodes: Array<GraphNode & { vx?: number; vy?: number; vz?: number }> = [
    {
      id: 'm1',
      type: 'Entity',
      label: '',
      properties: { 'visual:shape': 'rect', 'visual:width': 120, 'visual:height': 80 } as unknown as Record<string, never>,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    },
    {
      id: 'm2',
      type: 'Entity',
      label: '',
      properties: { 'visual:shape': 'rect', 'visual:width': 120, 'visual:height': 80 } as unknown as Record<string, never>,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    },
    {
      id: 'ext',
      type: 'Entity',
      label: '',
      properties: { 'visual:shape': 'rect', 'visual:width': 90, 'visual:height': 60 } as unknown as Record<string, never>,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    },
  ]

  const groups = [
    {
      id: 'g',
      label: 'g',
      depth: 0,
      memberNodeIds: ['m1', 'm2'],
      style: {},
    },
  ]

  const force = createGroupBboxCollideForceByDepth({
    schema,
    groups,
    paddingX: collision.groupBbox.paddingX,
    paddingY: collision.groupBbox.paddingY,
    paddingZ: collision.groupBbox.paddingZ,
    extraGapPx: collision.groupBbox.extraGapPx,
    extraGapZPx: collision.groupBbox.extraGapZPx,
    strength: collision.groupBbox.strength,
    iterations: collision.groupBbox.iterations,
  })
  force.initialize(nodes, Math.random)

  for (let step = 0; step < 22; step += 1) {
    force(1)
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]!
      const vx = typeof n.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
      const vy = typeof n.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
      n.x = (typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : 0) + vx
      n.y = (typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : 0) + vy
      n.vx = vx * 0.25
      n.vy = vy * 0.25
    }
  }

  const member = nodes[0]!
  const ext = nodes[2]!

  const groupPad =
    typeof schema.layout?.groups?.padding === 'number' && Number.isFinite(schema.layout.groups.padding)
      ? Math.max(0, schema.layout.groups.padding)
      : DEFAULT_GROUP_PADDING
  const groupStrokeWidthPx = readGroupStrokeWidthPx(schema, 0, 0)
  const groupBorderGapPx = computeBorderGapPx(groupStrokeWidthPx, collision.groupBbox.borderGapPx)
  const topLabelExtra = readGroupLabelTopExtra(schema)
  const visualPad = Math.max(0, groupPad + groupBorderGapPx)
  const memberExt = getNodeAabbHalfExtentsWithLabel(member, schema)
  const groupHalfW = memberExt.halfW + visualPad
  const groupHalfH = memberExt.halfH + visualPad + topLabelExtra * 0.5
  const groupGapX = Math.max(0, (collision.groupBbox.paddingX + collision.groupBbox.extraGapPx) * 0.5)
  const groupGapY = Math.max(0, (collision.groupBbox.paddingY + collision.groupBbox.extraGapPx) * 0.5)
  const groupCy = -topLabelExtra * 0.5

  const extExt = getNodeAabbHalfExtentsWithLabel(ext, schema)
  const extBorderGapPx = computeBorderGapPx(readNodeStrokeWidthPx(schema, ext), collision.nodeBbox.borderGapPx)
  const extHalfW = extExt.halfW + collision.nodeBbox.paddingX + extBorderGapPx
  const extHalfH = extExt.halfH + collision.nodeBbox.paddingY + extBorderGapPx

  const dx = (ext.x ?? 0) - 0
  const dy = (ext.y ?? 0) - groupCy
  const overlapX = groupHalfW + groupGapX + extHalfW - Math.abs(dx)
  const overlapY = groupHalfH + groupGapY + extHalfH - Math.abs(dy)
  const touchEpsilonX = Math.max(0, collision.groupBbox.touchEpsilonXPx, collision.nodeBbox.touchEpsilonXPx)
  const touchEpsilonY = Math.max(0, collision.groupBbox.touchEpsilonYPx, collision.nodeBbox.touchEpsilonYPx)

  const separated = overlapX <= -touchEpsilonX + 0.75 || overlapY <= -touchEpsilonY + 0.75
  if (!separated) {
    throw new Error(
      `expected external node to not touch group border (ox=${overlapX}, oy=${overlapY}, touchX=${touchEpsilonX}, touchY=${touchEpsilonY}, extX=${ext.x}, extY=${ext.y}, extVx=${ext.vx}, extVy=${ext.vy})`,
    )
  }
}
