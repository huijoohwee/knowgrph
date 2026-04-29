import fs from 'node:fs'
import path from 'node:path'

export function testToolbarAlwaysExpandedWithoutCollapseControls() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'Toolbar.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })

  if (text.includes('title="Expand toolbar"') || text.includes('title="Collapse toolbar"')) {
    throw new Error('expected Toolbar to remove Expand/Collapse toolbar controls')
  }
  if (text.includes('{toolbarCollapsed ? (')) {
    throw new Error('expected Toolbar to remove toolbarCollapsed branch')
  }
  if (!text.includes('<ToolbarMenuLauncherLazy')) {
    throw new Error('expected ToolbarMenuLauncher to stay visible in toolbar')
  }
  if (!text.includes('<EditorWorkspaceSelect')) {
    throw new Error('expected EditorWorkspaceSelect to stay visible in toolbar')
  }
  if (!text.includes('<Canvas2dRendererSelect')) {
    throw new Error('expected Canvas2dRendererSelect to stay visible in toolbar')
  }
  if (!text.includes('title={canvas2dRenderer === \'flowEditor\' ? \'Run all\'')) {
    throw new Error('expected Run all button to be rendered on Toolbar')
  }
}
