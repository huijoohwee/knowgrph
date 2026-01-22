import { pickInitialZoomTransform } from '@/components/GraphCanvas/zoomState'

export const testPickInitialZoomTransformReusesZoomAcrossPresentationChanges = () => {
  const z = { k: 1.5, x: 10, y: 20, graphDataRevision: 7, viewportW: 800, viewportH: 600 }
  const picked = pickInitialZoomTransform({
    zoomState: z,
    pinned: false,
    graphDataRevision: 7,
    nextViewportW: 800,
    nextViewportH: 600,
  })
  if (!picked) throw new Error('expected to reuse zoomState when graph revision matches')
  if (picked.k !== 1.5 || picked.x !== 10 || picked.y !== 20) throw new Error('expected exact transform reuse when not pinned')
}

export const testPickInitialZoomTransformRejectsStaleZoomWhenNotPinned = () => {
  const z = { k: 1.5, x: 10, y: 20, graphDataRevision: 6, viewportW: 800, viewportH: 600 }
  const picked = pickInitialZoomTransform({
    zoomState: z,
    pinned: false,
    graphDataRevision: 7,
    nextViewportW: 800,
    nextViewportH: 600,
  })
  if (picked != null) throw new Error('expected null when graph revision differs and not pinned')
}

