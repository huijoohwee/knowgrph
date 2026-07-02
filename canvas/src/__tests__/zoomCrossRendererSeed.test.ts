import { canSeedZoomStateAcross2dRenderers, pickZoomStateWithCrossRendererFallback } from '@/lib/canvas/zoomSeed'
import { isFlowCanvas2dRenderer, isStoryboardCanvas2dRenderer } from '@/lib/config.render'

export const testZoomCrossRendererSeedFallsBackToOther2dRenderer = () => {
  const suffix = ['schema', '0', 'document', 'meta', '0', 'dense', 'cg'].join('|')
  const flowKey = `2d|flow|${suffix}`
  const d3Key = `2d|d3|${suffix}`
  const baseKey = `2d||${suffix}`

  const zoomStateByKey = {
    [flowKey]: { k: 2, x: 10, y: -5 },
  }

  const pickedForD3 = pickZoomStateWithCrossRendererFallback({ zoomViewKey: d3Key, zoomStateByKey })
  if (!pickedForD3) throw new Error('expected fallback zoom state')
  if (pickedForD3.k !== 2 || pickedForD3.x !== 10 || pickedForD3.y !== -5) {
    throw new Error('expected D3 to reuse Flow zoom state')
  }

  const pickedForBase = pickZoomStateWithCrossRendererFallback({ zoomViewKey: baseKey, zoomStateByKey })
  if (!pickedForBase) throw new Error('expected fallback zoom state for base key')
}

export const testZoomCrossRendererSeedIgnoresDesignWebpageSuffix = () => {
  const suffix = ['schema', '0', 'document', 'meta', '0', 'dense', 'cg'].join('|')
  const base = `2d|design|${suffix}`
  const designWithWebpage = `${base}::webpage:abc123`
  const flowKey = `2d|flow|${suffix}`
  const zoomStateByKey = {
    [flowKey]: { k: 1.5, x: 0, y: 100 },
  }
  const picked = pickZoomStateWithCrossRendererFallback({ zoomViewKey: designWithWebpage, zoomStateByKey })
  if (!picked) throw new Error('expected fallback from design key with webpage suffix')
  if (picked.k !== 1.5 || picked.y !== 100) throw new Error('expected pick from other renderer')
}

export const testZoomCrossRendererSeedIsolatesStoryboardAndFlowCanvas = () => {
  const suffix = ['schema', '0', 'document', 'meta', '0', 'dense', 'cg'].join('|')
  const flowKey = `2d|flow|${suffix}`
  const storyboardKey = `2d|storyboard|${suffix}`

  const pickedForStoryboard = pickZoomStateWithCrossRendererFallback({
    zoomViewKey: storyboardKey,
    zoomStateByKey: {
      [flowKey]: { k: 2.5, x: 20, y: -10 },
    },
  })
  if (pickedForStoryboard) {
    throw new Error('expected Storyboard to reject Flow Canvas zoom-state seepage')
  }

  const pickedForFlowCanvas = pickZoomStateWithCrossRendererFallback({
    zoomViewKey: flowKey,
    zoomStateByKey: {
      [storyboardKey]: { k: 0.75, x: -40, y: 12 },
    },
  })
  if (pickedForFlowCanvas) {
    throw new Error('expected Flow Canvas to reject Storyboard zoom-state seepage')
  }

  if (canSeedZoomStateAcross2dRenderers({ targetRenderer: 'storyboard', sourceRenderer: 'flow' })) {
    throw new Error('expected renderer-switch zoom seeding to forbid Flow Canvas -> Storyboard')
  }
  if (canSeedZoomStateAcross2dRenderers({ targetRenderer: 'flow', sourceRenderer: 'storyboard' })) {
    throw new Error('expected renderer-switch zoom seeding to forbid Storyboard -> Flow Canvas')
  }
  if (!isStoryboardCanvas2dRenderer('storyboard')) {
    throw new Error('expected Storyboard renderer identity to remain explicit')
  }
  if (!canSeedZoomStateAcross2dRenderers({ targetRenderer: 'd3', sourceRenderer: 'flow' })) {
    throw new Error('expected D3 and Flow Canvas zoom fallback to remain available')
  }
}
