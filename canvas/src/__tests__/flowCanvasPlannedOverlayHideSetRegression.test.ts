import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasHidesPlannedOverlayNodesNotJustMountedElements() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('plannedOverlayNodeIdSetRef')) {
    throw new Error('expected FlowCanvas to track planned overlay node ids')
  }
  if (!text.includes('Array.from(plannedOverlayNodeIdSetRef.current)')) {
    throw new Error('expected FlowCanvas hide lists to use planned overlay ids')
  }
}

