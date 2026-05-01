import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLayoutFlowAndThreePathsReuseSharedGraphLookupHelper() {
  const initializationText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'initialization.ts'),
    'utf8',
  )
  const flowLayoutStateText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts'),
    'utf8',
  )
  const threePositionsText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'three', 'positions.impl.ts'),
    'utf8',
  )

  if (!initializationText.includes("cacheScope: 'graph-canvas-layout-baseline-keyword-graph'") || !initializationText.includes("cacheScope: 'graph-canvas-layout-keyword-source-baseline'") || !initializationText.includes('getCachedGraphLookup({')) {
    throw new Error('expected layout initialization keyword-baseline helpers to reuse the shared graph lookup helper instead of rebuilding local node and adjacency maps')
  }
  if (!flowLayoutStateText.includes("cacheScope: 'flow-canvas-layout-state-flow-zoom'") || !flowLayoutStateText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowCanvas collective-fit preparation to reuse the shared graph lookup helper instead of rebuilding local node maps')
  }
  if (!threePositionsText.includes("cacheScope: 'three-positions-hub-orbit'") || !threePositionsText.includes('getCachedGraphLookup({')) {
    throw new Error('expected 3D hub-orbit positioning to reuse the shared graph lookup helper instead of rebuilding a local node map')
  }
}
