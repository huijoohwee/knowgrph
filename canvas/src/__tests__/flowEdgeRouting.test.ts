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
