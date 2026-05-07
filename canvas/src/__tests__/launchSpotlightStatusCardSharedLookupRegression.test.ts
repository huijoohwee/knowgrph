import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLaunchSpotlightStatusCardReusesSharedLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'spotlight', 'LaunchSpotlightStatusCard.tsx'),
    'utf8',
  )

  if (
    !text.includes("buildScopedGraphSemanticKey('launch-spotlight-status-card-graph'")
    || !text.includes("cacheScope: 'launch-spotlight-status-card-graph'")
    || !text.includes('getCachedGraphLookup({')
    || !text.includes('graphRevision: graphDataRevision')
    || !text.includes('preferCurrentGraphDataRefs: true')
    || !text.includes("const found = graphLookup?.nodeById.get(selectedNodeId) || null")
    || text.includes('graphData.nodes.find(')
  ) {
    throw new Error('expected LaunchSpotlightStatusCard to reuse the shared semantic graph lookup instead of rescanning graph nodes by selected id')
  }
}

export function testLaunchSpotlightStatusCardShowsWorkspaceSeedSyncDebug() {
  const statusCardText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'spotlight', 'LaunchSpotlightStatusCard.tsx'),
    'utf8',
  )
  const sourceBootstrapText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx'),
    'utf8',
  )

  if (
    !statusCardText.includes("import { __canvasStartupDebug } from '@/features/canvas/canvasStartupDebug'")
    || !statusCardText.includes('const workspaceSeedSyncDebugText = React.useMemo(() => {')
    || !statusCardText.includes('Seed sync: pending')
    || !statusCardText.includes('Seed sync:')
    || !statusCardText.includes('{workspaceSeedSyncDebugText}')
  ) {
    throw new Error('expected LaunchSpotlightStatusCard to show tiny workspace seed sync debug text (timestamp + source)')
  }

  if (
    !sourceBootstrapText.includes('__canvasStartupDebug.workspaceSeedLastSyncAtMs = Date.now()')
    || !sourceBootstrapText.includes('__canvasStartupDebug.workspaceSeedLastSyncSource = String(source || \'\').trim()')
  ) {
    throw new Error('expected SourceFilesPersistenceBootstrap to update workspace seed sync debug timestamp/source upstream')
  }
}
