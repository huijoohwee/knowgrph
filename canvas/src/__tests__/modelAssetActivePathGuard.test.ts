import { shouldRenderCanvasAppliedModelAsset } from '@/lib/three/modelAssetActivePathGuard'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testModelAssetActivePathGuardBlocksStaleGlbFallbackDuringIndexing() {
  if (shouldRenderCanvasAppliedModelAsset({
    explorerActivePath: '/capture/capture-collider.glb',
    canvasDocumentName: 'demo-model.glb',
    hasModelAsset: true,
  })) {
    throw new Error('expected active model-file selection to block a different canvas-applied GLB fallback')
  }
  if (!shouldRenderCanvasAppliedModelAsset({
    explorerActivePath: '/capture/capture-collider.glb',
    canvasDocumentName: 'capture/capture-collider.glb',
    hasModelAsset: true,
  })) {
    throw new Error('expected active model-file selection to render once the canvas-applied document matches')
  }
  if (!shouldRenderCanvasAppliedModelAsset({
    explorerActivePath: '/docs/notes.md',
    canvasDocumentName: 'demo-model.glb',
    hasModelAsset: true,
  })) {
    throw new Error('expected non-model Explorer selections to preserve passive canvas-applied GLB rendering')
  }

  const threeGraph = readFileSync(resolve(process.cwd(), 'src/lib/three/ThreeGraph.impl.tsx'), 'utf8')
  if (!threeGraph.includes('shouldRenderCanvasAppliedModelAsset({')) {
    throw new Error('expected ThreeGraph to gate GLB/GLTF rendering against active Explorer model path')
  }
  if (!threeGraph.includes('glbAsset && shouldRenderGlbAsset ?')) {
    throw new Error('expected ThreeGraph to avoid rendering stale GLB/GLTF while model indexing applies')
  }
}
