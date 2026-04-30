import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSourceFilesIngestUsesParseJobGuardForStaleAsyncResults() {
  const p = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const text = readFileSync(p, 'utf8')
  const hashPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFileParseIdentity.ts')
  const hashText = readFileSync(hashPath, 'utf8')
  if (!text.includes('parseJobBySourceFileId')) {
    throw new Error('expected source file ingest parse path to keep per-file parse job tokens')
  }
  if (!text.includes("parseJobBySourceFileId.get(fileId) !== parseJobToken")) {
    throw new Error('expected stale parse jobs to be dropped before state writeback')
  }
  if (!text.includes('buildSourceFileParseIdentityHash({')) {
    throw new Error('expected source file ingest parse path to centralize parse identity hashing')
  }
  if (!text.includes("cacheNamespace: `source-file:${fileId}`")) {
    throw new Error('expected source file ingest parse identity to stay scoped per source file')
  }
  if (!text.includes("name: String(latest.name || '')")) {
    throw new Error('expected parse writeback identity to include latest source file name')
  }
  if (!hashText.includes('SOURCE_FILE_PARSE_SEMANTICS_VERSION = 2')) {
    throw new Error('expected source file parse identity to carry an explicit semantics version for startup invalidation')
  }
}

export function testSourceFilesIngestDedupesPendingParsesForSameTextHash() {
  const p = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('pendingParseTextHashBySourceFileId')) {
    throw new Error('expected source file ingest parse path to track pending text hashes per file')
  }
  if (!text.includes("before.status === 'loading' && pendingParseTextHashBySourceFileId.get(fileId) === textHash")) {
    throw new Error('expected source file ingest parse path to skip duplicate parses for the same pending text')
  }
  if (!text.includes('pendingParseTextHashBySourceFileId.set(fileId, textHash)')) {
    throw new Error('expected source file ingest parse path to record the active pending text hash')
  }
  if (!text.includes('pendingParseTextHashBySourceFileId.delete(fileId)')) {
    throw new Error('expected source file ingest parse path to clear pending text hashes after completion')
  }
}

export function testSourceFilesIngestHydratesPendingUrlSourcesOnBootstrap() {
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const ingestText = readFileSync(ingestPath, 'utf8')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')

  if (!ingestText.includes('export async function hydratePendingUrlSourceFiles(): Promise<void>')) {
    throw new Error('expected source file ingest integration to expose bootstrap hydration for pending url sources')
  }
  if (!ingestText.includes("if (!source || source.kind !== 'url') return false")) {
    throw new Error('expected pending url hydration to gate on canonical url sources only')
  }
  if (!ingestText.includes("if (String(file.text || '').trim()) return false")) {
    throw new Error('expected pending url hydration to skip already-hydrated source file text')
  }
  if (!ingestText.includes("await importUrlIntoActive({ fileId: file.id, url, format: 'markdown' })")) {
    throw new Error('expected pending url hydration to reuse upstream url import flow')
  }
  if (!bootstrapText.includes('await hydratePendingUrlSourceFiles()')) {
    throw new Error('expected source files bootstrap to hydrate pending url sources before composing graph data')
  }
}

export function testSourceFilesIngestTreatsMarkdownLikeUrlsAsDirectTextImports() {
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const ingestText = readFileSync(ingestPath, 'utf8')

  if (!ingestText.includes('|md|markdown|mdx|svg')) {
    throw new Error('expected source file url ingest classification to keep markdown-like urls on the direct text import path')
  }
  if (!ingestText.includes('if (isSameOriginRepoFileUrl(normalizedUrl)) {')) {
    throw new Error('expected source file url ingest to branch same-origin __repo_file markdown imports onto the direct local fetch path')
  }
  if (!ingestText.includes('const direct = await fetchSameOriginRepoFileText(normalizedUrl)')) {
    throw new Error('expected source file url ingest to fetch same-origin __repo_file markdown urls without remote fetch proxy fallback')
  }
  if (!ingestText.includes('preferProxy: shouldPreferProxy')) {
    throw new Error('expected non-local url ingest to continue using proxy-preferred remote fetch fallback')
  }
}

