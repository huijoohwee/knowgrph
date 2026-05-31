import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorMinimapIsEnabled() {
  const p = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const renderConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.render.ts')
  const text = readFileSync(p, 'utf8')
  const renderConfigText = readFileSync(renderConfigPath, 'utf8')
  if (!text.includes('<MinimapLazy')) {
    throw new Error('expected CanvasViewport to render Minimap overlay in workspace variant')
  }
  if (!text.includes('supportsCanvas2dMinimap(canvas2dRenderer)')) {
    throw new Error('expected CanvasViewport to use the shared minimap support helper')
  }
  if (
    !renderConfigText.includes("flowEditor: {") ||
    !renderConfigText.includes("surfaceId: 'flowEditor'") ||
    !renderConfigText.includes('getCanvas2dSurfaceId(id) !== null')
  ) {
    throw new Error('expected shared renderer surface helper to preserve Flow Editor as a minimap-capable surface')
  }
}
