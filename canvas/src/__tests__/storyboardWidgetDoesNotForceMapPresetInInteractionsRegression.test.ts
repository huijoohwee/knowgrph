import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetDoesNotForceMapPresetInInteractions() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'bindFlowCanvasNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes("storyboardWidgetMode ? 'map'") || text.includes("storyboardWidgetMode ? ('map'")) {
    throw new Error('expected StoryboardWidget to respect viewportControlsPreset and not force map preset in interaction handlers')
  }
}
