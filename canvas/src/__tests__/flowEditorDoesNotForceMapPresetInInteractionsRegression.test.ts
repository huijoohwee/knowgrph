import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorDoesNotForceMapPresetInInteractions() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'bindFlowCanvasNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes("isFlowEditor ? 'map'") || text.includes("isFlowEditor ? ('map'")) {
    throw new Error('expected FlowEditor to respect viewportControlsPreset and not force map preset in interaction handlers')
  }
}
