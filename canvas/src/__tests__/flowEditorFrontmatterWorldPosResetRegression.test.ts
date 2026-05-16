import fs from 'node:fs'
import path from 'node:path'

export const testFlowEditorFrontmatterImportResetsWorldWidgetPositions = () => {
  const documentActionPath = path.resolve(
    process.cwd(),
    'src',
    'hooks',
    'store',
    'graph-data-slice',
    'graphDataDocumentActions.ts',
  )
  const text = fs.readFileSync(documentActionPath, 'utf8')
  const enforceFrontmatterOnlyIndex = text.indexOf('if (enforceFrontmatterOnly) {')
  const screenPosResetIndex = text.indexOf('afterApplyState.setFlowWidgetPosByNodeId({})')
  const worldPosResetIndex = text.indexOf('afterApplyState.setFlowWidgetWorldPosByNodeId({})')
  if (enforceFrontmatterOnlyIndex < 0 || screenPosResetIndex < 0 || worldPosResetIndex < 0) {
    throw new Error('Expected frontmatter-only flow import path to reset persisted widget screen/world positions')
  }
  if (screenPosResetIndex < enforceFrontmatterOnlyIndex) {
    throw new Error('Expected screen position reset to happen inside the frontmatter-only import guard')
  }
  if (worldPosResetIndex < enforceFrontmatterOnlyIndex) {
    throw new Error('Expected world position reset to happen inside the frontmatter-only import guard')
  }
}

export const testFlowEditorFrontmatterCommitPathClearsOverlayCarryState = () => {
  const commitActionPath = path.resolve(
    process.cwd(),
    'src',
    'hooks',
    'store',
    'graph-data-slice',
    'graphDataCommitActions.ts',
  )
  const text = fs.readFileSync(commitActionPath, 'utf8')
  if (!text.includes("const forceResetFrontmatterOverlayCarry =")) {
    throw new Error('expected frontmatter graph commit path to detect workspace-open overlay carry reset conditions')
  }
  if (!text.includes('const nextPinned =\n        forceResetFrontmatterOverlayCarry\n          ? {}')) {
    throw new Error('expected frontmatter graph commit path to clear stale pinned carry before keyed restore')
  }
  if (!text.includes('const nextPosRaw =\n        forceResetFrontmatterOverlayCarry\n          ? {}')) {
    throw new Error('expected frontmatter graph commit path to clear stale screen carry before keyed restore')
  }
}
