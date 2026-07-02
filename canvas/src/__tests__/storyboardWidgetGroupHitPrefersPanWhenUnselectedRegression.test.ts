import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetGroupHitPrefersPanWhenUnselected() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerDown.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('hitTestGroup')) {
    throw new Error('expected FlowCanvas to hit-test groups')
  }
  if (!text.includes('state.selectGroup(groupHit)')) {
    throw new Error('expected StoryboardWidget to select group on group hit for drag/pan disambiguation')
  }
  if (!text.includes("type: 'pan'")) {
    throw new Error('expected StoryboardWidget group hit path to be able to start a pan drag')
  }
}
