import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayCollisionResolveIsNotScheduledFromLiveInteractionTick() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('scheduleOverlayCollisionResolve')) {
    throw new Error('expected FlowEditorCanvas to define scheduleOverlayCollisionResolve')
  }
  if (text.includes('scheduleOverlayCollisionResolve,\n    liveInteractionTick')) {
    throw new Error('expected overlay collision scheduling not to depend on liveInteractionTick')
  }
}

