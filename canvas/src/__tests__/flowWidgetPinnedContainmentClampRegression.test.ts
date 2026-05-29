import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetPinnedClampsToContainmentGroup() {
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'nodeOverlayEditorShared.ts')
  const placementPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const innerPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const placementText = readFileSync(placementPath, 'utf8')
  const innerText = readFileSync(innerPath, 'utf8')

  if (!sharedText.includes('getLiveContainmentGroupAabbForNode') || !innerText.includes('getLiveContainmentGroupAabbForNode')) {
    throw new Error('expected NodeOverlayEditor to accept a containment group AABB getter')
  }
  if (!placementText.includes('getLiveContainmentGroupAabbForNode?.(nodeId)') || !placementText.includes('const minLeft = left0 + 8')) {
    throw new Error('expected NodeOverlayEditor to clamp pinned overlays within a containment group rect')
  }
}
