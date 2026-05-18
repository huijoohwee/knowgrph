import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testPanelHeaderUsesAriaTablist = () => {
  const root = process.cwd()
  const tabHeaderPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'TabHeader.tsx')
  const text = readUtf8(tabHeaderPath)
  if (!text.includes('role="tablist"') && !text.includes("role='tablist'")) {
    throw new Error('Expected TabHeader to render a tablist role')
  }
  if (!text.includes('role="tab"') && !text.includes("role='tab'")) {
    throw new Error('Expected TabHeader to render tab roles')
  }
}

export const testMainPanelContainerUsesKgPanelBg = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'MainPanelContainer.tsx')
  const text = readUtf8(filePath)
  if (text.includes('var(--panel-bg)')) throw new Error('Expected MainPanelContainer to avoid var(--panel-bg)')
  if (!text.includes('var(--kg-panel-bg)')) throw new Error('Expected MainPanelContainer to use var(--kg-panel-bg)')
}

export const testPanelShellUsesResponsiveWrapping = () => {
  const root = process.cwd()
  const tabHeaderPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'TabHeader.tsx')
  const headerActionsPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'HeaderActions.tsx')
  const floatingPanelPath = path.resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')

  const tabHeader = readUtf8(tabHeaderPath)
  if (!tabHeader.includes('flex-wrap items-start gap-y-1 sm:flex-nowrap sm:items-center')) {
    throw new Error('Expected TabHeader shell to wrap responsively on narrow widths')
  }
  if (!tabHeader.includes('basis-full w-full sm:basis-auto sm:w-72')) {
    throw new Error('Expected TabHeader search shell to expand full-width on narrow widths')
  }

  const headerActions = readUtf8(headerActionsPath)
  if (!headerActions.includes('flex max-w-full flex-wrap items-center justify-end gap-1')) {
    throw new Error('Expected HeaderActions to wrap instead of overlapping on narrow widths')
  }

  const floatingPanel = readUtf8(floatingPanelPath)
  if (!floatingPanel.includes('max-w-[calc(100vw-1rem)]')) {
    throw new Error('Expected FloatingPanel shell to cap width against viewport bounds')
  }
  if (!floatingPanel.includes('flex w-full flex-wrap items-start justify-between gap-1 sm:items-center sm:gap-2')) {
    throw new Error('Expected FloatingPanel header shell to wrap responsively')
  }
}

export const testKeyValueRowsUseMobileSingleColumnFallback = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'KeyTypeValueRow.tsx')
  const text = readUtf8(filePath)
  if (!text.includes('grid-cols-1 sm:grid-cols-')) {
    throw new Error('Expected KeyTypeValueRow layouts to fall back to a single column on narrow widths')
  }
  if (!text.includes('justify-start sm:justify-end')) {
    throw new Error('Expected right-aligned value cells to relax to start alignment on narrow widths')
  }
}

export const testToolbarRendererViewLazyLoadsWorkspaceTableModeControl = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarToolMenuRendererView.tsx')
  const text = readUtf8(filePath)
  if (text.includes("import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'")) {
    throw new Error('Expected ToolbarToolMenuRendererView to avoid a static WorkspaceTableModeControl import')
  }
  if (!text.includes('const WorkspaceTableModeControlLazy = React.lazy(async () => {')) {
    throw new Error('Expected ToolbarToolMenuRendererView to lazy-load WorkspaceTableModeControl')
  }
  if (!text.includes('<WorkspaceTableModeControlLazy />')) {
    throw new Error('Expected ToolbarToolMenuRendererView to render the lazy workspace control')
  }
}

export const testWorkspaceTableModeControlAvoidsToolbarSsotBridge = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'workspace-table', 'ui', 'WorkspaceTableModeControl.tsx')
  const text = readUtf8(filePath)
  if (text.includes("from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('Expected WorkspaceTableModeControl to avoid workspaceTableSsot imports that can pull toolbar chunks into SettingsView')
  }
  if (!text.includes("from '@/features/graph-table-db/graphTableDb'")) {
    throw new Error('Expected WorkspaceTableModeControl to warm GraphTableDb directly')
  }
}

