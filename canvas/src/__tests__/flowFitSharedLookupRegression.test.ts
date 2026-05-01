import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowFitPathsReuseSharedGraphLookupHelper() {
  const fitPinnedWidgetsText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'fitPinnedWidgets.ts'),
    'utf8',
  )

  if (!fitPinnedWidgetsText.includes("cacheScope: 'flow-canvas-fit-pinned-widgets'") || !fitPinnedWidgetsText.includes('getCachedGraphLookup({')) {
    throw new Error('expected FlowCanvas pinned-widget fit helper to reuse the shared graph lookup helper instead of rebuilding a local node map')
  }
}
