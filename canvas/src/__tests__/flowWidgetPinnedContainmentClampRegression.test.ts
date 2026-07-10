import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetPinnedClampsToContainmentGroup() {
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'flowWidgetOverlayShared.ts')
  const placementProjectionPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'widgetPlacementRuntimeProjection.ts')
  const innerPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const placementProjectionText = readFileSync(placementProjectionPath, 'utf8')
  const innerText = readFileSync(innerPath, 'utf8')

  if (!sharedText.includes('getLiveContainmentGroupAabbForNode') || !innerText.includes('getLiveContainmentGroupAabbForNode')) {
    throw new Error('expected WidgetEditor to accept a containment group AABB getter')
  }
  if (!placementProjectionText.includes('getLiveContainmentGroupAabbForNode?.(nodeId)') || !placementProjectionText.includes('const minLeft = left0 + 8')) {
    throw new Error('expected WidgetEditor to clamp pinned overlays within a containment group rect')
  }
}
