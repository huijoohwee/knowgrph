import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetEditorUsesRafLatestSchedulerForDrags() {
  const p = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'useWidgetDragHandlers.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('createRafLatestScheduler')) {
    throw new Error('expected WidgetEditor to use createRafLatestScheduler for drag throttling')
  }
  if (text.includes('requestAnimationFrame(flush)')) {
    throw new Error('expected WidgetEditor drags to avoid manual requestAnimationFrame(flush) patterns')
  }
}
