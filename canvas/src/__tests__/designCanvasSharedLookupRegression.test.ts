import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignCanvasGraphOrchestrationReusesSharedGraphLookupHelper() {
  const orchestrationText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasGraphOrchestration.ts'),
    'utf8',
  )

  if (
    !orchestrationText.includes("cacheScope: 'design-canvas-orchestration-display-graph'")
    || !orchestrationText.includes("cacheScope: 'design-canvas-orchestration-webpage-layout-graph'")
    || !orchestrationText.includes('getCachedGraphLookup({')
  ) {
    throw new Error('expected design canvas graph orchestration to reuse the shared graph lookup helper instead of rebuilding local display and webpage node maps')
  }
  if (orchestrationText.includes('const byId = new Map<string, GraphNode>()')) {
    throw new Error('expected design canvas graph orchestration to stop rebuilding local GraphNode maps once shared graph lookups are available')
  }
}
