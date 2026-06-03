import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export function testWorkspaceTableModeSharedUtilsOwnMultiDimModes() {
  const workspaceModeText = readUtf8('src/features/workspace-table/workspaceEditorMode.ts')
  const presentationText = readUtf8('src/features/workspace-table/workspaceEditorModePresentation.ts')
  const graphHeaderText = readUtf8('src/features/graph-table/ui/GraphTableWorkspaceHeader.tsx')
  const viewerHeaderText = readUtf8('src/features/markdown-workspace/main/viewer/WorkspaceDataViewHeader.tsx')
  const graphModePath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'graphTableViewMode.ts')
  const lsKeysText = readUtf8('src/lib/config.ls.keys.ts')

  if (fs.existsSync(graphModePath)) {
    throw new Error('expected graph-table-local view mode file to be removed in favor of workspace-table shared utils')
  }
  if (!workspaceModeText.includes("export type WorkspaceTableViewMode = WorkspaceEditorMode | 'geospatial'")) {
    throw new Error('expected shared workspace table mode to own geospatial plus table/kanban/multi-dimensional table modes')
  }
  if (!workspaceModeText.includes('export function parseWorkspaceTableViewMode(')) {
    throw new Error('expected shared workspace table mode parser to live upstream')
  }
  if (!presentationText.includes('WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS')) {
    throw new Error('expected shared workspace table presentation options to live upstream')
  }
  if (!graphHeaderText.includes('WORKSPACE_TABLE_VIEW_MODE_SELECT_OPTIONS')) {
    throw new Error('expected Multi-dimensional Table workspace header to reuse shared view mode options')
  }
  if (!viewerHeaderText.includes('getWorkspaceEditorModeLabel(props.viewerMode)')) {
    throw new Error('expected Editor Workspace Viewer Multi-dimensional Table to keep using shared workspace mode labels')
  }
  if (lsKeysText.includes('graphTableViewMode')) {
    throw new Error('expected duplicate graphTableViewMode local-storage key to be removed')
  }
}

export function testWorkspaceDataViewTableFrameFillsPane() {
  const viewerText = readUtf8('src/features/markdown-workspace/main/viewer/MarkdownWorkspaceDerivedViewer.tsx')
  const responsiveClassesText = readUtf8('src/lib/ui/responsiveElementClasses.ts')
  const responsiveCssText = readUtf8('src/styles/responsive-toolbar.css')

  if (!responsiveClassesText.includes('UI_RESPONSIVE_WORKSPACE_DATA_VIEW_MAIN_CLASSNAME')) {
    throw new Error('expected workspace data-view body to use a shared responsive class')
  }
  if (!viewerText.includes('UI_RESPONSIVE_WORKSPACE_DATA_VIEW_MAIN_CLASSNAME')) {
    throw new Error('expected MarkdownWorkspaceDerivedViewer to mark the workspace data-view body')
  }
  if (!responsiveCssText.includes('.kg-workspace-data-view-main > .kg-data-view-table-frame')) {
    throw new Error('expected workspace-hosted data-view tables to fill the pane body')
  }
  if (!responsiveCssText.includes('max-height: none') || !responsiveCssText.includes('max-block-size: none')) {
    throw new Error('expected workspace-hosted data-view tables to override the generic table max-height')
  }
}

export function testWorkspaceTableUserFacingCopyUsesMultiDimensionalTableSsot() {
  const sourcePaths = [
    'src/features/graph-table/ui/GraphTableWorkspaceHeader.tsx',
    'src/features/graph-table/ui/GraphTableWorkspaceLeft.tsx',
    'src/features/graph-table/ui/GraphTableToolbar.tsx',
    'src/features/graph-table/ui/GraphTableKanbanView.tsx',
    'src/features/markdown/ui/MarkdownSelectionToolbar.tsx',
    'src/lib/markdown-core/ui/markdownBlockContainerCore.bubbleToolbarOverlay.tsx',
    'src/features/panels/config.ts',
    'src/features/panels/views/HelpIconsSection.tsx',
    'src/features/panels/views/useSettingsView.helpers.ts',
    'src/features/panels/ui/mainPanelHelpIconLibrary.tsx',
    'src/features/spotlight/config.ts',
    'src/features/spotlight/LaunchSpotlightTourCard.tsx',
    'src/lib/config-copy/tooltips.ts',
    'src/cli/extract-settings-schema.ts',
  ]
  const staleGraphDataTableLabel = /Graph\s+Data\s+Table/

  for (const sourcePath of sourcePaths) {
    const text = readUtf8(sourcePath)
    if (staleGraphDataTableLabel.test(text)) {
      throw new Error(`expected ${sourcePath} to reuse Multi-dimensional Table shared copy instead of legacy data-table literals`)
    }
  }

  const copyText = readUtf8('src/lib/config-copy/markdownDataViewCopy.ts')
  for (const expectedCopyKey of [
    'toolbarAriaLabel',
    'workspaceAriaLabel',
    'viewSelectAriaLabel',
    'showInLabel',
    'hideInLabel',
    'mappingLabel',
  ]) {
    if (!copyText.includes(expectedCopyKey)) {
      throw new Error(`expected shared Multi-dimensional Table copy to expose ${expectedCopyKey}`)
    }
  }
}

