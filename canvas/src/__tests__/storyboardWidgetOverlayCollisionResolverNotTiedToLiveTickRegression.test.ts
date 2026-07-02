import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetOverlayCollisionResolveIsNotScheduledFromLiveInteractionTick() {
  const p = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlayCollision.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('scheduleOverlayCollisionResolve')) {
    throw new Error('expected overlay collision runtime to define scheduleOverlayCollisionResolve')
  }
  if (text.includes('liveInteractionTick')) {
    throw new Error('expected overlay collision runtime not to depend on liveInteractionTick')
  }
}