export const testMainPanelLazyLoadsInactiveHeavyTabs = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'MainPanel.tsx')
  const text = readUtf8(filePath)
  if (text.includes("import HelpView from '@/features/panels/views/HelpView'")) {
    throw new Error('Expected MainPanel to avoid a static HelpView import')
  }
  if (text.includes("import DashboardView from '@/features/panels/views/DashboardView'")) {
    throw new Error('Expected MainPanel to avoid a static DashboardView import')
  }
  if (text.includes("import WorkflowSection from '@/features/panels/views/WorkflowSection'")) {
    throw new Error('Expected MainPanel to avoid a static WorkflowSection import')
  }
  if (!text.includes("const HelpViewLazy = React.lazy(() => import('@/features/panels/views/HelpView'))")) {
    throw new Error('Expected MainPanel to lazy-load HelpView')
  }
  if (!text.includes("const DashboardViewLazy = React.lazy(() => import('@/features/panels/views/DashboardView'))")) {
    throw new Error('Expected MainPanel to lazy-load DashboardView')
  }
  if (text.includes("const WorkflowSectionLazy = React.lazy(() => import('@/features/panels/views/WorkflowSection'))")) {
    throw new Error('Expected MainPanel to avoid legacy WorkflowSection lazy loading after consolidation into FlowEditorManager')
  }
}

export const testMainPanelSettingsSurfacesSourceFileManagementContract = () => {
  const root = process.cwd()
  const settingsViewPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsView.tsx')
  const sourceFilePanelPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'SourceFileManagementSettingsPanel.tsx')
  const collapseStatePath = path.resolve(root, 'src', 'features', 'markdown', 'ui', 'useMarkdownExplorerSectionCollapseState.ts')
  const schemaPath = path.resolve(root, 'src', 'features', 'settings', 'settings-flow.schema.json')

  const settingsViewText = readUtf8(settingsViewPath)
  const sourceFilePanelText = readUtf8(sourceFilePanelPath)
  const collapseStateText = readUtf8(collapseStatePath)
  const schemaText = readUtf8(schemaPath)

  if (!settingsViewText.includes('<SourceFileManagementSettingsPanel')) {
    throw new Error('Expected MainPanel Settings to render the Source File Management panel')
  }
  if (!sourceFilePanelText.includes('Restore D1/docs defaults') || !sourceFilePanelText.includes('Open Source Files')) {
    throw new Error('Expected Source File Management settings panel to expose D1/docs restore and Source Files open actions')
  }
  if (!sourceFilePanelText.includes('scheduleApplyComposedGraphFromSourceFiles({ includeWorkspaceBacked: true })')) {
    throw new Error('Expected Source File Management settings panel to recompose D1/workspace-backed Source Files explicitly')
  }
  if (!sourceFilePanelText.includes('Import local files remains an explicit manual action')) {
    throw new Error('Expected Source File Management settings panel to document the manual-only local import boundary')
  }
  if (sourceFilePanelText.includes('importLocalFiles') || sourceFilePanelText.includes('openFilePicker')) {
    throw new Error('Expected Source File Management settings panel to avoid hidden Import local files actions')
  }
  if (!collapseStateText.includes('requestMarkdownExplorerSourceFilesOpen')) {
    throw new Error('Expected markdown explorer collapse state to expose a source-owned Source Files open request')
  }
  if (!schemaText.includes('"area": "Source File Management"')) {
    throw new Error('Expected settings schema to group Source Files controls under Source File Management')
  }
}

export const testWorkflowManagerReusesWorkspaceTableSsotForMultiDimView = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const text = readUtf8(filePath)
  if (!text.includes("from '@/features/workspace-table/workspaceTablePreferencesStore'")) {
    throw new Error('Expected Workflow Manager to read workspace table mode from workspaceTablePreferencesStore SSOT')
  }
  if (!text.includes('workspaceEditorMode === \'multiDimTable\'')) {
    throw new Error('Expected Workflow Manager to gate multi-dimensional table view by workspaceEditorMode SSOT')
  }
  if (!text.includes('<GraphTableWorkspace active />')) {
    throw new Error('Expected Workflow Manager to render GraphTableWorkspace for multi-dimensional table mode')
  }
  if (text.includes('Legacy graph-manager controls are suppressed for frontmatter workflow processing.')) {
    throw new Error('Expected Workflow Manager to remove dedicated workflow sections mode panel copy after Graph Fields consolidation')
  }
  if (text.includes('WorkflowManagerInspectorPanel')) {
    throw new Error('Expected Workflow Manager to avoid dedicated inspector panel and reuse Graph Fields pane model')
  }
}