export function testWorkspaceDataViewHasNoLegacyTableBackfill() {
  const candidatesText = readUtf8('src/features/markdown-workspace/main/viewer/markdownWorkspaceDataViewCandidates.ts')
  const viewerText = readUtf8('src/features/markdown-workspace/main/viewer/MarkdownWorkspaceDerivedViewer.tsx')
  const configText = readUtf8('src/features/markdown-workspace/main/viewer/workspaceDataViewConfig.ts')

  if (candidatesText.includes('legacyId')) {
    throw new Error('expected DataView candidates to expose only stable IDs')
  }
  if (viewerText.includes('legacyId') || viewerText.includes('stableMeta') || viewerText.includes('legacyMeta')) {
    throw new Error('expected MarkdownWorkspaceDerivedViewer to avoid legacy table config backfill')
  }
  if (configText.includes('raw.v === 1') || configText.includes('const maybeView = coerceWorkspaceDataViewConfig(raw)')) {
    throw new Error('expected WorkspaceDataView config coercion to reject legacy/direct config backfill paths')
  }
}

export function testWorkspaceCsvRefreshReusesDelimitedTextDataViewOwners() {
  const mainText = readUtf8('src/features/markdown-workspace/main/MarkdownWorkspaceMain.tsx')
  const viewerText = readUtf8('src/features/markdown-workspace/main/viewer/MarkdownWorkspaceDerivedViewer.tsx')
  const candidatesText = readUtf8('src/features/markdown-workspace/main/viewer/markdownWorkspaceDataViewCandidates.ts')
  const typesText = readUtf8('src/features/markdown-workspace/main/types.ts')
  const delimitedText = readUtf8('src/lib/delimited-text/delimitedText.ts')

  if (!typesText.includes('isMarkdownWorkspaceDelimitedTextPath')) {
    throw new Error('expected delimited-text workspace document detection to live in shared pane preset utilities')
  }
  if (!mainText.includes('shouldUseDataViewDocumentPreset')) {
    throw new Error('expected MarkdownWorkspaceMain to preserve Viewer Multi-dimensional Table mode for CSV refresh')
  }
  if (!mainText.includes('!shouldUseDataViewDocumentPreset')) {
    throw new Error('expected Viewer read-mode reset to skip delimited-text data-view presets')
  }
  if (!viewerText.includes('parseDelimitedTextWithWorkerFallback')) {
    throw new Error('expected MarkdownWorkspaceDerivedViewer to rebuild CSV data views with the existing worker-backed parser')
  }
  if (!viewerText.includes('buildDataViewCandidatesFromDelimitedTextParseResult')) {
    throw new Error('expected MarkdownWorkspaceDerivedViewer to reuse shared delimited-text data-view candidates')
  }
  if (!candidatesText.includes('buildWorkspaceDataViewSourceTableId')) {
    throw new Error('expected rows-JSON and raw delimited source tables to share one stable table id helper')
  }
  if (!delimitedText.includes('defaultDelimitedTextDelimiterForName')) {
    throw new Error('expected delimiter inference by file name to live in the delimited-text parser owner')
  }
}

export function testWorkspaceDataViewGraphToggleBridgesFloatingPanelToCanvasMode() {
  const settingsText = readUtf8('src/features/markdown-workspace/main/viewer/WorkspaceDataViewSettingsPanel.tsx')
  const viewerText = readUtf8('src/features/markdown-workspace/main/viewer/MarkdownWorkspaceDerivedViewer.tsx')
  const activeViewText = readUtf8('src/hooks/active-graph-data/activeViewGraph.ts')
  const modeActionsText = readUtf8('src/hooks/store/uiSettingsSliceModeActions.ts')
  const renderConfigText = readUtf8('src/lib/config.render.ts')
  const canvasViewActionsText = readUtf8('src/components/toolbar/canvasViewActions.ts')
  const restoreWritesText = readUtf8('src/features/canvas/graphStoreDocumentUiRestoreWrites.ts')

  if (!settingsText.includes("props.onChangeLayoutMode?.(next ? 'multiDimTable' : 'table')")) {
    throw new Error('expected the FloatingPanel graph toggle to bridge into the shared Multi-dimensional Table layout mode')
  }
  if (!settingsText.includes('MARKDOWN_DATA_VIEW_COPY.graphRenderingToggleLabel')) {
    throw new Error('expected graph-rendering toggle copy to use shared Multi-dimensional Table copy')
  }
  if (settingsText.includes('disabled={!props.canMutate}')) {
    throw new Error('expected graph-rendering view config toggle to stay enabled for read-only source tables')
  }
  if (!viewerText.includes('writeWorkspaceDataViewConfig({')) {
    throw new Error('expected workspace data-view graph config to persist immediately before canvas mode changes')
  }
  if (!viewerText.includes("setMultiDimTableModeEnabled(mode === 'multiDimTable')")) {
    throw new Error('expected workspace data-view layout changes to drive canvas Multi-dimensional Table mode')
  }
  if (!activeViewText.includes("if (mode === 'multiDimTable') return deriveActiveViewGraph()")) {
    throw new Error('expected Multi-dimensional Table active-view derivation to bypass stale cache after view-config changes')
  }
  if (!renderConfigText.includes('resolveTableGraphCanvas2dRenderer')) {
    throw new Error('expected table graph renderer resolution to live in shared renderer config utilities')
  }
  if (!modeActionsText.includes('resolveTableGraphCanvas2dRenderer(state.canvas2dRenderer)')) {
    throw new Error('expected store-level Multi-dimensional Table mode to switch non-graph renderers through the shared resolver')
  }
  if (!canvasViewActionsText.includes('isTableGraphCanvas2dRenderer(canvas2dRenderer)')) {
    throw new Error('expected toolbar Multi-dimensional Table mode to reuse the shared graph-renderer predicate')
  }
  if (!restoreWritesText.includes('resolveTableGraphCanvas2dRenderer(modeState.canvas2dRenderer)')) {
    throw new Error('expected document UI restore to normalize stale saved renderers for restored Multi-dimensional Table mode')
  }
}
