import { extractNodePositions } from '@/components/FlowCanvas'

export const testFlowExtractNodePositionsReturnsNullWhenNone = () => {
  const out = extractNodePositions([
    { id: 'a', x: null, y: 2 },
    { id: 'b', x: 1, y: undefined },
  ])
  if (out !== null) throw new Error('expected null when no finite positions are present')
}

export const testFlowExtractNodePositionsExtractsFinitePositions = () => {
  const out = extractNodePositions([
    { id: 'a', x: 10, y: 20 },
    { id: 'b', x: 5, y: 6 },
    { id: 'c', x: NaN, y: 2 },
  ])
  if (!out) throw new Error('expected positions')
  if (!out.a || out.a.x !== 10 || out.a.y !== 20) throw new Error('expected a position')
  if (!out.b || out.b.x !== 5 || out.b.y !== 6) throw new Error('expected b position')
  if (out.c) throw new Error('expected c to be skipped')
}

