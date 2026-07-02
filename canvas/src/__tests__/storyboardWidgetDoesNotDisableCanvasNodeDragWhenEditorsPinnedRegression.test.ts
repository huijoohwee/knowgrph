import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetDoesNotDisableCanvasNodeDragWhenEditorsPinned() {
  const p = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('allowNodeDragOverride={anyEditorPinnedToNode ? false : undefined}')) {
    throw new Error('expected StoryboardWidgetCanvas to avoid disabling node drag while widgets are pinned')
  }
}
