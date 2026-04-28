import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getEdgeLabelForDisplay, shouldShowEdgeArrow } from '@/components/GraphCanvas/edgeDisplay'
import { applyClusterAwareHeuristicSeedLayout } from '@/components/GraphCanvas/layout/heuristic-cluster'
import { postFitNodesToViewport } from '@/components/GraphCanvas/layout/postFit'

export function testEdgeDisplayKeywordArrowRespectsKeywordDirected() {
  const schema = { edgeStyles: {} } as unknown as GraphSchema
  const edge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    label: 'rel',
    properties: { 'keyword:kind': 'assoc', 'keyword:directed': false },
  } as unknown as GraphEdge
  if (shouldShowEdgeArrow(edge, schema) !== false) {
    throw new Error('expected keyword:directed=false to disable arrows when schema has no arrow style')
  }
}

export function testEdgeDisplaySchemaArrowOverridesKeyword() {
  const schema = { edgeStyles: { rel: { arrow: true } } } as unknown as GraphSchema
  const edge = { id: 'e1', source: 'a', target: 'b', label: 'rel', properties: {} } as unknown as GraphEdge
  if (shouldShowEdgeArrow(edge, schema) !== true) {
    throw new Error('expected schema.edgeStyles[label].arrow=true to force arrow')
  }
}

export function testEdgeDisplayKeywordLabelCleansUnderscores() {
  const edge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    label: 'has_part__of',
    properties: { 'keyword:kind': 'assoc' },
  } as unknown as GraphEdge
  const label = getEdgeLabelForDisplay(edge)
  if (label !== 'has part of') {
    throw new Error(`expected underscore cleaning, got: ${label}`)
  }
}

export function testEdgeDisplayPrefersFrontmatterDisplayLabelOverPointsTo() {
  const edge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    label: 'pointsTo',
    properties: { 'frontmatter:displayLabel': 'identity-anchor' },
  } as unknown as GraphEdge
  const label = getEdgeLabelForDisplay(edge)
  if (label !== 'identity-anchor') {
    throw new Error(`expected frontmatter display label override, got: ${label}`)
  }
}

export function testEdgeDisplayHidesMermaidPointsToWhenNoDisplayLabel() {
  const edge = {
    id: 'e1',
    source: 'mermaid:g:d:a',
    target: 'mermaid:g:d:b',
    label: 'pointsTo',
    properties: {},
  } as unknown as GraphEdge
  const label = getEdgeLabelForDisplay(edge)
  if (label !== '') {
    throw new Error(`expected Mermaid pointsTo edge label to be hidden, got: ${label}`)
  }
}

export function testHeuristicClusterSeedsByGroupKey() {
  const schema = { edgeStyles: {} } as unknown as GraphSchema
  const nodes: GraphNode[] = []
  for (let i = 0; i < 12; i += 1) {
    nodes.push({ id: `n${i}`, type: 'Item', x: 0, y: 0, properties: {} } as unknown as GraphNode)
  }
  const groupKeyOf = (n: GraphNode) => (String(n.id).endsWith('0') || String(n.id).endsWith('1') || String(n.id).endsWith('2') ? 'A' : 'B')

  applyClusterAwareHeuristicSeedLayout({ nodes, width: 1200, height: 800, schema, groupKeyOf })

  const a = nodes.filter(n => groupKeyOf(n) === 'A')
  const b = nodes.filter(n => groupKeyOf(n) === 'B')
  const cx = (arr: GraphNode[]) => arr.reduce((s, n) => s + (typeof n.x === 'number' ? n.x : 0), 0) / Math.max(1, arr.length)
  const cy = (arr: GraphNode[]) => arr.reduce((s, n) => s + (typeof n.y === 'number' ? n.y : 0), 0) / Math.max(1, arr.length)
  const dx = Math.abs(cx(a) - cx(b))
  const dy = Math.abs(cy(a) - cy(b))
  if (dx < 60 && dy < 60) {
    throw new Error('expected different group clusters to be separated after heuristic seed')
  }
}

export function testPostFitShrinksOversizedLayout() {
  const nodes: GraphNode[] = [
    { id: 'a', x: -5000, y: -4000 } as unknown as GraphNode,
    { id: 'b', x: 5000, y: 4000 } as unknown as GraphNode,
  ]
  const applied = postFitNodesToViewport({ nodes, width: 1000, height: 800, paddingPx: 40 })
  if (!applied) throw new Error('expected postFit to apply on oversized bbox')

  const xs = nodes.map(n => Number(n.x))
  const ys = nodes.map(n => Number(n.y))
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanY = Math.max(...ys) - Math.min(...ys)
  if (spanX > 1000 || spanY > 800) {
    throw new Error('expected postFit to bring bbox within viewport bounds')
  }
}
