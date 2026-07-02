import fs from 'node:fs'
import path from 'node:path'

export const testStoryboardWidgetFrontmatterSwitchKeepsWidgetLayoutPositions = () => {
  const documentActionPath = path.resolve(
    process.cwd(),
    'src',
    'hooks',
    'store',
    'graph-data-slice',
    'graphDataDocumentActions.ts',
  )
  const text = fs.readFileSync(documentActionPath, 'utf8')
  if (!text.includes('if (isWorkspaceGraphMutationBlocked(state)) return')) {
    throw new Error('Expected frontmatter-only flow import runtime cleanup to respect the shared workspace graph mutation guard')
  }
  if (text.includes('setFlowWidgetPosByNodeId({})')) {
    throw new Error('Expected frontmatter-only flow import runtime cleanup not to clear widget screen positions during Source Files switches')
  }
  if (text.includes('setFlowWidgetWorldPosByNodeId({})')) {
    throw new Error('Expected frontmatter-only flow import runtime cleanup not to clear widget world positions during Source Files switches')
  }
}

export const testStoryboardWidgetFrontmatterCommitPathDoesNotForceWorkspaceOverlayReset = () => {
  const commitActionPath = path.resolve(
    process.cwd(),
    'src',
    'hooks',
    'store',
    'graph-data-slice',
    'graphDataCommitActions.ts',
  )
  const text = fs.readFileSync(commitActionPath, 'utf8')
  if (text.includes('forceResetFrontmatterOverlayCarry') || text.includes('forceResetOverlayCarry')) {
    throw new Error('expected frontmatter graph commit path not to force-clear keyed widget layout state while the workspace is open')
  }
  if (!text.includes('shouldCarryForwardFlowWidgetOverlayStateOnGraphCommit({')) {
    throw new Error('expected frontmatter graph commit path to keep using the shared widget placement authority')
  }
}
