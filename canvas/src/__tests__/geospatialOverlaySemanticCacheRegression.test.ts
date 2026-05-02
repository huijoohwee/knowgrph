import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGeospatialOverlayGraphDataUsesSemanticCache() {
  const geospatialOverlayPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'geospatialOverlayGraphData.ts')
  const canvasViewportPath = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const mainPanelPath = resolve(process.cwd(), 'src', 'features', 'panels', 'MainPanel.tsx')

  const geospatialOverlayText = readFileSync(geospatialOverlayPath, 'utf8')
  const canvasViewportText = readFileSync(canvasViewportPath, 'utf8')
  const mainPanelText = readFileSync(mainPanelPath, 'utf8')

  if (
    !geospatialOverlayText.includes('const geospatialOverlayGraphCache = new Map<string, GraphData>()')
    || !geospatialOverlayText.includes("buildScopedGraphSemanticKey('geospatial-overlay-base-graph'")
    || !geospatialOverlayText.includes('buildSourceFilesSemanticSignature')
    || !geospatialOverlayText.includes('const cacheKey = buildGeospatialOverlayGraphCacheKey(args)')
    || !geospatialOverlayText.includes('const cached = readCachedGeospatialOverlayGraphData(cacheKey)')
  ) {
    throw new Error('expected geospatial overlay graph data helper to cache by semantic graph and source-file signatures instead of rebuilding every render')
  }

  if (!canvasViewportText.includes('graphRevision: graphDataRevision')) {
    throw new Error('expected CanvasViewport geospatial overlay call to pass graph revision into the shared semantic cache helper')
  }

  if (
    !mainPanelText.includes("cacheScope: 'main-panel-traversal-graph'")
    || !mainPanelText.includes('getCachedGraphLookup({')
    || !mainPanelText.includes("hashScopedStringArraySignature('main-panel-traversal-edge-ids'")
  ) {
    throw new Error('expected MainPanel traversal chip to reuse shared graph lookup and semantic edge-id signatures instead of rescanning raw graph edges')
  }
}
