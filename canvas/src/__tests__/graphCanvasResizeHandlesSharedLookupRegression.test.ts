import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasResizeHandlesReuseSceneLookup() {
  const sceneText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts'),
    'utf8',
  )
  const resizeHandlesText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'resizeHandles.ts'),
    'utf8',
  )

  if (!sceneText.includes('nodeById: displayNodeById')) {
    throw new Error('expected GraphCanvas scene to pass its shared display lookup into the resize handles layer')
  }

  if (
    !resizeHandlesText.includes('nodeById: ReadonlyMap<string, GraphNode> | null')
    || !resizeHandlesText.includes("const node = nodeById?.get(selectedId) || null")
    || resizeHandlesText.includes("nodes.find(n => String(n.id || '') === selectedId)")
  ) {
    throw new Error('expected resize handles layer to reuse the shared scene lookup instead of rescanning display nodes by selected id')
  }
}
