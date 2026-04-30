import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterManualPlacementAuthorityUsesSharedHelper() {
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const authorityPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'widgetPlacementAuthority.ts')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const graphDataSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSlice.ts')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const authorityText = readFileSync(authorityPath, 'utf8')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const runtimeText = readFileSync(runtimeScenePath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const graphDataSliceText = readFileSync(graphDataSlicePath, 'utf8')

  if (!sharedText.includes('export {')) {
    throw new Error('expected Flow Editor canvas shared module to re-export pure widget placement authority helpers')
  }
  if (!authorityText.includes('export function shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected Flow Editor shared runtime to expose one SSOT helper for widget auto-placement authority')
  }
  if (!authorityText.includes('nodeTypeId?: string | null')) {
    throw new Error('expected Flow Editor shared auto-placement authority helper to accept node type context')
  }
  if (!authorityText.includes("if (!pinnedInCanvas && isCanonicalFrontmatterBuiltInWidgetNode({ id: '', type: nodeTypeId })) return true")) {
    throw new Error('expected canonical frontmatter built-in floating widgets to stay auto-rebalanceable even with stored screen positions')
  }
  if (!authorityText.includes('export function shouldUseFlowEditorWidgetFloatingScreenAuthority')) {
    throw new Error('expected Flow Editor shared runtime to expose one SSOT helper for frontmatter floating screen-authority rules')
  }
  if (!authorityText.includes('export function stripFrontmatterAutoManagedWidgetScreenPositions')) {
    throw new Error('expected widget placement authority SSOT to strip stale frontmatter built-in screen positions during graph rebuilds')
  }
  if (!authorityText.includes('preserveBalancedCollective?: boolean')) {
    throw new Error('expected widget placement authority SSOT to support preserving balanced same-source frontmatter collective layouts while stripping residue clusters')
  }
  if (!authorityText.includes('isVerticalOverlayCluster') || !authorityText.includes('isHorizontalOverlayStrip')) {
    throw new Error('expected widget placement authority SSOT to detect vertical/horizontal residue before preserving same-source frontmatter screen layouts')
  }
  if (!overlayText.includes('shouldUseFlowEditorWidgetFloatingScreenAuthority')) {
    throw new Error('expected node overlay runtime to reuse the shared frontmatter floating screen-authority helper')
  }
  if (!overlayText.includes('const storedWorld = floatingUsesScreenAuthority ? null : widgetWorldPosRef.current')) {
    throw new Error('expected frontmatter floating screen-authority mode to ignore stored world positions as a placement authority')
  }
  if (!overlayText.includes('persistWorldPos(nextWorld)')) {
    throw new Error('expected node overlay runtime to keep derived world positions synchronized for edge anchors and fit logic')
  }
  if (!runtimeText.includes('shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected pinned widget runtime seeding to reuse the shared auto-placement authority helper')
  }
  if (!collisionText.includes('shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected floating widget collision auto-placement to reuse the shared auto-placement authority helper')
  }
  if (!collisionText.includes('nodeTypeId: nodeTypeById.get(id) || \'\'')) {
    throw new Error('expected floating widget collision auto-placement to pass built-in node-type context into the shared helper')
  }
  if (!graphDataSliceText.includes('stripFrontmatterAutoManagedWidgetScreenPositions')) {
    throw new Error('expected graph commit path to strip stale frontmatter built-in screen positions via the shared authority helper')
  }
  if (!graphDataSliceText.includes('preserveBalancedCollective: args.preserveStableSameSourceOverlayState')) {
    throw new Error('expected graph commit path to preserve only balanced same-source frontmatter collective screen layouts')
  }
}
