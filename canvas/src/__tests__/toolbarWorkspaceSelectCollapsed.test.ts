import fs from 'node:fs'
import path from 'node:path'

export function testToolbarCollapsedStillRendersWorkspaceSelect() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'Toolbar.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  const collapsedBranchIndex = text.indexOf('{toolbarCollapsed ? (')
  if (collapsedBranchIndex < 0) throw new Error('expected Toolbar to have a toolbarCollapsed conditional branch')

  const expandedBranchIndex = text.indexOf(') : (', collapsedBranchIndex)
  if (expandedBranchIndex < 0) throw new Error('expected Toolbar to have an expanded branch after toolbarCollapsed')

  const collapsedBranch = text.slice(collapsedBranchIndex, expandedBranchIndex)

  if (!collapsedBranch.includes('<ToolbarMenuLauncher')) {
    throw new Error('expected ToolbarMenuLauncher to be visible in collapsed toolbar')
  }
  if (!collapsedBranch.includes('<EditorWorkspaceSelect')) {
    throw new Error('expected EditorWorkspaceSelect to be visible in collapsed toolbar')
  }
  if (!collapsedBranch.includes('<Canvas2dRendererSelect')) {
    throw new Error('expected Canvas2dRendererSelect to be visible in collapsed toolbar')
  }
  if (!collapsedBranch.includes('title="Expand toolbar"')) {
    throw new Error('expected an Expand toolbar button in collapsed toolbar')
  }
  if (collapsedBranch.includes('<DocumentModeSelect')) {
    throw new Error('expected DocumentModeSelect to be hidden in collapsed toolbar')
  }
  if (collapsedBranch.includes('infiniteCanvasInteractionMode')) {
    throw new Error('expected non-core toolbar controls to be hidden in collapsed toolbar')
  }
}
