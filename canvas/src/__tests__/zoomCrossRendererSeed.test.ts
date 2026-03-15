import { pickZoomStateWithCrossRendererFallback } from '@/lib/canvas/zoomSeed'

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

