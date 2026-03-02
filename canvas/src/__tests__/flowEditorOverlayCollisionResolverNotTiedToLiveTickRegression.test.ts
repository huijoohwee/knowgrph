import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayCollisionResolveIsNotScheduledFromLiveInteractionTick() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('scheduleOverlayCollisionResolve')) {
    throw new Error('expected FlowEditorCanvas to define scheduleOverlayCollisionResolve')
  }
  if (text.includes('liveInteractionTick')) {
    throw new Error('expected FlowEditorCanvas not to depend on liveInteractionTick')
  }
}
