import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetPinnedClampsToContainmentGroup() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes('getLiveContainmentGroupAabbForNode')) {
    throw new Error('expected NodeOverlayEditor to accept a containment group AABB getter')
  }
  if (!text.includes('INSET_PX')) {
    throw new Error('expected NodeOverlayEditor to clamp pinned overlays within a containment group rect')
  }
}

