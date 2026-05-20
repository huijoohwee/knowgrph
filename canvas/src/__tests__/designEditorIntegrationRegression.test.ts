import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

export function testDesignEditorMainPanelTabUsesSharedSurface() {
  const tabs = read('src/features/panels/mainPanelTabs.ts')
  const mainPanel = read('src/features/panels/MainPanel.tsx')
  const view = read('src/features/panels/views/DesignEditorMainPanelView.tsx')
  const toolbarContext = read('src/components/toolbar/useCanvasToolbarContext.ts')

  if (!tabs.includes("| 'design'") || !tabs.includes("key: 'design'")) {
    throw new Error('expected MainPanel to expose a neutral Design editor tab')
  }
  if (!mainPanel.includes('DesignEditorMainPanelViewLazy') || !mainPanel.includes('design: Palette')) {
    throw new Error('expected MainPanel Design tab to mount the shared Design editor surface')
  }
  if (!view.includes('DesignFloatingPanelView') || !view.includes("canvas2dRenderer === 'design'")) {
    throw new Error('expected MainPanel Design view to reuse the Design floating-panel implementation')
  }
  if (!toolbarContext.includes("detailTab === 'design'")) {
    throw new Error('expected shared main-panel open handler to accept the Design tab')
  }
}

export function testDesignEditorOverviewIsSharedByDesignSurfaces() {
  const floatingPanel = read('src/features/design/DesignFloatingPanelView.tsx')
  const overview = read('src/features/design/DesignEditorOverviewPanel.tsx')
  const helper = read('src/features/design/designEditorLaunchState.ts')

  if (!floatingPanel.includes('DesignEditorOverviewPanel') || !floatingPanel.includes("id: 'overview'")) {
    throw new Error('expected Design surfaces to expose the shared editor overview tab')
  }
  for (const snippet of ['summarizeDesignTokens', 'dispatchRuntimeFitToViewSoon', 'activateDesignEditorSurface']) {
    if (!overview.includes(snippet)) throw new Error(`expected Design overview to reuse shared editor capability: ${snippet}`)
  }
  for (const snippet of ['setCanvasRenderMode', "setCanvas2dRenderer('design')", 'setFloatingPanelView']) {
    if (!helper.includes(snippet)) throw new Error(`expected Design launch helper to centralize Design editor state: ${snippet}`)
  }
}

export function testImportUrlDesignSelectionActivatesSharedDesignSurface() {
  const launcher = read('src/lib/toolbar/LaunchDropdown.impl.tsx')
  const importActions = read('src/features/markdown-workspace/useWorkspaceFileActions/importActions.ts')
  const fallbacks = read('src/features/toolbar/launchDropdownFallbacks.ts')
  const deerflowAction = read('src/features/markdown-workspace/useWorkspaceFileActions/deerflowUrlImportAction.ts')
  const deerflowImport = read('src/features/markdown-workspace/workspaceImport/deerflowUrlImport.ts')
  const rendererSelect = read('src/lib/toolbar/ImportUrlRendererSelect.tsx')

  if (!rendererSelect.includes("DESIGN_IMPORT_URL_RENDERER_SELECTION") || rendererSelect.includes("isWorkspaceUrlImportCanvasRendererId(value) ?")) {
    throw new Error('expected Import URL renderer selection to expose Design explicitly without legacy bare-renderer remapping')
  }
  for (const [label, text] of [
    ['LaunchDropdown', launcher],
    ['workspace import actions', importActions],
    ['launch fallback', fallbacks],
    ['DeerFlow action', deerflowAction],
  ] as const) {
    if (!text.includes('activateDesignEditorSurface')) {
      throw new Error(`expected ${label} to activate the shared Design editor state for Design URL imports`)
    }
  }
  if (!deerflowImport.includes('getWorkspaceUrlImportCanvasPreset') || !deerflowImport.includes('buildWebpageWorkspaceEntryTextFromUpstreamMarkdown')) {
    throw new Error('expected DeerFlow URL import to carry the same renderer preset frontmatter as regular Import URL')
  }
}
