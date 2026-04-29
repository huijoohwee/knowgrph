import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterManualPlacementAuthorityUsesSharedHelper() {
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const runtimeText = readFileSync(runtimeScenePath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')

  if (!sharedText.includes('export function shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected Flow Editor shared runtime to expose one SSOT helper for widget auto-placement authority')
  }
  if (!runtimeText.includes('shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected pinned widget runtime seeding to reuse the shared auto-placement authority helper')
  }
  if (!collisionText.includes('shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected floating widget collision auto-placement to reuse the shared auto-placement authority helper')
  }
}
