import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasSchedulesRichMediaOverlayOnInteractionFrame() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const handleInteractionFrame')) {
    throw new Error('expected FlowCanvas to define handleInteractionFrame')
  }
  if (!text.includes('mediaOverlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected FlowCanvas interaction frames to schedule media overlay layout')
  }
}

