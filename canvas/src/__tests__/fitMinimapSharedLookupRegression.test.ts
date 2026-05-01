import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFitAndMinimapPathsReuseSharedGraphLookupHelper() {
  const collectiveFitText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'collectiveFit.ts'),
    'utf8',
  )
  const fitText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'fit.ts'),
    'utf8',
  )
  const minimapText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx'),
    'utf8',
  )

  if (!collectiveFitText.includes("cacheScope: 'graph-canvas-collective-fit'") || !collectiveFitText.includes('getCachedGraphLookup({')) {
    throw new Error('expected collective fit layout to reuse the shared graph lookup helper instead of rebuilding local node connectivity maps')
  }
  if (!fitText.includes("cacheScope: 'graph-canvas-fit-groups'") || !fitText.includes('getCachedGraphLookup({')) {
    throw new Error('expected fit-to-screen group bounds to reuse the shared graph lookup helper instead of rebuilding local node maps')
  }
  if (!minimapText.includes("cacheScope: 'minimap-flow-editor-overlay-subset'") || !minimapText.includes('getCachedGraphLookup({')) {
    throw new Error('expected minimap Flow Editor overlay subset to reuse the shared graph lookup helper instead of rebuilding local node maps')
  }
}
