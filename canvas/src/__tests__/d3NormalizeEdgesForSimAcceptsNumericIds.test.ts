import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'

export function testD3NormalizeEdgesForSimAcceptsNumericIds() {
  const nodes = [{ id: 1 }, { id: '2' }, { id: 'x' }] as unknown as GraphNode[]
  const edges = [
    { id: 'e1', source: 1, target: 2 },
    { id: 'e2', source: { id: 1 }, target: { id: '2' } },
    { id: 'e3', source: 'x', target: 1 },
  ] as unknown as GraphEdge[]
  const out = normalizeEdgesForSim(nodes, edges)
  if (out.length !== 3) {
    throw new Error(`expected 3 normalized edges, got ${out.length}`)
  }
  for (const e of out as unknown as Array<{ source?: unknown; target?: unknown }>) {
    if (typeof e.source !== 'string' || typeof e.target !== 'string') {
      throw new Error('expected normalized edge endpoints to be strings')
    }
  }
}