export function testCanvasStartupRuntimesMountsSourceFilesBootstrapEagerly() {
  const startupPath = resolve(process.cwd(), 'src', 'features', 'canvas', 'CanvasStartupRuntimes.tsx')
  const text = readFileSync(startupPath, 'utf8')

  if (!text.includes("import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'")) {
    throw new Error('expected canvas startup runtimes to import SourceFilesPersistenceBootstrap eagerly at module scope')
  }
  if (!text.includes('<SourceFilesPersistenceBootstrap />')) {
    throw new Error('expected canvas startup runtimes to mount SourceFilesPersistenceBootstrap outside the deferred idle loader path')
  }
  if (text.includes("import('@/features/source-files/SourceFilesPersistenceBootstrap')")) {
    throw new Error('expected canvas startup runtimes to stop deferring SourceFilesPersistenceBootstrap behind idle startup scheduling')
  }
  if (!text.includes("import('@/features/ssot/SsotEventBridge')")) {
    throw new Error('expected non-critical startup runtime lazy loading to continue for the SSOT bridge')
  }
}

export function testSourceFilesBootstrapIgnoresPersistedWorkspaceBackedSourceFiles() {
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const text = readFileSync(bootstrapPath, 'utf8')

  if (!text.includes('function stripPersistedWorkspaceBackedSourceFiles')) {
    throw new Error('expected source files bootstrap to centralize persisted workspace-backed source-file filtering')
  }
  if (!text.includes("return !sourcePath.startsWith('workspace:')")) {
    throw new Error('expected source files bootstrap to reject persisted workspace-backed source files at startup')
  }
  if (!text.includes('const persisted = stripPersistedWorkspaceBackedSourceFiles(persistedRaw)')) {
    throw new Error('expected source files bootstrap hydration to filter persisted source files before restoring startup state')
  }
}

export function testSourceFilesSliceStartsEmptyAndDefersWorkspaceSeedsToBootstrap() {
  const slicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'sourceFilesSlice.ts')
  const text = readFileSync(slicePath, 'utf8')

  if (!text.includes('sourceFiles: [],')) {
    throw new Error('expected sourceFiles store slice to start empty so workspace-backed source files are owned by bootstrap/workspace FS SSOT')
  }
  if (text.includes('WORKSPACE_README_SOURCE_FILE') || text.includes('TEST_VALIDATION_SOURCE_FILE')) {
    throw new Error('expected sourceFiles store slice to stop hard-seeding canonical workspace source files locally')
  }
}

export function testSourceFilesBootstrapResyncsOnlyOnActivePathChanges() {
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const text = readFileSync(bootstrapPath, 'utf8')

  if (!text.includes('useMarkdownExplorerStore.subscribe(s => s.activePath')) {
    throw new Error('expected source files bootstrap to continue resyncing on active path changes')
  }
  if (text.includes('useGraphStore.subscribe(s => s.workspaceViewMode')) {
    throw new Error('expected source files bootstrap to stop rematerializing active workspace files just because workspace view mode flipped')
  }
  if (!text.includes('const lastMaterializedActivePathRef = React.useRef')) {
    throw new Error('expected source files bootstrap to dedupe redundant materialization by active workspace path')
  }
  if (!text.includes('if (lastMaterializedActivePathRef.current === activePath) return')) {
    throw new Error('expected source files bootstrap to skip repeated workspace-view materialization when the active path is unchanged')
  }
  if (text.includes('}\n    syncNow()\n    const unsubscribeActivePath')) {
    throw new Error('expected source files bootstrap to avoid an eager duplicate mount resync before startup bootstrap completes')
  }
}

export function testWorkspaceImportParseIdentityUsesSemanticsVersionAndName() {
  const importPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'applyWorkspaceImportToCanvas.ts')
  const text = readFileSync(importPath, 'utf8')

  if (!text.includes('buildSourceFileParseIdentityHash({')) {
    throw new Error('expected workspace import parse path to reuse shared source-file parse identity hashing')
  }
  if (!text.includes('cacheNamespace: `workspace-import:${path}`')) {
    throw new Error('expected workspace import parse identity to stay scoped by workspace path')
  }
  if (!text.includes('name: workspaceDocumentKey(path)')) {
    throw new Error('expected workspace import parse identity to include workspace document name')
  }
}

