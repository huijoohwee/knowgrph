import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorDoesNotEnforceTransformGuard() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('if (isFlowEditor && alreadyInitializedForKey) return')) {
    throw new Error('expected FlowEditor to not snap back camera after initialization')
  }
  if (text.includes('if (isFlowEditor && alreadyInitializedForKey) {') && text.includes('isFlowTransformShowingGraph')) {
    throw new Error('expected FlowEditor to avoid transform guard that prevents infinite panning')
  }
  if (text.includes('buildFlowEditorCameraInitKey')) {
    throw new Error('expected FlowEditor to avoid init keys that churn on graph revisions')
  }
  if (!text.includes('const initKey = zoomViewKey')) {
    throw new Error('expected FlowEditor to reuse zoomViewKey-based camera initialization like D3')
  }
}
