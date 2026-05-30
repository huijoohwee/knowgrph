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
  if (!text.includes('const canRunAll = supportsToolbarRunAll(canvas2dRenderer)')) {
    throw new Error('expected Toolbar Run all readiness to use the shared renderer capability helper')
  }
  if (!text.includes('const runAllFloatingPanelTab = getToolbarRunAllFloatingPanelTab(canvas2dRenderer)')) {
    throw new Error('expected Toolbar Run all panel activation to use the shared renderer capability helper')
  }
  if (!text.includes('runAllFloatingPanelConsumerMounted')) {
    throw new Error('expected Toolbar Run all to reuse an already mounted renderer-owned floating panel consumer')
  }
  if (!text.includes('title={canRunAll ? \'Run all\'')) {
    throw new Error('expected Run all button to be rendered on Toolbar')
  }
  if (!text.includes('emitFloatingPanelOpen({ tab: runAllFloatingPanelTab, open: true })')) {
    throw new Error('expected Run all button to mount renderer-owned floating panel before dispatch')
  }
  if (!text.includes('TOOLBAR_RUN_ALL_PANEL_DISPATCH_DELAY_MS')) {
    throw new Error('expected renderer-owned Run all dispatch to wait for panel consumer mount')
  }
  if (!text.includes('emitWorkflowRunAll({ source: \'toolbar\' })')) {
    throw new Error('expected Run all button to emit the toolbar workflow-run event')
  }
}
