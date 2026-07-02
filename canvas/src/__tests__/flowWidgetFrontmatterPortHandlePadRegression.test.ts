import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowWidgetFrontmatterPadAccountsForPortHandles() {
  const p = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'useWidgetPlacementRuntime.ts')
  const frontmatterPlacementPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'widgetFrontmatterPlacement.ts')
  const text = readFileSync(p, 'utf8')
  const frontmatterPlacementText = readFileSync(frontmatterPlacementPath, 'utf8')

  if (!frontmatterPlacementText.includes("String(graphMetaKind || '').trim() === 'frontmatter-flow'") || !text.includes('isFrontmatterManagedOverlayNode(graphMetaKind')) {
    throw new Error('expected WidgetEditor to treat frontmatter-flow as port-handles enabled')
  }
  if (!text.includes('readPortHandleUiMetrics')) {
    throw new Error('expected WidgetEditor to use port handle UI metrics when anchoring overlays')
  }
}
