import {
  FLOW_HANDLE_DEFAULT_EDGE_ID,
  buildFlowHandleId,
  computeFlowHandlesByNode,
  ensureFlowHandlesHaveDefaults,
} from '@/components/FlowCanvas/handles'
import { buildElkLayout } from '@/components/FlowCanvas/elkLayout'
import type { GraphData } from '@/lib/graph/types'
import type { FlowConfig } from '@/components/FlowCanvas/config'

export const testFlowHandlesByNodeDeterministicOrdering = () => {
  const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
  const edges = [
    { id: 'e2', source: 'B', target: 'A' },
    { id: 'e1', source: 'C', target: 'A' },
    { id: 'e3', source: 'A', target: 'B' },
  ]
  const handlesByNode = computeFlowHandlesByNode({ nodes, edges })
  const a = handlesByNode.A
  if (!a) throw new Error('handles missing for node A')
  if (a.in.length !== 2) throw new Error('node A incoming handles count mismatch')
  if (a.out.length !== 1) throw new Error('node A outgoing handles count mismatch')

  const in0 = a.in[0]?.id
  const in1 = a.in[1]?.id
  if (in0 !== buildFlowHandleId({ dir: 'in', edgeId: 'e2' })) throw new Error('node A incoming handle[0] should be in:e2')
  if (in1 !== buildFlowHandleId({ dir: 'in', edgeId: 'e1' })) throw new Error('node A incoming handle[1] should be in:e1')

  const approx = (value: number, expected: number, eps: number) => Math.abs(value - expected) <= eps
  if (!approx(a.in[0]?.topPct ?? NaN, 33.3333, 0.25)) throw new Error('node A incoming handle[0] topPct mismatch')
  if (!approx(a.in[1]?.topPct ?? NaN, 66.6666, 0.25)) throw new Error('node A incoming handle[1] topPct mismatch')
}

export const testFlowHandlesDefaultsAreInjectedWhenRequested = () => {
  const next = ensureFlowHandlesHaveDefaults({ in: [], out: [] })
  if (next.in.length !== 1) throw new Error('default incoming handle missing')
  if (next.out.length !== 1) throw new Error('default outgoing handle missing')
  if (next.in[0]?.id !== buildFlowHandleId({ dir: 'in', edgeId: FLOW_HANDLE_DEFAULT_EDGE_ID })) {
    throw new Error('default incoming handle id mismatch')
  }
  if (next.out[0]?.id !== buildFlowHandleId({ dir: 'out', edgeId: FLOW_HANDLE_DEFAULT_EDGE_ID })) {
    throw new Error('default outgoing handle id mismatch')
  }
  if ((next.in[0]?.topPct ?? -1) !== 50) throw new Error('default incoming handle topPct mismatch')
  if ((next.out[0]?.topPct ?? -1) !== 50) throw new Error('default outgoing handle topPct mismatch')

  const unchanged = { in: [{ id: buildFlowHandleId({ dir: 'in', edgeId: 'e1' }), topPct: 50 }], out: [] }
  const withDefaults = ensureFlowHandlesHaveDefaults(unchanged)
  if (withDefaults.in !== unchanged.in) throw new Error('should reuse existing incoming handle array')
  if (withDefaults.out.length !== 1) throw new Error('should inject missing outgoing handle')
}

export const testElkLayoutTimeoutIsBounded = async () => {
  const config: FlowConfig = {
    engine: 'auto',
    node: { widthPx: 180, heightPx: 48, paddingX: 12, paddingY: 8 },
    handle: { sizePx: 10, lineHeightPx: 16 },
    elk: { direction: 'RIGHT' as const, algorithm: 'layered', layoutTimeoutMs: 200, nodeNodeSpacingPx: 24, layerSpacingPx: 48, edgeNodeSpacingPx: 16 },
  }

  const graphData: Pick<GraphData, 'nodes' | 'edges'> = {
    nodes: [
      { id: 'a', label: 'a', type: 'entity', properties: {} },
      { id: 'b', label: 'b', type: 'entity', properties: {} },
    ],
    edges: [{ id: 'e', source: 'a', target: 'b', label: 'e', properties: {} }],
  }

  const startedAt = Date.now()
  try {
    await buildElkLayout({
      graphData,
      config,
      layout: () => new Promise(() => {}),
    })
    throw new Error('expected elk layout timeout')
  } catch {
    const durationMs = Date.now() - startedAt
    if (durationMs < 150) throw new Error('elk timeout returned too fast')
    if (durationMs > 1500) throw new Error('elk timeout exceeded expected bound')
  }
}

export const testElkLayoutReturnsNodePositions = async () => {
  const config: FlowConfig = {
    engine: 'auto',
    node: { widthPx: 180, heightPx: 48, paddingX: 12, paddingY: 8 },
    handle: { sizePx: 10, lineHeightPx: 16 },
    elk: { direction: 'RIGHT' as const, algorithm: 'layered', layoutTimeoutMs: 200, nodeNodeSpacingPx: 24, layerSpacingPx: 48, edgeNodeSpacingPx: 16 },
  }

  const out = await buildElkLayout({
    graphData: {
      nodes: [
        { id: 'a', label: 'a', type: 'entity', properties: {} },
        { id: 'b', label: 'b', type: 'entity', properties: {} },
      ],
      edges: [{ id: 'e', source: 'a', target: 'b', label: 'e', properties: {} }],
    },
    config,
    layout: async () => ({ children: [{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 40, y: 60 }] }),
  })

  if (out.a?.x !== 10 || out.a?.y !== 20) throw new Error('elk layout output mismatch for node a')
  if (out.b?.x !== 40 || out.b?.y !== 60) throw new Error('elk layout output mismatch for node b')
}