export const testFloatingPanelRemovesDesignLayersViewAfterWorkflowManagerConsolidation = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx')
  const launcherPath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarMenuLauncher.tsx')
  const typesPath = path.resolve(root, 'src', 'features', 'toolbar', 'ToolbarToolMenuTypes.ts')
  const text = readUtf8(filePath)
  const launcherText = readUtf8(launcherPath)
  const typesText = readUtf8(typesPath)
  if (text.includes("view: 'designLayers'")) {
    throw new Error('Expected FloatingPanel to remove designLayers view after Workflow Manager consolidation')
  }
  if (text.includes("floatingPanelView === 'designLayers'")) {
    throw new Error('Expected FloatingPanel to avoid rendering designLayers branch after consolidation')
  }
  if (text.includes("view: 'discovery'")) {
    throw new Error('Expected FloatingPanel to remove legacy discovery tab after Props Panel Discovery Widget consolidation')
  }
  if (text.includes("floatingPanelView === 'discovery'")) {
    throw new Error('Expected FloatingPanel to remove dedicated discovery branch after Props Panel Discovery Widget consolidation')
  }
  if (text.includes('normalizeRequestedFloatingPanelView')) {
    throw new Error('Expected FloatingPanel to remove legacy requested-view remapping after discovery consolidation')
  }
  if (launcherText.includes("'discovery'")) {
    throw new Error('Expected ToolbarMenuLauncher to remove legacy discovery requested-view support')
  }
  if (typesText.includes("'discovery'")) {
    throw new Error('Expected ToolbarToolMenuProps to remove legacy discovery requested-view type support')
  }
}

export const testWorkflowManagerConsolidatedEntriesReuseGraphFieldsRightPane = () => {
  const root = process.cwd()
  const flowEditorGraphTabPath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const graphFieldsViewPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'GraphFieldsView.tsx')
  const graphTabText = readUtf8(flowEditorGraphTabPath)
  const graphFieldsText = readUtf8(graphFieldsViewPath)

  if (!graphTabText.includes('entryAliasLabels={WORKFLOW_ALIAS_LABELS}')) {
    throw new Error('Expected Workflow Manager to pass consolidated workflow alias labels into GraphFieldsView')
  }
  if (!graphTabText.includes('entryOpenRequest={entryOpenRequest}')) {
    throw new Error('Expected Workflow Manager to pass entry open requests into GraphFieldsView')
  }
  if (!graphFieldsText.includes('entryOpenRequest?:')) {
    throw new Error('Expected GraphFieldsView to accept consolidated entry open requests')
  }
  if (!graphFieldsText.includes('setSelectedFieldId(target.id)')) {
    throw new Error('Expected GraphFieldsView to open right-pane Field Settings by selecting a target field')
  }
  if (!graphFieldsText.includes('graphFields:entryOpen:')) {
    throw new Error('Expected GraphFieldsView consolidated entry-open path to provide visible toast confirmation')
  }
  if (!graphFieldsText.includes('scrollIntoView')) {
    throw new Error('Expected GraphFieldsView consolidated entry-open path to move focus toward right-pane Field Settings')
  }
}

export const testWorkflowManagerNonWorkflowListsReuseGraphFieldsRightPane = () => {
  const root = process.cwd()
  const flowEditorGraphTabPath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'FlowEditorGraphTab.tsx')
  const graphFieldsViewPath = path.resolve(root, 'src', 'features', 'panels', 'views', 'GraphFieldsView.tsx')
  const graphTabText = readUtf8(flowEditorGraphTabPath)
  const graphFieldsText = readUtf8(graphFieldsViewPath)
  if (!graphTabText.includes('aria-label="Graph Fields and Field Settings"')) {
    throw new Error('Expected non-workflow Workflow Manager surface to include embedded Graph Fields right pane')
  }
  if (!graphTabText.includes('const GRAPH_FIELDS_ALIAS_LABELS = [')) {
    throw new Error('Expected non-workflow Workflow Manager to define Graph Fields alias labels')
  }
  if (!graphTabText.includes("'Node'") || !graphTabText.includes("'Edges'") || !graphTabText.includes("'Clusters'") || !graphTabText.includes("'Renderer'") || !graphTabText.includes("'Layer Mode'")) {
    throw new Error('Expected non-workflow alias list to cover Node/Edges/Clusters/Renderer/Layer Mode')
  }
  if (!graphTabText.includes('entryAliasLabels={GRAPH_FIELDS_ALIAS_LABELS}')) {
    throw new Error('Expected non-workflow Workflow Manager to pass alias labels into GraphFieldsView')
  }
  if (!graphFieldsText.includes('aria-label="Graph Fields entry aliases"')) {
    throw new Error('Expected GraphFieldsView to render alias buttons within Graph Fields surface')
  }
  if (!graphFieldsText.includes('onClick={() => onEntryAliasClick(label)}')) {
    throw new Error('Expected GraphFieldsView alias clicks to route through the shared right-pane open handler')
  }
}