export function testMarkdownWorkspaceRuntimeReusesParsedWorkspaceSourceFileInsteadOfDirectGraphOverride() {
  const runtimePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const text = readFileSync(runtimePath, 'utf8')

  if (!text.includes('const shouldReuseExistingWorkspaceSourceFile =')) {
    throw new Error('expected markdown workspace runtime to centralize reuse of an already-parsed workspace source file')
  }
  if (!text.includes('cachedHash === hash')) {
    throw new Error('expected markdown workspace runtime to guard workspace-source reuse on matching parsed text hash')
  }
  if (!text.includes('await applyComposedFromSourceFiles()')) {
    throw new Error('expected markdown workspace runtime reuse path to defer graph ownership back to composed source files')
  }
  if (!text.includes('findWorkspaceSourceFileByPath(path)')) {
    throw new Error('expected markdown workspace runtime to resolve the canonical workspace-backed source file before reparsing')
  }
  if (!text.includes('buildSourceFileParseIdentityHash({')) {
    throw new Error('expected markdown workspace runtime to reuse shared parse identity hashing for workspace-opened markdown files')
  }
  if (!text.includes('cacheNamespace: `workspace-import:${path}`')) {
    throw new Error('expected markdown workspace runtime parse identity to stay aligned with workspace import hashing')
  }
  if (!text.includes('name: workspaceDocumentKey(path)')) {
    throw new Error('expected markdown workspace runtime parse identity to include the canonical workspace document key')
  }
  if (!text.includes('const workspaceSourceAlreadyMaterialized =')) {
    throw new Error('expected markdown workspace runtime to fast-return when the canonical workspace source file is already fully materialized')
  }
  if (!text.includes('if (workspaceSourceAlreadyMaterialized) {')) {
    throw new Error('expected markdown workspace runtime to branch before reloading an already materialized workspace source file')
  }
  if (text.includes('const shouldUseDirectGraphDataFor =')) {
    throw new Error('expected markdown workspace runtime indexing path to stop using a direct graph override helper for workspace-backed source files')
  }
  if (text.includes('store.setGraphData(cachedGraph as GraphData)') || text.includes('store.setGraphData(geoGraph)') || text.includes('store.setGraphData(gd)')) {
    throw new Error('expected markdown workspace runtime indexing path to route parsed workspace files back through canonical composed source-file apply instead of direct graph override')
  }
  const fastPathIndex = text.indexOf('if (workspaceSourceAlreadyMaterialized) {')
  const geoCandidateIndex = text.indexOf('const isGeoCandidate = (() => {')
  if (fastPathIndex < 0 || geoCandidateIndex < 0 || fastPathIndex > geoCandidateIndex) {
    throw new Error('expected markdown workspace runtime to skip geo/index parse candidate work before the already-materialized fast path')
  }
}

export function testWorkspaceBootstrapActivePathRematerializeAvoidsImplicitGraphApply() {
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const runtimeSharedPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesRuntimeShared.ts')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')
  const runtimeSharedText = readFileSync(runtimeSharedPath, 'utf8')

  if (!runtimeSharedText.includes('applyToGraph?: boolean')) {
    throw new Error('expected workspace bootstrap materialize helper to make graph apply explicit instead of implicit')
  }
  if (!bootstrapText.includes('applyToGraph: true,')) {
    throw new Error('expected initial bootstrap materialization to opt into graph apply explicitly')
  }
  if (!bootstrapText.includes('materializeActiveWorkspaceEntryIntoSourceFiles({ applyToGraph: false })')) {
    throw new Error('expected active-path rematerialization to stay hydration-only so Editor Workspace open cannot replay import graph apply')
  }
}

export function testMarkdownApplyPrefersCanonicalSourceFileComposePath() {
  const documentActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataDocumentActions.ts')
  const sourceResolutionPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataFrontmatterFlowSync.ts')
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const documentActionsText = readFileSync(documentActionsPath, 'utf8')
  const sourceResolutionText = readFileSync(sourceResolutionPath, 'utf8')
  const ingestText = readFileSync(ingestPath, 'utf8')

  if (!sourceResolutionText.includes('export function findSourceFileForMarkdownDocument')) {
    throw new Error('expected markdown apply path to centralize active source-file resolution before direct parser apply')
  }
  if (!documentActionsText.includes('const exactSourceFile = findSourceFileForMarkdownDocument(state, nextName)')) {
    throw new Error('expected applyMarkdownDocumentToGraph to prefer a matching source file for active markdown documents')
  }
  if (!documentActionsText.includes("await mod.parseAndApplySourceFile(exactSourceFile.id)")) {
    throw new Error('expected applyMarkdownDocumentToGraph to reuse the canonical source-file parse/apply flow')
  }
  if (!ingestText.includes('export async function parseAndApplySourceFile(fileId: string): Promise<void>')) {
    throw new Error('expected source-file ingest integration to export canonical parseAndApplySourceFile for shared callers')
  }
}

