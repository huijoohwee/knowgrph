import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

export function testStoryboardWidgetInspectorUsesSharedSectionChooser() {
  const text = read('src/components/StoryboardWidget/StoryboardWidgetInspectorTabs.tsx')
  if (!text.includes('<ToolbarDropdownSelect') || !text.includes('title={`Inspector section:') || text.includes('aria-label="Inspector tabs"')) {
    throw new Error('expected Storyboard Widget inspector section switching to use the shared click-expand-down chooser instead of a local horizontal tabs row')
  }
}

export function testStoryboardWidgetSpecificationUsesSharedSectionChooser() {
  const text = read('src/features/storyboard-widget-manager/StoryboardWidgetSpecificationTab.tsx')
  if (!text.includes('<ToolbarDropdownSelect') || !text.includes('title={`Specification section:') || text.includes('aria-label="Specification tabs"')) {
    throw new Error('expected Storyboard Widget specification section switching to use the shared click-expand-down chooser instead of a local horizontal tabs row')
  }
}
