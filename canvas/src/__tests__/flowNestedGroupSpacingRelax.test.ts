import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { readGroupLabelTopExtra } from '@/components/GraphCanvas/layout/collisionConfig'
import { relaxFlowPositionsWithCollision } from '@/components/FlowCanvas/relaxPositions'

const computeVisualGroupAabb = (args: {
  memberNodeIds: string[]
  positions: Record<string, { x: number; y: number }>
  nodeSize: { widthPx: number; heightPx: number }
  groupPaddingPx: number
  labelTopExtraPx: number
}): { minX: number; maxX: number; minY: number; maxY: number } | null => {
  const pad = Math.max(0, args.groupPaddingPx)
  const topExtra = Math.max(0, args.labelTopExtraPx)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < args.memberNodeIds.length; i += 1) {
    const id = String(args.memberNodeIds[i] || '').trim()
    if (!id) continue
    const p = args.positions[id]
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    minX = Math.min(minX, p.x - pad)
    minY = Math.min(minY, p.y - pad - topExtra)
    maxX = Math.max(maxX, p.x + args.nodeSize.widthPx + pad)
    maxY = Math.max(maxY, p.y + args.nodeSize.heightPx + pad)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return { minX, maxX, minY, maxY }
}

export function testFlowNestedGroupRelaxAddsGapAtMultipleDepths() {
  const schema = {
    ...defaultSchema,
    layout: {
      ...defaultSchema.layout,
      forces: {
        ...(defaultSchema.layout?.forces || {}),
        bboxCollide: true,
        groupBboxCollide: true,
      },
      groups: {
        ...(defaultSchema.layout?.groups || {}),
        padding: 24,
      },
    },
  }

  const graphData: GraphData = {
    type: 'graph',
    metadata: {},
    nodes: [
      { id: 'a', type: 'Entity', label: 'a', properties: {} },
      { id: 'b', type: 'Entity', label: 'b', properties: {} },
      { id: 'c', type: 'Entity', label: 'c', properties: {} },
      { id: 'd', type: 'Entity', label: 'd', properties: {} },
    ],
    edges: [],
  }

  const groups = [
    { id: 'outer1', label: 'outer1', depth: 0, memberNodeIds: ['a', 'b'], style: {} },
    { id: 'outer2', label: 'outer2', depth: 0, memberNodeIds: ['c', 'd'], style: {} },
    { id: 'inner1', label: 'inner1', depth: 1, memberNodeIds: ['a'], style: {} },
    { id: 'inner2', label: 'inner2', depth: 1, memberNodeIds: ['b'], style: {} },
    { id: 'inner3', label: 'inner3', depth: 1, memberNodeIds: ['c'], style: {} },
    { id: 'inner4', label: 'inner4', depth: 1, memberNodeIds: ['d'], style: {} },
  ]

  const nodeSize = { widthPx: 180, heightPx: 48 }
  const labelTopExtraPx = readGroupLabelTopExtra(schema as unknown as typeof defaultSchema)
  const groupPad = 24

  const positions = {
    a: { x: 0, y: 0 },
    b: { x: 0, y: 80 },
    c: { x: 210, y: 0 },
    d: { x: 210, y: 80 },
  }

  const beforeOuter1 = computeVisualGroupAabb({ memberNodeIds: ['a', 'b'], positions, nodeSize, groupPaddingPx: groupPad, labelTopExtraPx })
  const beforeOuter2 = computeVisualGroupAabb({ memberNodeIds: ['c', 'd'], positions, nodeSize, groupPaddingPx: groupPad, labelTopExtraPx })
  if (!beforeOuter1 || !beforeOuter2) throw new Error('missing group bounds')
  const beforeGap = beforeOuter2.minX - beforeOuter1.maxX
  if (beforeGap > 8) throw new Error('expected initial layout to be borderline-cluttered')

  const next = relaxFlowPositionsWithCollision({
    graphData,
    groups,
    positions,
    schema: schema as unknown as typeof defaultSchema,
    nodeSize,
    portHandles: { enabled: false, sizePx: 0, offsetPx: 0 },
    defaultSteps: 22,
  })
  if (!next) throw new Error('expected relaxed positions')

  const afterOuter1 = computeVisualGroupAabb({ memberNodeIds: ['a', 'b'], positions: next, nodeSize, groupPaddingPx: groupPad, labelTopExtraPx })
  const afterOuter2 = computeVisualGroupAabb({ memberNodeIds: ['c', 'd'], positions: next, nodeSize, groupPaddingPx: groupPad, labelTopExtraPx })
  if (!afterOuter1 || !afterOuter2) throw new Error('missing relaxed group bounds')
  const afterGap = afterOuter2.minX - afterOuter1.maxX
  if (afterGap < 16) throw new Error('expected relaxed outer groups to have a visible gap')
}

