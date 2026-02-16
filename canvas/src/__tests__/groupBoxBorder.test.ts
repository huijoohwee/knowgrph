import type { CollisionGroupItem } from '@/lib/graph/collision/boxCollision'
import { resolveGroupCollisions } from '@/lib/graph/collision/boxCollision'

type MovableNode = {
  id: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  vz?: number
}

export function testGroupCollisionInnerBorderDoesNotTouchOtherOuterBorder() {
  const nodes: MovableNode[] = [
    { id: 'n1', x: 0, y: 0, vx: 0, vy: 0 },
    { id: 'n2', x: 29, y: 0, vx: 0, vy: 0 },
  ]

  const groupA: CollisionGroupItem = {
    id: 'gA',
    cx: 0,
    cy: 0,
    halfW: 10,
    halfH: 10,
    gap: 5,
    movableIdxs: [0],
  }

  const groupB: CollisionGroupItem = {
    id: 'gB',
    cx: 29,
    cy: 0,
    halfW: 10,
    halfH: 10,
    gap: 5,
    movableIdxs: [1],
  }

  resolveGroupCollisions({
    groups: [groupA, groupB],
    nodes,
    strength: 1,
    touchEpsilon: 0.1,
    groupsShareAnyMember: () => false,
  })

  const v1 = nodes[0].vx || 0
  const v2 = nodes[1].vx || 0
  if (!(v1 < 0)) throw new Error(`expected group A velocity to be negative; got ${v1}`)
  if (!(v2 > 0)) throw new Error(`expected group B velocity to be positive; got ${v2}`)
}

export function testGroupCollisionGapSumInfluencesSeparation() {
  const g1: CollisionGroupItem = { id: 'g1', cx: 0, cy: 0, halfW: 10, halfH: 10, gap: 2, movableIdxs: [0] }
  const g2: CollisionGroupItem = { id: 'g2', cx: 20, cy: 0, halfW: 10, halfH: 10, gap: 8, movableIdxs: [1] }
  const nodes: MovableNode[] = [{ id: 'n1' }, { id: 'n2' }]
  resolveGroupCollisions({
    groups: [g1, g2],
    nodes,
    strength: 1,
    touchEpsilon: 0,
    groupsShareAnyMember: () => false,
  })
  const v1 = nodes[0].vx || 0
  const v2 = nodes[1].vx || 0
  const delta = Math.abs(v2 - v1)
  if (!(Math.abs(delta - 10) < 0.001)) throw new Error(`expected |v2 - v1|≈10; got ${delta}`)
}
