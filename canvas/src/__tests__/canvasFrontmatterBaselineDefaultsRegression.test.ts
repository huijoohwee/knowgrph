import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCanvasBaselineDefaultsUseFlowEditorAndBlockLayout() {
  const configRenderPath = resolve(process.cwd(), 'src', 'lib', 'config.render.ts')
  const schemaPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'schema.ts')
  const importDefaultsPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'applyWorkspaceImportToCanvas.ts')
  const graphStorePath = resolve(process.cwd(), 'src', 'hooks', 'useGraphStore.ts')

  const configRenderText = readFileSync(configRenderPath, 'utf8')
  const schemaText = readFileSync(schemaPath, 'utf8')
  const importDefaultsText = readFileSync(importDefaultsPath, 'utf8')
  const graphStoreText = readFileSync(graphStorePath, 'utf8')

  if (!configRenderText.includes("export const DEFAULT_CANVAS_2D_RENDERER: Canvas2dRendererId = 'flowEditor'")) {
    throw new Error('expected default 2d renderer baseline to be flowEditor')
  }
  if (!schemaText.includes("layout: {\n    mode: 'block'")) {
    throw new Error('expected schema baseline layout mode to default to block')
  }
  if (!importDefaultsText.includes("store.setCanvas2dRenderer(DEFAULT_CANVAS_2D_RENDERER)")) {
    throw new Error('expected workspace import defaults to reuse DEFAULT_CANVAS_2D_RENDERER')
  }
  if (!importDefaultsText.includes('store.setFrontmatterModeEnabled(true)')) {
    throw new Error('expected workspace import defaults to keep frontmatter mode enabled')
  }
  if (!importDefaultsText.includes("mode: 'block'")) {
    throw new Error('expected workspace import defaults to keep block layout baseline')
  }
  if (!graphStoreText.includes('rawLayoutMode')) {
    throw new Error('expected graph store schema init to preserve existing layout mode and avoid hard-reset churn')
  }
}

export function testWorkspaceSyncSubscriptionsUseSharedRuntimePersistenceKeys() {
  const sourceFilesBootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const graphStorePath = resolve(process.cwd(), 'src', 'hooks', 'useGraphStore.ts')
  const markdownRuntimePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const syncKeysPath = resolve(process.cwd(), 'src', 'lib', 'async', 'workspaceSyncKeys.ts')
  const canvasPagePath = resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')

  const sourceFilesBootstrapText = readFileSync(sourceFilesBootstrapPath, 'utf8')
  const graphStoreText = readFileSync(graphStorePath, 'utf8')
  const markdownRuntimeText = readFileSync(markdownRuntimePath, 'utf8')
  const syncKeysText = readFileSync(syncKeysPath, 'utf8')
  const canvasPageText = readFileSync(canvasPagePath, 'utf8')

  if (!syncKeysText.includes('WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE')) {
    throw new Error('expected workspace sync keys ssot to define source-files runtime-persistence scope')
  }
  if (!syncKeysText.includes('WORKSPACE_SYNC_SCOPE_PER_DOCUMENT_UI_RUNTIME_PERSISTENCE')) {
    throw new Error('expected workspace sync keys ssot to define per-document-ui runtime-persistence scope')
  }
  if (!syncKeysText.includes('WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE')) {
    throw new Error('expected workspace sync keys ssot to define canvas tab-sync runtime-persistence scope')
  }
  if (!syncKeysText.includes('WORKSPACE_SYNC_SCOPE_CANVAS_PREVIEW_WRITEBACK_RUNTIME_PERSISTENCE')) {
    throw new Error('expected workspace sync keys ssot to define canvas preview writeback runtime-persistence scope')
  }
  if (!sourceFilesBootstrapText.includes('WORKSPACE_SYNC_SCOPE_SOURCE_FILES_RUNTIME_PERSISTENCE')) {
    throw new Error('expected source-files persistence subscriptions to reuse shared runtime-persistence scope key')
  }
  if (!graphStoreText.includes('WORKSPACE_SYNC_SCOPE_PER_DOCUMENT_UI_RUNTIME_PERSISTENCE')) {
    throw new Error('expected per-document ui persistence subscription to reuse shared runtime-persistence scope key')
  }
  if (!markdownRuntimeText.includes('WORKSPACE_SYNC_SCOPE_MARKDOWN_WORKSPACE_PREFS_RUNTIME_PERSISTENCE')) {
    throw new Error('expected markdown workspace prefs persistence to use shared runtime-persistence scope key')
  }
  if (!canvasPageText.includes('WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE')) {
    throw new Error('expected canvas tab-sync subscriptions to reuse shared runtime-persistence scope key')
  }
  if (!canvasPageText.includes('WORKSPACE_SYNC_SCOPE_CANVAS_PREVIEW_WRITEBACK_RUNTIME_PERSISTENCE')) {
    throw new Error('expected canvas preview writeback subscriptions to reuse shared runtime-persistence scope key')
  }
}

export function testFrontmatterFlowDoesNotBuildSyntheticFallbackSubgraphMetadata() {
  const parserCorePath = resolve(process.cwd(), 'src', 'features', 'parsers', 'markdownFrontmatterFlowGraph.core.ts')
  const parserCoreText = readFileSync(parserCorePath, 'utf8')
  if (parserCoreText.includes("id: 'frontmatter:all'")) {
    throw new Error('expected frontmatter flow parser to avoid synthetic fallback subgraph metadata')
  }
}