export function testWorkspaceCanvasAutoApplySkipsWidgetMode() {
  const interactionPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceInteractions.ts')
  const text = readFileSync(interactionPath, 'utf8')
  const anchor = "React.useEffect(() => {\n    if (!workspaceApplyEffectsEnabled || contentMode === 'widget') return"
  const idx = text.indexOf(anchor)
  if (idx < 0) {
    throw new Error('expected workspace canvas auto-apply effect in markdown workspace interaction runtime')
  }
  const body = text.slice(idx, idx + 500)
  if (!body.includes("contentMode === 'widget'")) {
    throw new Error('expected workspace canvas auto-apply effect to skip widget mode so reopen cannot apply widget bundle text as a full document')
  }
  if (!body.includes("const graphText = markdownDocumentName === name ? String(markdownDocumentText || '') : ''")) {
    throw new Error('expected workspace canvas auto-apply effect to compare against the current graph document text before reopening apply')
  }
  if (!body.includes('if (graphText === text) return')) {
    throw new Error('expected workspace canvas auto-apply effect to skip reapplying the same active document text when Editor Workspace opens')
  }
}

export function testWorkspaceRefreshSetSourceFilesImmediatelySchedulesComposeApply() {
  const runtimePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readFileSync(runtimePath, 'utf8')

  if (!text.includes('const scheduleApplyComposedFromSourceFiles = React.useCallback(async () => {')) {
    throw new Error('expected markdown workspace runtime refresh path to expose a dedicated composed-apply scheduler helper')
  }
  if (!text.includes("await import('@/features/source-files/applyComposedGraphFromSourceFiles')")) {
    throw new Error('expected markdown workspace runtime refresh path to lazy-load the canonical composed source-files apply module')
  }
  if (!text.includes('mod.scheduleApplyComposedGraphFromSourceFiles()')) {
    throw new Error('expected markdown workspace runtime refresh path to dispatch canonical scheduleApplyComposedGraphFromSourceFiles')
  }

  if (!text.includes('if (merged !== store.sourceFiles) {')) {
    throw new Error('expected markdown workspace runtime refresh to skip no-op source-files writes when the merged workspace snapshot is unchanged')
  }
  if (!text.includes('setEntries(prev => (areWorkspaceEntriesEqual(prev, pruned) ? prev : pruned))')) {
    throw new Error('expected markdown workspace runtime refresh to skip no-op workspace entry state writes')
  }
  if (!text.includes('setSourcesByPath(prev => (areWorkspaceSourcesEqual(prev, sources) ? prev : sources))')) {
    throw new Error('expected markdown workspace runtime refresh to skip no-op source-index state writes')
  }

  const setIdx = text.indexOf('store.setSourceFiles(merged)')
  const applyIdx = text.indexOf('await scheduleApplyComposedFromSourceFiles()')
  if (setIdx < 0 || applyIdx < 0 || applyIdx <= setIdx) {
    throw new Error('expected markdown workspace runtime refresh to schedule composed apply immediately after setSourceFiles so delete/refresh clears stale overlays without page reload')
  }
}

export function testWorkspaceImportActionsReuseRefreshSnapshotForApply() {
  const importPath = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'useWorkspaceFileActions', 'importActions.ts')
  const text = readFileSync(importPath, 'utf8')

  if (!text.includes('const refreshed = await refresh()')) {
    throw new Error('expected workspace import actions to reuse the immediate refresh snapshot before applying imports to canvas')
  }
  if (!text.includes('workspaceEntries: refreshed.entries')) {
    throw new Error('expected workspace import actions to pass refreshed workspace entries into applyWorkspaceImportToCanvas')
  }
  if (!text.includes('sourcesByPath: refreshed.sourcesByPath')) {
    throw new Error('expected workspace import actions to pass refreshed source index into applyWorkspaceImportToCanvas')
  }
  if (!text.includes('runWorkspaceFsChangedBatch(() => {')) {
    throw new Error('expected workspace import actions to batch filesystem changes before manual refresh')
  }
  if (!text.includes('suppressNextWorkspaceFsChangedEvent()')) {
    throw new Error('expected workspace import actions to suppress the follow-up batched fs event when they already do a manual refresh')
  }
}

export function testWorkspaceImportFocusDoesNotDuplicateGraphApply() {
  const importPath = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'useWorkspaceFileActions', 'importActions.ts')
  const fallbackPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'launchDropdownFallbacks.ts')
  const text = readFileSync(importPath, 'utf8')
  const fallbackText = readFileSync(fallbackPath, 'utf8')

  if (!text.includes("await focusAfterImport(createdPath, { applyToGraph: false, jobId })")) {
    throw new Error('expected local workspace import focus to avoid duplicate graph apply after canonical source-files import apply')
  }
  if (!text.includes("await focusAfterImport(createdPath, { sourceUrl, applyToGraph: false, jobId })")) {
    throw new Error('expected URL workspace import focus to avoid duplicate graph apply after canonical source-files import apply')
  }
  if (!fallbackText.includes('applyToGraph: false,')) {
    throw new Error('expected launch dropdown fallback focus to avoid duplicate graph apply after canonical source-files import apply')
  }
  if (fallbackText.includes('forceApplyToGraph: true')) {
    throw new Error('expected launch dropdown fallback focus to stop forcing duplicate graph apply after import')
  }
}

