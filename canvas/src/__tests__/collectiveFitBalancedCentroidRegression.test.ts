import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyCollectiveGraphLayout } from '@/components/GraphCanvas/layout/collectiveFit'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { computeBalancedSpreadViewportMargins } from '@/lib/ui/overlayBalancedSpread'

function makeNode(id: string, x: number, y: number): GraphNode {
  return { id, label: id, type: 'Entity', x, y, vx: 0, vy: 0, properties: {} }
}

export function testCollectiveFitCentersDisconnectedComponentsOnBalancedViewportCentroid() {
  const width = 1920
  const height = 1080
  const nodes: GraphNode[] = [
    makeNode('a1', 2600, 100),
    makeNode('a2', 2720, 100),
    makeNode('b1', 2860, 260),
    makeNode('b2', 2980, 260),
    makeNode('c1', 3120, 420),
    makeNode('c2', 3240, 420),
    makeNode('d1', 3380, 580),
    makeNode('d2', 3500, 580),
  ]
  const edges: GraphEdge[] = [
    { id: 'e-a', source: 'a1', target: 'a2', type: 'relatedTo', properties: {} } as GraphEdge,
    { id: 'e-b', source: 'b1', target: 'b2', type: 'relatedTo', properties: {} } as GraphEdge,
    { id: 'e-c', source: 'c1', target: 'c2', type: 'relatedTo', properties: {} } as GraphEdge,
    { id: 'e-d', source: 'd1', target: 'd2', type: 'relatedTo', properties: {} } as GraphEdge,
  ]

  applyCollectiveGraphLayout({
    nodes,
    edges,
    width,
    height,
    schema: defaultSchema,
  })

  const spreadMargins = computeBalancedSpreadViewportMargins({
    viewportW: width,
    viewportH: height,
    preset: 'widgetCanvas',
    minLeftPx: 20,
    minRightPx: 20,
    minTopPx: 24,
    minBottomPx: 20,
  })
  const expectedCenterX = spreadMargins.left + (width - spreadMargins.left - spreadMargins.right) / 2
  const expectedCenterY = spreadMargins.top + (height - spreadMargins.top - spreadMargins.bottom) / 2
  const componentCenters = [
    { x: ((nodes[0]!.x as number) + (nodes[1]!.x as number)) / 2, y: ((nodes[0]!.y as number) + (nodes[1]!.y as number)) / 2 },
    { x: ((nodes[2]!.x as number) + (nodes[3]!.x as number)) / 2, y: ((nodes[2]!.y as number) + (nodes[3]!.y as number)) / 2 },
    { x: ((nodes[4]!.x as number) + (nodes[5]!.x as number)) / 2, y: ((nodes[4]!.y as number) + (nodes[5]!.y as number)) / 2 },
    { x: ((nodes[6]!.x as number) + (nodes[7]!.x as number)) / 2, y: ((nodes[6]!.y as number) + (nodes[7]!.y as number)) / 2 },
  ]
  const centroid = componentCenters.reduce((acc, center) => ({ x: acc.x + center.x, y: acc.y + center.y }), { x: 0, y: 0 })
  centroid.x /= componentCenters.length
  centroid.y /= componentCenters.length

  if (Math.abs(centroid.x - expectedCenterX) > 4 || Math.abs(centroid.y - expectedCenterY) > 4) {
    throw new Error(`expected disconnected collective centroid near ${expectedCenterX},${expectedCenterY}, got ${centroid.x},${centroid.y}`)
  }

  const leftCount = componentCenters.filter(center => center.x < expectedCenterX - 80).length
  const rightCount = componentCenters.filter(center => center.x > expectedCenterX + 80).length
  if (leftCount === 0 || rightCount === 0) {
    throw new Error(`expected centered collective to span both sides of the viewport centroid, got centers=${JSON.stringify(componentCenters)}`)
  }
}

export function testCollectiveFitReusesSharedBalancedSpreadPlanner() {
  const collectiveFitPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'collectiveFit.ts')
  const text = readFileSync(collectiveFitPath, 'utf8')
  if (!text.includes("import {\n  computeBalancedSpreadLayout,\n  computeBalancedSpreadSpacingPx,\n  computeBalancedSpreadViewportMargins,\n} from '@/lib/ui/overlayBalancedSpread'")) {
    throw new Error('expected collective fit to reuse the shared balanced spread planner helpers')
  }
  if (!text.includes('const balancedLayout = computeBalancedSpreadLayout({')) {
    throw new Error('expected collective fit to plan disconnected component placement through the shared balanced spread layout helper')
  }
  if (!text.includes('const centeredCells = [...balancedLayout.cells].sort((left, right) => {')) {
    throw new Error('expected collective fit to assign balanced cells by viewport-center proximity for stable centroid placement')
  }
  if (text.includes('const targetWidth = Math.max(width, Math.sqrt(totalArea * viewportAspect))')) {
    throw new Error('expected collective fit to remove the legacy row-pack width heuristic that can bias component centroids after panel-driven rebuilds')
  }
}
