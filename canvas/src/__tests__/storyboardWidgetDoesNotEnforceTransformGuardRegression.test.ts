import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardWidgetDoesNotEnforceTransformGuard() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  if (!text.includes('if (storyboardWidgetMode && alreadyInitializedForKey) return')) {
    throw new Error('expected StoryboardWidget to not snap back camera after initialization')
  }
  if (text.includes('if (storyboardWidgetMode && alreadyInitializedForKey) {') && text.includes('isFlowTransformShowingGraph')) {
    throw new Error('expected StoryboardWidget to avoid transform guard that prevents infinite panning')
  }
  if (text.includes('buildStoryboardWidgetCameraInitKey')) {
    throw new Error('expected StoryboardWidget to avoid init keys that churn on graph revisions')
  }
  if (!text.includes('const initKey = zoomViewKey')) {
    throw new Error('expected StoryboardWidget to reuse zoomViewKey-based camera initialization like D3')
  }
  if (!runtimeText.includes('const initKey = zoomViewKey') || runtimeText.includes('`storyboardWidget:${zoomViewKey}`')) {
    throw new Error('expected StoryboardWidget render and runtime camera guards to share the exact same zoomViewKey identity')
  }
}