export function testWorkspaceManualRefreshActionsSuppressFollowUpFsEventRefresh() {
  const corePath = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'useWorkspaceFileActions', 'core.ts')
  const mutationPath = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'useWorkspaceFileActions', 'mutationActions.ts')
  const websitePath = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'useWorkspaceFileActions', 'websiteImportAction.ts')
  const coreText = readFileSync(corePath, 'utf8')
  const mutationText = readFileSync(mutationPath, 'utf8')
  const websiteText = readFileSync(websitePath, 'utf8')

  if (!coreText.includes('runWorkspaceFsChangedBatch(async () => {') || !coreText.includes('suppressNextWorkspaceFsChangedEvent()')) {
    throw new Error('expected create file/folder actions to batch filesystem changes and suppress duplicate follow-up fs refresh')
  }
  if (!mutationText.includes('await runWorkspaceFsChangedBatch(async () => {') || !mutationText.includes('suppressNextWorkspaceFsChangedEvent()')) {
    throw new Error('expected delete/rename actions to batch filesystem changes and suppress duplicate follow-up fs refresh')
  }
  if (!websiteText.includes('runWorkspaceFsChangedBatch(async () => {') || !websiteText.includes('suppressNextWorkspaceFsChangedEvent()')) {
    throw new Error('expected website import action to suppress duplicate follow-up fs refresh when it manually refreshes workspace state')
  }
}

export function testSourceFilesDbPersistsOnlyChangedRows() {
  const dbPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesDb.ts')
  const text = readFileSync(dbPath, 'utf8')

  if (!text.includes('const existingById = new Map(existing.map(doc => [String(doc.get(\'id\') || \'\'), doc]))')) {
    throw new Error('expected source files db persistence to index existing rows by id before deciding which rows actually changed')
  }
  if (!text.includes('if (existingOrderIndex === row.orderIndex && arePersistedSourceFilesEqual(existingPayload, row.payload)) continue')) {
    throw new Error('expected source files db persistence to skip incrementalUpsert for unchanged source-file rows')
  }
  if (!text.includes('const arePersistedWorkspaceStatesEqual =')) {
    throw new Error('expected source files db persistence to centralize workspace-state equality checks')
  }
  if (!text.includes('if (arePersistedWorkspaceStatesEqual(existingPayload, payload)) return')) {
    throw new Error('expected source files workspace persistence to skip writes when the normalized workspace snapshot is unchanged')
  }
}

export function testMarkdownDocumentSettersStayDecoupledFromWorkspaceViewMode() {
  const graphSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSlice.ts')
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const importEffectsPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'importSideEffects.ts')
  const youtubePath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'youtubeImportAction.ts')
  const fallbackPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'launchDropdownFallbacks.ts')
  const graphSliceText = readFileSync(graphSlicePath, 'utf8')
  const ingestText = readFileSync(ingestPath, 'utf8')
  const importEffectsText = readFileSync(importEffectsPath, 'utf8')
  const youtubeText = readFileSync(youtubePath, 'utf8')
  const fallbackText = readFileSync(fallbackPath, 'utf8')

  if (graphSliceText.includes('workspaceViewMode?: GraphState[\'workspaceViewMode\'] | null')) {
    throw new Error('expected setActiveMarkdownDocument to stop accepting workspace view mode as an implicit UI side effect')
  }
  if (graphSliceText.includes('get().setWorkspaceViewMode(viewMode)')) {
    throw new Error('expected setActiveMarkdownDocument to stop mutating workspace view mode directly')
  }
  if (!importEffectsText.includes('state.setWorkspaceViewMode(workspaceViewMode)')) {
    throw new Error('expected toolbar markdown imports to own explicit workspace mode changes at the caller')
  }
  if (!ingestText.includes("store.setWorkspaceViewMode('editor')")) {
    throw new Error('expected source-file ingest to open editor mode explicitly instead of routing through the markdown document setter')
  }
  if (!youtubeText.includes("state.setWorkspaceViewMode('editor')")) {
    throw new Error('expected youtube import to open editor mode explicitly before updating markdown document state')
  }
  if (fallbackText.includes('workspaceViewMode,')) {
    throw new Error('expected launch dropdown fallback imports to stop threading workspace view mode through setActiveMarkdownDocument')
  }
}
