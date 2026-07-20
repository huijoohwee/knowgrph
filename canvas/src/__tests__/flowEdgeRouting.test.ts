import { routeFlowEdgeOrtho } from '@/components/FlowCanvas/edgeRouting'

export function testFlowEdgeRoutingAvoidsObstacleByShiftingLaneLR() {
  const pts = routeFlowEdgeOrtho({
    rankdir: 'LR',
    start: { x: 0, y: 0 },
    end: { x: 200, y: 100 },
    obstacles: [{ x: 90, y: -10, w: 20, h: 140 }],
    marginPx: 0,
    laneStepPx: 56,
    maxLanes: 6,
  })
  if (pts.length < 4) throw new Error('expected orthogonal polyline')
  const laneY = pts[1].y
  if (laneY >= -10 && laneY <= 130) throw new Error('expected route to avoid obstacle vertical span')
}

export function testFlowEdgeRoutingAvoidsObstacleByShiftingLaneTB() {
  const pts = routeFlowEdgeOrtho({
    rankdir: 'TB',
    start: { x: 0, y: 0 },
    end: { x: 200, y: 100 },
    obstacles: [{ x: -10, y: 40, w: 240, h: 20 }],
    marginPx: 0,
    laneStepPx: 56,
    maxLanes: 6,
  })
  if (pts.length < 4) throw new Error('expected orthogonal polyline')
  const laneY = pts[1].y
  if (laneY >= 40 && laneY <= 60) throw new Error('expected lane to avoid obstacle y-range')
}

export function testFlowEdgeRoutingIgnorePointsSkipsEndpointObstacles() {
  const pts = routeFlowEdgeOrtho({
    rankdir: 'LR',
    start: { x: 0, y: 0 },
    end: { x: 200, y: 0 },
    obstacles: [
      { x: -5, y: -5, w: 10, h: 10 },
      { x: 90, y: -20, w: 20, h: 40 },
    ],
    marginPx: 0,
    laneStepPx: 56,
    maxLanes: 6,
    ignorePoints: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
  })
  if (pts.length < 4) throw new Error('expected orthogonal polyline')
  const laneY = pts[1].y
  if (laneY >= -20 && laneY <= 20) throw new Error('expected route to avoid non-endpoint obstacle')
}

export function testFlowEdgeRoutingForbidsPrimaryAxisBacktracking() {
  const pts = routeFlowEdgeOrtho({
    rankdir: 'LR',
    start: { x: 0, y: 0 },
    end: { x: 40, y: 100 },
    obstacles: [{ x: 12, y: 40, w: 16, h: 20 }],
    marginPx: 0,
    laneStepPx: 56,
    maxLanes: 4,
  })
  if (pts.length < 4) throw new Error('expected orthogonal polyline')
  if (pts.some(point => point.x < 0 || point.x > 40)) {
    throw new Error(`expected LR route to remain inside its primary-axis interval, got ${JSON.stringify(pts)}`)
  }
}
