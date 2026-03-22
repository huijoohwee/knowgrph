import type { GraphNode } from '@/lib/graph/types'
import { pickLayoutPositionsSource } from '@/components/GraphCanvas/layout/positionSource'

export const testPickLayoutPositionsSourcePrefersPrevOnLargeDelta = () => {
  const nodes: GraphNode[] = []
  for (let i = 0; i < 50; i += 1) {
    nodes.push({ id: `n${i}`, label: `n${i}`, type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} })
  }

  const prev: Record<string, { x: number; y: number }> = {}
  const cached: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < 50; i += 1) {
    prev[`n${i}`] = { x: i * 10, y: i * 10 }
    cached[`n${i}`] = { x: i * 10 + 10000, y: i * 10 + 10000 }
  }

  const picked = pickLayoutPositionsSource({ nodes, cached, prev, preferPrevMedianDeltaThreshold: 120 })
  if (picked !== prev) throw new Error('Expected prev positions to be preferred when median delta is large')
}

export const testPickLayoutPositionsSourcePrefersCachedWhenNoPrev = () => {
  const nodes: GraphNode[] = [{ id: 'a', label: 'a', type: 'Entity', x: 0, y: 0, vx: 0, vy: 0, properties: {} }]
  const cached = { a: { x: 1, y: 2 } }
  const picked = pickLayoutPositionsSource({ nodes, cached, prev: null })
  if (picked !== cached) throw new Error('Expected cached positions when prev is null')
}
