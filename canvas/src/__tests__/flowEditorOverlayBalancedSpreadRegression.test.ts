import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testFlowEditorOverlayCollisionRebalancesStoredVerticalClusters = () => {
  const spreadPath = path.resolve(process.cwd(), 'src', 'lib', 'ui', 'overlayBalancedSpread.ts')
  const spreadText = readUtf8(spreadPath)
  if (!spreadText.includes('isVerticalOverlayCluster')) {
    throw new Error('expected shared overlay spread helper to detect vertical overlay clusters')
  }

  const hookPath = path.resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const hookText = readUtf8(hookPath)
  if (!hookText.includes('const posSig = overlayNodeIds')) {
    throw new Error('expected overlay collision key to include stored position signature')
  }
  if (!hookText.includes('const pinSig = overlayNodeIds')) {
    throw new Error('expected overlay collision key to include pinned signature')
  }
  if (!hookText.includes('movable: true')) {
    throw new Error('expected floating overlays with stored positions to remain auto-rebalanceable')
  }
  if (!hookText.includes('shouldRebalanceCluster')) {
    throw new Error('expected overlay collision path to rebalance vertical clusters')
  }
  if (!hookText.includes('useGraphStore.subscribe(s => s.flowWidgetPosByNodeId')) {
    throw new Error('expected overlay collision path to reschedule on floating position updates')
  }
}

