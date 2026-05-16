import {
  isFlowTransformKeepingWorldRectCollectiveInViewport,
  isFlowTransformShowingGraph,
} from '@/components/FlowCanvas/transformGuards'

export const testFlowTransformShowingGraphRejectsUnknownBounds = () => {
  const ok = isFlowTransformShowingGraph(
    { k: 1, x: 0, y: 0 },
    {
      nodes: [{ x: undefined, y: undefined }, { x: null as unknown as undefined, y: null as unknown as undefined }],
      viewportW: 800,
      viewportH: 600,
      nodeW: 200,
      nodeH: 80,
    },
  )
  if (ok) throw new Error('expected false when bounds cannot be computed from any finite node position')
}

export const testFlowTransformShowingGraphRejectsClearlyOffscreenTransform = () => {
  const ok = isFlowTransformShowingGraph(
    { k: 1, x: -5000, y: -5000 },
    {
      nodes: [{ x: 0, y: 0 }],
      viewportW: 800,
      viewportH: 600,
      nodeW: 200,
      nodeH: 80,
    },
  )
  if (ok) throw new Error('expected false when transformed graph bounds are far outside viewport')
}

export const testFlowTransformShowingGraphAcceptsIdentityWhenGraphNearOrigin = () => {
  const ok = isFlowTransformShowingGraph(
    { k: 1, x: 0, y: 0 },
    {
      nodes: [{ x: 40, y: 50 }],
      viewportW: 800,
      viewportH: 600,
      nodeW: 200,
      nodeH: 80,
    },
  )
  if (!ok) throw new Error('expected true when graph bounds intersect viewport')
}

export const testFlowTransformKeepingWorldRectCollectiveInViewportRejectsBottomOverflow = () => {
  const ok = isFlowTransformKeepingWorldRectCollectiveInViewport(
    { k: 1, x: 301, y: 312 },
    {
      rects: [
        { left: 484.6222, top: 656.8, width: 115.2, height: 166.4 },
        { left: 623.6222, top: 656.8, width: 115.2, height: 166.4 },
      ],
      viewportW: 1920,
      viewportH: 909,
    },
  )
  if (ok) throw new Error('expected false when transformed widget collective spills below the viewport')
}

export const testFlowTransformKeepingWorldRectCollectiveInViewportAcceptsCenteredCollective = () => {
  const ok = isFlowTransformKeepingWorldRectCollectiveInViewport(
    { k: 1, x: 0, y: 0 },
    {
      rects: [
        { left: 484.6222, top: 656.8, width: 115.2, height: 166.4 },
        { left: 623.6222, top: 656.8, width: 115.2, height: 166.4 },
      ],
      viewportW: 1920,
      viewportH: 909,
    },
  )
  if (!ok) throw new Error('expected true when the transformed widget collective stays inside the viewport')
}
