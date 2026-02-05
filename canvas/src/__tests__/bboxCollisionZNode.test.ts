import { defaultSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import { createBboxCollideForce } from '@/components/GraphCanvas/layout/overlap'

export function testNodeBboxCollideZRespectsSchemaGating() {
  const nodesBase: GraphNode[] = [
    { id: 'a', type: 'Entity', label: 'a', properties: { pos3d: [0, 0, 1] } as unknown as Record<string, never>, x: 0, y: 0 },
    { id: 'b', type: 'Entity', label: 'b', properties: { pos3d: [0, 0, 2] } as unknown as Record<string, never>, x: 0, y: 0 },
  ]

  const forceDisabled = createBboxCollideForce({
    schema: defaultSchema,
    paddingX: 120,
    paddingY: 120,
    strength: 1,
    iterations: 1,
  })
  forceDisabled.initialize(nodesBase, Math.random)
  forceDisabled(1)
  const vzDisabledA = (nodesBase[0] as unknown as { vz?: unknown }).vz
  const vzDisabledB = (nodesBase[1] as unknown as { vz?: unknown }).vz
  if (typeof vzDisabledA === 'number' || typeof vzDisabledB === 'number') {
    throw new Error('expected Z collision to be disabled by default')
  }

  const schemaZ = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      forces: {
        ...((defaultSchema.layout && defaultSchema.layout.forces) || {}),
        bboxCollideZEnabled: true,
        bboxCollidePaddingZ: 2,
        bboxCollideTouchEpsilonZPx: 0,
      },
    },
  }

  const nodesZ: GraphNode[] = JSON.parse(JSON.stringify(nodesBase)) as GraphNode[]

  const forceEnabled = createBboxCollideForce({
    schema: schemaZ,
    paddingX: 120,
    paddingY: 120,
    strength: 1,
    iterations: 1,
  })
  forceEnabled.initialize(nodesZ, Math.random)
  forceEnabled(1)
  const vzA = (nodesZ[0] as unknown as { vz?: unknown }).vz
  const vzB = (nodesZ[1] as unknown as { vz?: unknown }).vz
  const moved =
    (typeof vzA === 'number' && Number.isFinite(vzA) && Math.abs(vzA) > 0.0001) ||
    (typeof vzB === 'number' && Number.isFinite(vzB) && Math.abs(vzB) > 0.0001)
  if (!moved) {
    throw new Error('expected Z collision to apply when bboxCollideZEnabled and nodes have non-zero z')
  }
}

export function testNodeBboxCollideZRequiresExplicitZ() {
  const schemaZ = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      forces: {
        ...((defaultSchema.layout && defaultSchema.layout.forces) || {}),
        bboxCollideZEnabled: true,
        bboxCollidePaddingZ: 2,
        bboxCollideTouchEpsilonZPx: 0,
      },
    },
  }

  const nodes: GraphNode[] = [
    {
      id: 'a',
      type: 'Entity',
      label: 'a',
      properties: { 'visual:depth': 12 } as unknown as Record<string, never>,
      x: 0,
      y: 0,
    },
    {
      id: 'b',
      type: 'Entity',
      label: 'b',
      properties: { 'visual:depth': 12 } as unknown as Record<string, never>,
      x: 0,
      y: 0,
    },
  ]

  const force = createBboxCollideForce({
    schema: schemaZ,
    paddingX: 120,
    paddingY: 120,
    strength: 1,
    iterations: 1,
  })
  force.initialize(nodes, Math.random)
  force(1)

  const vzA = (nodes[0] as unknown as { vz?: unknown }).vz
  const vzB = (nodes[1] as unknown as { vz?: unknown }).vz
  if (typeof vzA === 'number' || typeof vzB === 'number') {
    throw new Error('expected Z collision to require explicit z coordinates')
  }
}
