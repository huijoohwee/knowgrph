import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterManualPlacementAuthorityUsesSharedHelper() {
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const authorityPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'widgetPlacementAuthority.ts')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const overlayPlacementRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const graphDataCommitActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const authorityText = readFileSync(authorityPath, 'utf8')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const overlayPlacementRuntimeText = readFileSync(overlayPlacementRuntimePath, 'utf8')
  const runtimeText = readFileSync(runtimeScenePath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const graphDataCommitActionsText = readFileSync(graphDataCommitActionsPath, 'utf8')

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
  if (!authorityText.includes('function hasAutoManagedWidgetOverlap(')) {
    throw new Error('expected widget placement authority SSOT to reject overlapped frontmatter collectives before preserving same-source screen layouts')
  }
  if (!overlayText.includes('shouldUseFlowEditorWidgetFloatingScreenAuthority')) {
    throw new Error('expected node overlay runtime to reuse the shared frontmatter floating screen-authority helper')
  }
  if (!overlayPlacementRuntimeText.includes('const storedWorld = floatingUsesScreenAuthority ? null : (currentStoredWorld || widgetWorldPosRef.current)')) {
    throw new Error('expected frontmatter floating screen-authority mode to ignore stored world positions as a placement authority')
  }
  if (!overlayPlacementRuntimeText.includes('persistWorldPos(nextWorld)')) {
    throw new Error('expected node overlay runtime to keep derived world positions synchronized for edge anchors and fit logic')
  }
  if (!runtimeText.includes('shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected pinned widget runtime seeding to reuse the shared auto-placement authority helper')
  }
  if (!collisionText.includes('shouldAutoPlaceFlowEditorWidget')) {
    throw new Error('expected floating widget collision auto-placement to reuse the shared auto-placement authority helper')
  }
  if (!collisionText.includes("nodeTypeId: String(nodeById?.get(id)?.type || '').trim()")) {
    throw new Error('expected floating widget collision auto-placement to pass built-in node-type context through the shared node lookup helper')
  }
  if (!authorityText.includes('export function shouldPreserveFrontmatterAutoManagedBalancedCollective')) {
    throw new Error('expected widget placement authority SSOT to expose a pure helper for preserving only balanced floating frontmatter collectives')
  }
  if (!authorityText.includes('export function shouldCarryForwardFlowWidgetOverlayStateOnGraphCommit')) {
    throw new Error('expected widget placement authority SSOT to expose one graph-commit helper for widget overlay carry-forward policy')
  }
  if (
    !authorityText.includes("if (kind === 'frontmatter-flow') {")
    || !authorityText.includes('return args.carryForwardSameSourceUiState === true && args.stableSameSourceNodeLayout === true')
  ) {
    throw new Error('expected graph-commit widget carry-forward helper to gate frontmatter-flow carry on stable same-source node layout outside balanced collective preservation')
  }
  if (!graphDataCommitActionsText.includes('stripFrontmatterAutoManagedWidgetScreenPositions')) {
    throw new Error('expected graph commit path to strip stale frontmatter built-in screen positions via the shared authority helper')
  }
  if (!graphDataCommitActionsText.includes('shouldPreserveFrontmatterAutoManagedBalancedCollective')) {
    throw new Error('expected graph commit path to detect balanced floating frontmatter collectives before carrying overlay state across same-source layout churn')
  }
  if (!graphDataCommitActionsText.includes('preserveBalancedCollective: args.preserveStableSameSourceOverlayState')) {
    throw new Error('expected graph commit path to preserve only balanced same-source frontmatter collective screen layouts')
  }
  if (!graphDataCommitActionsText.includes('shouldCarryForwardFlowWidgetOverlayStateOnGraphCommit')) {
    throw new Error('expected graph commit path to reuse the shared widget overlay carry-forward helper instead of duplicating frontmatter same-source carry policy')
  }
}
