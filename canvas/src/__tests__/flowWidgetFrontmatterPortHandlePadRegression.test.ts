import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetFrontmatterPadAccountsForPortHandles() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const frontmatterPlacementPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'nodeOverlayFrontmatterPlacement.ts')
  const text = readFileSync(p, 'utf8')
  const frontmatterPlacementText = readFileSync(frontmatterPlacementPath, 'utf8')

  if (!frontmatterPlacementText.includes("String(graphMetaKind || '').trim() === 'frontmatter-flow'") || !text.includes('isFrontmatterManagedOverlayNode(graphMetaKind')) {
    throw new Error('expected NodeOverlayEditor to treat frontmatter-flow as port-handles enabled')
  }
  if (!text.includes('readPortHandleUiMetrics')) {
    throw new Error('expected NodeOverlayEditor to use port handle UI metrics when anchoring overlays')
  }
}
