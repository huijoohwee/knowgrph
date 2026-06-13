import fs from 'node:fs'
import path from 'node:path'

export function testToolbarAlwaysExpandedWithoutCollapseControls() {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'Toolbar.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  const launcherText = fs.readFileSync(path.resolve(process.cwd(), 'src', 'features', 'toolbar', 'ToolbarMenuLauncher.tsx'), { encoding: 'utf8' })

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
  if (!text.includes('title={canRunAll ? \'Run all\'')) {
    throw new Error('expected Run all button to be rendered on Toolbar')
  }
  if (!text.includes('emitFloatingPanelOpen({ tab: runAllFloatingPanelTab, open: true, runAllOnOpen: true })')) {
    throw new Error('expected Run all button to mount renderer-owned floating panel with a mounted-view Run all request')
  }
  if (!text.includes('graphStore.setFloatingPanelView(runAllFloatingPanelTab)') || !text.includes('graphStore.setFloatingPanelOpen(true)')) {
    throw new Error('expected Run all button to force the renderer-owned floating panel view before dispatching Run all')
  }
  if (!text.includes('createStrybldrLocalVideoArtifactFromGraphData') || !text.includes("runAllFloatingPanelTab === 'strybldr'")) {
    throw new Error('expected Toolbar Run all to use the headless Strybldr local video artifact owner')
  }
  if (!text.includes('TOOLBAR_RUN_ALL_PANEL_DISPATCH_DELAY_MS')) {
    throw new Error('expected renderer-owned Run all dispatch to wait for panel consumer mount')
  }
  if (!text.includes('TOOLBAR_RUN_ALL_PANEL_RETRY_DELAY_MS')) {
    throw new Error('expected renderer-owned Run all dispatch to retry once after lazy panel mount')
  }
  if (!text.includes('window.setTimeout(emitToolbarRunAll, TOOLBAR_RUN_ALL_PANEL_RETRY_DELAY_MS)')) {
    throw new Error('expected Run all button to use a bounded retry after opening the renderer-owned floating panel')
  }
  if (!launcherText.includes('window.addEventListener(FLOATING_PANEL_OPEN_EVENT, handleFloatingPanelOpenEvent)')) {
    throw new Error('expected Toolbar launcher to wake renderer-owned floating panels from the shared open event')
  }
  if (!launcherText.includes('runAllOnOpen: detail?.runAllOnOpen === true')) {
    throw new Error('expected Toolbar launcher to preserve mounted-view Run all requests')
  }
  const toolbarMenuText = fs.readFileSync(path.resolve(process.cwd(), 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'), { encoding: 'utf8' })
  if (!toolbarMenuText.includes('runAllRequestSeq={requestedFloatingPanelRunAllSeq}')) {
    throw new Error('expected Toolbar floating panel to pass mounted Run all requests into the Strybldr owner view')
  }
  if (!text.includes('emitWorkflowRunAll({ source: \'toolbar\' })')) {
    throw new Error('expected Run all button to emit the toolbar workflow-run event')
  }
}
