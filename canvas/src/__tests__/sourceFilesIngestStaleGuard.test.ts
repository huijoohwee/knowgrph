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
  const bootstrapStartupPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesBootstrapStartup.ts')
  const ingestText = readFileSync(ingestPath, 'utf8')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')
  const bootstrapStartupText = readFileSync(bootstrapStartupPath, 'utf8')

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
  if (!bootstrapText.includes('runBootstrapSourceFileHydration')) {
    throw new Error('expected source files bootstrap to delegate startup ingest hydration through the shared bootstrap startup helper')
  }
  if (!bootstrapStartupText.includes('await hydratePendingUrlSourceFiles()')) {
    throw new Error('expected shared bootstrap startup helper to hydrate pending url sources before composing graph data')
  }
}

export function testSourceFilesIngestTreatsMarkdownLikeUrlsAsDirectTextImports() {
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const ingestText = readFileSync(ingestPath, 'utf8')

  if (!ingestText.includes('|md|markdown|mdx|svg')) {
    throw new Error('expected source file url ingest classification to keep markdown-like urls on the direct text import path')
  }
  if (!ingestText.includes('if (isSameOriginCodebaseFileUrl(normalizedUrl)) {')) {
    throw new Error('expected source file url ingest to branch same-origin __codebase_file markdown imports onto the direct local fetch path')
  }
  if (!ingestText.includes('const direct = await fetchSameOriginCodebaseFileText(normalizedUrl)')) {
    throw new Error('expected source file url ingest to fetch same-origin __codebase_file markdown urls without remote fetch proxy fallback')
  }
  if (!ingestText.includes('preferProxy: !isGrabMapsProxyRequest')) {
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

  if (!(text.includes('useMarkdownExplorerStore.subscribe(') && text.includes('s => s.activePath'))) {
    throw new Error('expected source files bootstrap to continue resyncing on active path changes')
  }
  if (text.includes('s => s.activePath && syncNow()')) {
    throw new Error('expected source files bootstrap active-path subscription to avoid selector-side effects that cause churn and stale rematerialization')
  }
  if (text.includes('useGraphStore.subscribe(s => s.workspaceViewMode')) {
    throw new Error('expected source files bootstrap to stop rematerializing active workspace files just because workspace view mode flipped')
  }
  if (!text.includes('const lastMaterializedActivePathRef = React.useRef')) {
    throw new Error('expected source files bootstrap to dedupe redundant materialization by active workspace path')
  }
  if (!text.includes('if (!workspaceHydratedRef.current) return')) {
    throw new Error('expected source files bootstrap to gate active-path rematerialization until workspace bootstrap hydration completes')
  }
  if (!text.includes('const activePathKey = buildMaterializedWorkspaceActivePathKey({') || !text.includes('if (lastMaterializedActivePathRef.current === activePathKey) return')) {
    throw new Error('expected source files bootstrap to skip repeated workspace-view materialization when the active path is unchanged')
  }
  if (text.includes('}\n    syncNow()\n    const unsubscribeActivePath')) {
    throw new Error('expected source files bootstrap to avoid an eager duplicate mount resync before startup bootstrap completes')
  }
}

export function testSourceFilesBootstrapSchedulesComposeOnlyForCompositionSignatureChanges() {
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const helperPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesSignatures.ts')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')

  if (!helperText.includes('export const buildSourceFilesCompositionSignature =')) {
    throw new Error('expected source files signature helper to export buildSourceFilesCompositionSignature')
  }
  if (!helperText.includes("return hashSignatureParts([\n    'source-files-compose',")) {
    throw new Error('expected source files composition signature helper to use shared semantic signature hashing')
  }
  if (!bootstrapText.includes('const lastComposeSignatureRef = React.useRef')) {
    throw new Error('expected source files bootstrap to track the last composed-graph semantic signature')
  }
  if (!bootstrapText.includes('const compositionSignature = buildSourceFilesCompositionSignature(next)')) {
    throw new Error('expected source files bootstrap to derive a semantic composition signature from sourceFiles updates')
  }
  if (!bootstrapText.includes('if (compositionSignature !== lastComposeSignatureRef.current) {')) {
    throw new Error('expected source files bootstrap to suppress composed-graph scheduling when the composition signature is unchanged')
  }
  if (!bootstrapText.includes('areSourceFilesEqualByIdAndHash') || !bootstrapText.includes('buildSourceFilesPersistenceSignature(next)')) {
    throw new Error('expected source files bootstrap persistence path to reuse shared equality and persistence-signature helpers')
  }
  if (!helperText.includes('hashStringToHex(String(item?.text || \'\'))')) {
    throw new Error('expected source files persistence hashing to stay centralized in the shared source-files signature helper')
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

export function testParsedGraphStateOwnershipIsCentralized() {
  const helperPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFileParsedState.ts')
  const revisionHelperPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFileParsedGraphRevision.ts')
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const importPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'applyWorkspaceImportToCanvas.ts')
  const indexingPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const markdownApplyPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'hooks', 'useMarkdownApply.ts')
  const runtimeIoPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceRuntime.io.ts')
  const documentActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataDocumentActions.ts')
  const markdownImportPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'markdownImportAction.ts')
  const workspaceSeedsPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'workspaceSeedSourceFiles.ts')
  const sourceFilesSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'sourceFilesSlice.ts')
  const workspaceSyncPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'syncToSourceFiles.ts')
  const localMarkdownFolderPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'localMarkdownFolder.ts')
  const composedSourcePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataComposedSource.ts')
  const nodeActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataNodeActions.ts')
  const edgeActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataEdgeActions.ts')
  const signaturesPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesSignatures.ts')
  const syncToSourceFilesPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'syncToSourceFiles.ts')
  const sourceFilesDbPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesDb.ts')
  const workspaceStatePath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesWorkspaceState.ts')
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')

  const helperText = readFileSync(helperPath, 'utf8')
  const revisionHelperText = readFileSync(revisionHelperPath, 'utf8')
  const ingestText = readFileSync(ingestPath, 'utf8')
  const importText = readFileSync(importPath, 'utf8')
  const indexingText = readFileSync(indexingPath, 'utf8')
  const markdownApplyText = readFileSync(markdownApplyPath, 'utf8')
  const runtimeIoText = readFileSync(runtimeIoPath, 'utf8')
  const documentActionsText = readFileSync(documentActionsPath, 'utf8')
  const markdownImportText = readFileSync(markdownImportPath, 'utf8')
  const workspaceSeedsText = readFileSync(workspaceSeedsPath, 'utf8')
  const sourceFilesSliceText = readFileSync(sourceFilesSlicePath, 'utf8')
  const workspaceSyncText = readFileSync(workspaceSyncPath, 'utf8')
  const localMarkdownFolderText = readFileSync(localMarkdownFolderPath, 'utf8')
  const composedSourceText = readFileSync(composedSourcePath, 'utf8')
  const nodeActionsText = readFileSync(nodeActionsPath, 'utf8')
  const edgeActionsText = readFileSync(edgeActionsPath, 'utf8')
  const signaturesText = readFileSync(signaturesPath, 'utf8')
  const syncToSourceFilesText = readFileSync(syncToSourceFilesPath, 'utf8')
  const sourceFilesDbText = readFileSync(sourceFilesDbPath, 'utf8')
  const workspaceStateText = readFileSync(workspaceStatePath, 'utf8')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')

  if (!helperText.includes('export function buildSourceFileParsedState(args:')) {
    throw new Error('expected parsed source-file state ownership to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function buildSourceFileLifecycleState(args:')) {
    throw new Error('expected source-file lifecycle state ownership to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function buildSourceFileRecord(args:')) {
    throw new Error('expected source-file record creation defaults to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function normalizeSourceFileRecord(value:')) {
    throw new Error('expected source-file record normalization to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function normalizeSourceFiles(value:')) {
    throw new Error('expected source-file array normalization to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function areSourceFileRecordsEqual(')) {
    throw new Error('expected source-file record equality to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function readPersistedSourceFileRecord(')) {
    throw new Error('expected source-file persistence projection to be centralized in a shared source-files helper')
  }
  if (!helperText.includes('export function buildUpdatedSourceFileParsedGraphState(args:')) {
    throw new Error('expected parsed source-file state helper to expose a shared graph-update snapshot path')
  }
  if (!revisionHelperText.includes('export function incrementParsedGraphRevision(value: unknown): number')) {
    throw new Error('expected parsed graph revision helper to remain the SSOT for revision bump semantics under the parsed-state helper')
  }
  if (!ingestText.includes('buildSourceFileLifecycleState(')) {
    throw new Error('expected source file ingest to reuse the shared lifecycle state helper so parsed-state snapshots stay owned upstream')
  }
  if (!importText.includes('buildSourceFileLifecycleState(')) {
    throw new Error('expected workspace import parsing to reuse the shared lifecycle state helper so parsed-state snapshots stay owned upstream')
  }
  if (!indexingText.includes('buildSourceFileLifecycleState(')) {
    throw new Error('expected workspace indexing to reuse the shared lifecycle state helper so parsed-state snapshots stay owned upstream')
  }
  if (!markdownApplyText.includes('buildSourceFileLifecycleState(')) {
    throw new Error('expected markdown apply parse path to reuse the shared lifecycle state helper so parsed-state snapshots stay owned upstream')
  }
  if (!runtimeIoText.includes('buildSourceFileLifecycleState(')) {
    throw new Error('expected workspace runtime source-file reset paths to reuse the shared lifecycle state helper so parsed-state snapshots stay owned upstream')
  }
  if (!documentActionsText.includes('buildSourceFileLifecycleState(')) {
    throw new Error('expected graph document markdown apply handoff to reuse the shared lifecycle state helper for transient idle resets')
  }
  if (!ingestText.includes('buildSourceFileRecord(')) {
    throw new Error('expected source file ingest new-file creation to reuse the shared source-file record builder')
  }
  if (!indexingText.includes('buildSourceFileRecord(')) {
    throw new Error('expected workspace indexing source-file creation to reuse the shared source-file record builder')
  }
  if (!markdownImportText.includes('buildSourceFileRecord(')) {
    throw new Error('expected markdown import source-file creation to reuse the shared source-file record builder')
  }
  if (!workspaceSeedsText.includes('buildSourceFileRecord(')) {
    throw new Error('expected workspace seed source-file creation to reuse the shared source-file record builder')
  }
  if (!workspaceSyncText.includes('buildSourceFileRecord(')) {
    throw new Error('expected workspace source-file merge path to reuse the shared source-file record builder')
  }
  if (!workspaceSyncText.includes('areSourceFileRecordsEqual(prev, candidate)')) {
    throw new Error('expected workspace source-file merge path to reuse the shared source-file record equality helper')
  }
  if (!localMarkdownFolderText.includes('buildSourceFileRecord(')) {
    throw new Error('expected local markdown folder source-file materialization to reuse the shared source-file record builder')
  }
  if (!sourceFilesSliceText.includes('normalizeSourceFiles(files)')) {
    throw new Error('expected source-files store slice setSourceFiles path to normalize source-file arrays through the shared helper')
  }
  if (!sourceFilesSliceText.includes('normalizeSourceFileRecord(file)')) {
    throw new Error('expected source-files store slice addSourceFile path to normalize source-file records through the shared helper')
  }
  if (!sourceFilesSliceText.includes('normalizeSourceFileRecord({ ...f, ...updates })')) {
    throw new Error('expected source-files store slice updateSourceFile path to normalize merged source-file records through the shared helper')
  }
  if (!sourceFilesSliceText.includes('normalizeSourceFileRecord({ ...f, status, error })')) {
    throw new Error('expected source-files store slice status updates to normalize lifecycle metadata through the shared helper')
  }
  if (!composedSourceText.includes('buildUpdatedSourceFileParsedGraphState(')) {
    throw new Error('expected composed source position writebacks to reuse the shared parsed graph update helper')
  }
  if (!nodeActionsText.includes('buildUpdatedSourceFileParsedGraphState(')) {
    throw new Error('expected composed node actions to reuse the shared parsed graph update helper')
  }
  if (!edgeActionsText.includes('buildUpdatedSourceFileParsedGraphState(')) {
    throw new Error('expected composed edge actions to reuse the shared parsed graph update helper')
  }
  if (!helperText.includes('export function readSourceFileParsedState(')) {
    throw new Error('expected parsed source-file state helper to expose a normalized read path for signatures and sync equality')
  }
  if (!helperText.includes('export function readPersistedSourceFileParsedState(')) {
    throw new Error('expected parsed source-file state helper to expose a persisted parsed-state projection')
  }
  if (!helperText.includes('export function areSourceFileParsedStatesEqual(')) {
    throw new Error('expected parsed source-file state helper to expose canonical parsed-state equality')
  }
  if (!signaturesText.includes('readSourceFileParsedState(')) {
    throw new Error('expected source file signatures to normalize parsed state via the shared parsed-state reader')
  }
  if (
    !syncToSourceFilesText.includes('readSourceFileParsedState(prev)') ||
    !syncToSourceFilesText.includes('const seedSourcePath = resolveWorkspaceSeedSourcePath(path)') ||
    !syncToSourceFilesText.includes('const srcPath = seedSourcePath || workspaceSourcePathKey(path)') ||
    (
      !syncToSourceFilesText.includes('areSourceFileParsedStatesEqual(') &&
      !syncToSourceFilesText.includes('areSourceFileRecordsEqual(prev, candidate)')
    )
  ) {
    throw new Error('expected workspace source-file sync to reuse shared source-file equality, parsed-state normalization, and canonical seed source-path helpers')
  }
  if (
    !sourceFilesDbText.includes('readPersistedSourceFileRecord(payload)') ||
    !sourceFilesDbText.includes('areSourceFileRecordsEqual(existingPayload, row.payload, { includeGraphData: false, includeGraphRevision: false })')
  ) {
    throw new Error('expected source files DB normalization and persistence equality to reuse shared source-file persistence helpers')
  }
  if (!sourceFilesDbText.includes('const next = readPersistedSourceFileRecord(r.get(\'payload\') as SourceFile)')) {
    throw new Error('expected source files DB load path to consume the shared persisted source-file record helper directly')
  }
  if (!sourceFilesDbText.includes('const normalized = readPersistedSourceFileRecord(payload)')) {
    throw new Error('expected source files DB save path to consume the shared persisted source-file record helper directly')
  }
  if (!workspaceStateText.includes('export function normalizeSourceFilesWorkspaceState(value: unknown): SourceFilesWorkspaceState')) {
    throw new Error('expected workspace-state persistence normalization to be centralized in a shared source-files helper')
  }
  if (!workspaceStateText.includes('export function areSourceFilesWorkspaceStatesEqual(')) {
    throw new Error('expected workspace-state persistence equality to be centralized in a shared source-files helper')
  }
  if (!workspaceStateText.includes('export function buildSourceFilesWorkspaceStateSignature(value: unknown): string')) {
    throw new Error('expected workspace-state persistence signatures to be centralized in a shared source-files helper')
  }
  if (!sourceFilesDbText.includes('return normalizeSourceFilesWorkspaceState(row.get(\'payload\'))')) {
    throw new Error('expected source files DB workspace load path to reuse the shared workspace-state normalizer directly')
  }
  if (
    !sourceFilesDbText.includes('const payload = normalizeSourceFilesWorkspaceState(state)') ||
    !sourceFilesDbText.includes('if (areSourceFilesWorkspaceStatesEqual(existingPayload, payload)) return')
  ) {
    throw new Error('expected source files DB workspace persistence to reuse the shared workspace-state normalizer and equality helper')
  }
  if (
    !sourceFilesDbText.includes('EMPTY_SOURCE_FILES_WORKSPACE_STATE') ||
    !sourceFilesDbText.includes('type SourceFilesWorkspaceState')
  ) {
    throw new Error('expected source files DB workspace persistence boundary to reuse the shared workspace-state types and defaults')
  }
  if (
    !sourceFilesDbText.includes('normalizeSourceFilesWorkspaceState(existing.get(\'payload\'))') ||
    !sourceFilesDbText.includes('await collections.workspace.incrementalUpsert({ id: \'workspace\', payload, updatedAtMs: now })')
  ) {
    throw new Error('expected source files DB workspace persistence to normalize stored snapshots before comparing and writing')
  }
  if (
    !sourceFilesDbText.includes('areSourceFileSourcesEqual(existingPayload.source, row.payload.source)')
  ) {
    throw new Error('expected source files DB source ownership persistence comparisons to reuse the shared source ownership equality helper')
  }
  if (
    !bootstrapText.includes('buildSourceFilesWorkspaceStateSignature(snapshot)') ||
    !bootstrapText.includes('normalizeSourceFilesWorkspaceState({') ||
    !bootstrapText.includes('equalityFn: areSourceFilesWorkspaceStatesEqual')
  ) {
    throw new Error('expected runtime workspace persistence bootstrap to reuse the shared workspace-state normalization, equality, and signature helpers')
  }
  if (
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'applyComposedGraphFromSourceFiles.ts'), 'utf8').includes('resolveSourceLayerKeyChange({') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'hooks', 'useMarkdownApply.ts'), 'utf8').includes('resolveSourceLayerKeyChange({') ||
    !readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'sourceLayers.ts'), 'utf8').includes('export function resolveSourceLayerKeyChange(args:')
  ) {
    throw new Error('expected composed apply callers to reuse the shared source-layer key change helper for unchanged vs order-only vs content branching')
  }
  if (
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'applyComposedGraphFromSourceFiles.ts'), 'utf8').includes('resolveComposedApplyDeferralReason({') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'composedApplyGuards.ts'), 'utf8').includes('export function resolveComposedApplyDeferralReason(args:')
  ) {
    throw new Error('expected composed apply race suppression to reuse the shared source-files deferral helper')
  }
  if (
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'applyComposedGraphFromSourceFiles.ts'), 'utf8').includes('shouldClearComposedGraphForEmptyState({') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'composedApplyGuards.ts'), 'utf8').includes('export function shouldClearComposedGraphForEmptyState(args:')
  ) {
    throw new Error('expected composed apply empty-state clearing to reuse the shared source-files empty-state helper')
  }
  if (
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'composedSourceSelection.ts'), 'utf8').includes('export function resolvePreferredComposedDocumentPathFromState(args:') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'composedSourceSelection.ts'), 'utf8').includes('export function resolvePreferredComposedSourceFileFromState(args:') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'composedSourceSelection.ts'), 'utf8').includes('export function readComposedSourceFilePath(') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'composedSourceSelection.ts'), 'utf8').includes('export function resolvePreferredComposedSourceRawTextFromState(args:') ||
    !readFileSync(resolve(process.cwd(), 'src', 'features', 'source-files', 'applyComposedGraphFromSourceFiles.ts'), 'utf8').includes('resolvePreferredComposedSourceRawTextFromState({') ||
    !readFileSync(resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataComposedSource.ts'), 'utf8').includes('resolvePreferredEnabledComposedSourceFileFromState({') ||
    !readFileSync(resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataFrontmatterFlowSync.ts'), 'utf8').includes('resolvePreferredComposedSourceFileFromState({')
  ) {
    throw new Error('expected composed active-document selection and raw-text fallback ownership to stay centralized in the shared source-files helper')
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
  const bootstrapStartupPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesBootstrapStartup.ts')
  const runtimeSharedPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesRuntimeShared.ts')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')
  const bootstrapStartupText = readFileSync(bootstrapStartupPath, 'utf8')
  const runtimeSharedText = readFileSync(runtimeSharedPath, 'utf8')

  if (!runtimeSharedText.includes('applyToGraph?: boolean')) {
    throw new Error('expected workspace bootstrap materialize helper to make graph apply explicit instead of implicit')
  }
  if (!bootstrapStartupText.includes('applyToGraph: true,')) {
    throw new Error('expected initial bootstrap materialization to opt into graph apply explicitly')
  }
  if (!runtimeSharedText.includes('export function resolveMaterializedWorkspaceActivePath(args?:')) {
    throw new Error('expected workspace bootstrap materialization to centralize active workspace path resolution in the shared runtime helper')
  }
  if (!runtimeSharedText.includes('export function buildMaterializedWorkspaceActivePathKey(args?:')) {
    throw new Error('expected workspace bootstrap materialization to centralize active workspace path dedupe keys in the shared runtime helper')
  }
  if (!runtimeSharedText.includes('export function buildMaterializedWorkspaceForceIncludePaths(args?:')) {
    throw new Error('expected workspace bootstrap materialization to centralize active workspace force-include path derivation in the shared runtime helper')
  }
  if (!runtimeSharedText.includes('export async function resolveWorkspaceMaterializationEntries(args:')) {
    throw new Error('expected workspace bootstrap materialization to centralize workspace snapshot reuse vs relist decisions in the shared runtime helper')
  }
  if (!runtimeSharedText.includes('export function readReusableWorkspaceEntriesSnapshot(')) {
    throw new Error('expected workspace bootstrap materialization to centralize reusable workspace snapshot gating in the shared runtime helper')
  }
  if (!runtimeSharedText.includes('export function buildInitialWorkspaceStartupSnapshot(args:')) {
    throw new Error('expected workspace bootstrap startup snapshot branching to stay centralized in the shared runtime helper')
  }
  if (
    !runtimeSharedText.includes("const withoutWorkspacePrefix = trimmed.startsWith('workspace:') ? trimmed.slice('workspace:'.length) : trimmed") ||
    !runtimeSharedText.includes('const normalized = normalizeWorkspacePath(withoutWorkspacePrefix)')
  ) {
    throw new Error('expected workspace bootstrap materialization active-path helper to normalize workspace-prefixed paths instead of trimming raw strings inline')
  }
  if (!bootstrapText.includes('resolveMaterializedWorkspaceActivePath({')) {
    throw new Error('expected source files bootstrap to reuse the shared active workspace path helper before rematerializing source files')
  }
  if (!bootstrapStartupText.includes('resolveMaterializedWorkspaceActivePath({')) {
    throw new Error('expected bootstrap startup materialization to reuse the shared active workspace path helper before initial graph apply')
  }
  if (!bootstrapText.includes('buildMaterializedWorkspaceActivePathKey({')) {
    throw new Error('expected source files bootstrap to reuse the shared active workspace path key helper before rematerialization dedupe')
  }
  if (!bootstrapStartupText.includes('readReusableWorkspaceEntriesSnapshot(startup.workspaceEntries)')) {
    throw new Error('expected source files bootstrap to reuse the shared workspace snapshot helper before deciding whether startup entries should be passed into materialization')
  }
  if (!runtimeSharedText.includes('resolveWorkspaceSourceIndexSnapshot(args?.sourcesByPath)')) {
    throw new Error('expected workspace bootstrap materialization to centralize source-index snapshot reuse vs reload decisions in the shared source-index helper')
  }
  if (!bootstrapStartupText.includes('resolveWorkspaceSourceIndexSnapshot(undefined)')) {
    throw new Error('expected source files bootstrap startup hydration to reuse the shared source-index snapshot helper')
  }
  if (!bootstrapText.includes('materializeActiveWorkspaceEntryIntoSourceFiles().catch(() => {')) {
    throw new Error('expected active-path rematerialization to delegate apply-to-graph policy to shared materialization logic')
  }
  if (!runtimeSharedText.includes('const shouldApplyToGraph = args?.applyToGraph === true || isInitializationWorkspacePath(activePath) || activePathHasCanvasWorkspacePreset')) {
    throw new Error('expected shared materialization runtime to auto-apply graph updates for initialization or frontmatter-preset files')
  }
}

export function testMarkdownApplyUsesDirectParserPathForActiveText() {
  const documentActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataDocumentActions.ts')
  const documentActionsText = readFileSync(documentActionsPath, 'utf8')

  if (!documentActionsText.includes("const exactSourceFile = state.sourceFiles.find(file => String(file?.name || '').trim() === nextName) || null")) {
    throw new Error('expected applyMarkdownDocumentToGraph to only sync matching source-file text by exact name without delegating graph apply')
  }
  if (documentActionsText.includes("await mod.parseAndApplySourceFile(exactSourceFile.id)")) {
    throw new Error('expected applyMarkdownDocumentToGraph to avoid source-file parse/apply indirection and parse active markdown text directly')
  }
  if (!documentActionsText.includes('loadGraphDataFromTextViaParser(nextName, nextText, { applyToStore: false, syncMarkdownDocument: false })')) {
    throw new Error('expected applyMarkdownDocumentToGraph to parse active markdown text without delegated store mutation side-effects')
  }
  if (!documentActionsText.includes('get().setGraphData(parsedGraph)')) {
    throw new Error('expected applyMarkdownDocumentToGraph to commit parsed graph data through the current store instance')
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
  const runtimePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceExplorerState.tsx')
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
  if (!text.includes('const pruned = pruneWorkspaceEntriesForInlineSnapshot(list)')) {
    throw new Error('expected markdown workspace runtime refresh to centralize oversized inline workspace-entry pruning in the shared runtime helper')
  }
  if (!text.includes('setSourcesByPath(prev => (areWorkspaceSourcesEqual(prev, sources) ? prev : sources))')) {
    throw new Error('expected markdown workspace runtime refresh to skip no-op source-index state writes')
  }
  if (!text.includes('return buildWorkspaceRefreshSnapshot({')) {
    throw new Error('expected markdown workspace runtime refresh to centralize fallback refresh snapshot construction in the shared runtime helper')
  }
  if (!text.includes('return buildFailedWorkspaceRefreshSnapshot()')) {
    throw new Error('expected markdown workspace runtime refresh failure path to reuse the shared failed refresh snapshot helper')
  }

  const setIdx = text.indexOf('store.setSourceFiles(merged)')
  const applyIdx = text.indexOf('await scheduleApplyComposedFromSourceFiles()')
  if (setIdx < 0 || applyIdx < 0 || applyIdx <= setIdx) {
    throw new Error('expected markdown workspace runtime refresh to schedule composed apply immediately after setSourceFiles so delete/refresh clears stale overlays without page reload')
  }
}

export function testWorkspaceImportActionsReuseRefreshSnapshotForApply() {
  const importPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'importActions.ts')
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
  const importPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'importActions.ts')
  const fallbackPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'launchDropdownFallbacks.ts')
  const text = readFileSync(importPath, 'utf8')
  const fallbackText = readFileSync(fallbackPath, 'utf8')

  if (!text.includes("await focusAfterImport(createdPath, { applyToGraph, jobId })")) {
    throw new Error('expected local workspace import focus to reuse the shared graph-apply decision when activating the imported file')
  }
  if (!text.includes("await focusAfterImport(createdPath, { sourceUrl, applyToGraph: true, jobId })")) {
    throw new Error('expected URL workspace import focus to enforce graph-aware activation for imported canvas documents')
  }
  if (!fallbackText.includes('await focusFirstImportedWorkspaceFile({ fs, createdPaths: res.createdPaths, applyToGraph })')) {
    throw new Error('expected launch dropdown local import fallback to forward the shared graph-apply decision into imported-file activation')
  }
  if (!fallbackText.includes("opts: { applyToGraph: true }")) {
    throw new Error('expected launch dropdown URL import fallback to enforce graph apply before focusing the imported document')
  }
  if (fallbackText.includes('forceApplyToGraph: true')) {
    throw new Error('expected launch dropdown fallback focus to stop forcing duplicate graph apply after import')
  }
}

export function testWorkspaceManualRefreshActionsSuppressFollowUpFsEventRefresh() {
  const corePath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'core.ts')
  const mutationPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'mutationActions.ts')
  const websitePath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'websiteImportAction.ts')
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

export function testWorkspaceInlineTextOwnershipIsCentralized() {
  const helperPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'workspaceInlineText.ts')
  const runtimeIoPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceRuntime.io.ts')
  const runtimeImplPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const indexingPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const importApplyPath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'applyWorkspaceImportToCanvas.ts')
  const helperText = readFileSync(helperPath, 'utf8')
  const runtimeIoText = readFileSync(runtimeIoPath, 'utf8')
  const runtimeImplText = readFileSync(runtimeImplPath, 'utf8')
  const indexingText = readFileSync(indexingPath, 'utf8')
  const importApplyText = readFileSync(importApplyPath, 'utf8')

  if (!helperText.includes('export function upsertWorkspaceEntryInlineText(args:')) {
    throw new Error('expected workspace inline-text ownership to centralize workspace-entry text patching in the shared workspace helper')
  }
  if (!helperText.includes('export function resolveWorkspaceSourceFileInlineText(')) {
    throw new Error('expected workspace inline-text ownership to centralize source-file inline text fallback in the shared workspace helper')
  }
  if (!runtimeImplText.includes('upsertWorkspaceEntryInlineText({')) {
    throw new Error('expected markdown workspace runtime entry patching to reuse the shared workspace inline-text helper')
  }
  if (!indexingText.includes('upsertWorkspaceEntryInlineText({')) {
    throw new Error('expected markdown workspace indexing to reuse the shared workspace inline-text helper for cached entry upserts')
  }
  if (!runtimeIoText.includes('resolveWorkspaceSourceFileInlineText(args.text)')) {
    throw new Error('expected markdown workspace runtime source-file writeback to reuse the shared workspace inline-text helper')
  }
  if (!importApplyText.includes('resolveWorkspaceSourceFileInlineText(text)')) {
    throw new Error('expected workspace import apply to reuse the shared workspace inline-text helper for source-file payload sizing')
  }
}

export function testWorkspaceWriteThroughAndActiveDocSyncOwnershipIsCentralized() {
  const runtimeIoPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceRuntime.io.ts')
  const activeDocPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'activeMarkdownDocument.ts')
  const importActionsPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'importActions.ts')
  const mutationActionsPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'mutationActions.ts')
  const selectionPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceSelection.ts')
  const indexingPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const savePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceSave.ts')
  const corePath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useWorkspaceFileActions', 'core.ts')
  const importEffectsPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'importSideEffects.ts')

  const runtimeIoText = readFileSync(runtimeIoPath, 'utf8')
  const activeDocText = readFileSync(activeDocPath, 'utf8')
  const importActionsText = readFileSync(importActionsPath, 'utf8')
  const mutationActionsText = readFileSync(mutationActionsPath, 'utf8')
  const selectionText = readFileSync(selectionPath, 'utf8')
  const indexingText = readFileSync(indexingPath, 'utf8')
  const savePathText = readFileSync(savePath, 'utf8')
  const coreText = readFileSync(corePath, 'utf8')
  const importEffectsText = readFileSync(importEffectsPath, 'utf8')

  if (!runtimeIoText.includes('export const writeWorkspaceFileAndSync = async (args:')) {
    throw new Error('expected markdown workspace runtime IO to remain the shared write-through owner')
  }
  if (!runtimeIoText.includes('export const syncWorkspaceTextState = (args:')) {
    throw new Error('expected markdown workspace runtime IO to centralize in-memory workspace text sync ownership')
  }
  if (!importActionsText.includes('await writeWorkspaceFileAndSync({')) {
    throw new Error('expected workspace import actions to reuse the shared write-through owner after external content writes')
  }
  if (!mutationActionsText.includes('await writeWorkspaceFileAndSync({')) {
    throw new Error('expected workspace mutation actions to reuse the shared write-through owner after refresh and clear writes')
  }
  if (mutationActionsText.includes("await fs.writeFileText(p, '')")) {
    throw new Error('expected workspace mutation actions not to keep a raw batch clear write path outside the shared write-through owner')
  }
  if (!indexingText.includes('await writeWorkspaceFileAndSync({')) {
    throw new Error('expected markdown workspace indexing sanitize writes to reuse the shared write-through owner')
  }
  if (indexingText.includes('await fs.writeFileText(path, sanitized)')) {
    throw new Error('expected markdown workspace indexing not to keep a duplicate raw sanitize writeback path outside the shared write-through owner')
  }
  if (!activeDocText.includes('export function buildActiveMarkdownDocumentPayload(args:')) {
    throw new Error('expected active markdown document sync ownership to be centralized in a shared markdown helper')
  }
  if (!activeDocText.includes('export function applyActiveMarkdownDocumentPayload(args:')) {
    throw new Error('expected active markdown document apply ownership to be centralized in a shared markdown helper')
  }
  if (!selectionText.includes('applyActiveMarkdownDocumentPayload({')) {
    throw new Error('expected markdown workspace selection restore paths to reuse the shared active markdown document helper')
  }
  if (!coreText.includes('syncWorkspaceTextState({')) {
    throw new Error('expected workspace import focus to reuse the shared workspace text-state sync helper')
  }
  if (!coreText.includes('readWidgetRegistryMetadataEntries(graphData?.metadata).length > 0')) {
    throw new Error('expected workspace file actions core to reuse the shared widget-registry metadata reader before switching into Flow Editor import mode')
  }
  if (coreText.includes('FLOW_WIDGET_REGISTRY_METADATA_KEY')) {
    throw new Error('expected workspace file actions core to stop parsing the widget registry metadata key inline')
  }
  if (!coreText.includes('const revealWorkspacePath = React.useCallback(')) {
    throw new Error('expected workspace file actions core to centralize path reveal/selection shell behind a shared helper')
  }
  if (!coreText.includes("await focusAfterImport(path, { applyToGraph: false })")) {
    throw new Error('expected createNewFile to reuse the canonical focus/open path instead of locally duplicating file-open state sync')
  }
  if (!coreText.includes('revealWorkspacePath(path, { activate: false })')) {
    throw new Error('expected createNewFolder to reuse the shared reveal shell instead of locally duplicating folder selection expansion state')
  }
  if (!mutationActionsText.includes('syncWorkspaceTextState({')) {
    throw new Error('expected workspace mutation actions to reuse the shared workspace text-state sync helper for rename remap refresh')
  }
  if (mutationActionsText.includes("lastLoadedRef.current = { path: last.path, text: '' }")) {
    throw new Error('expected workspace mutation actions not to keep a local non-active lastLoadedRef clear fallback once shared text-state sync owns tracked-path updates')
  }
  if (!runtimeIoText.includes('pushWorkspaceTextToActiveMarkdownDocument({')) {
    throw new Error('expected workspace text-state sync ownership to centralize active markdown document refresh through the shared push helper')
  }
  if (!runtimeIoText.includes('args.lastLoadedRef.current?.path === args.path')) {
    throw new Error('expected workspace text-state sync helper to keep tracked non-active path text coherent without a local mutation fallback')
  }
  if (!savePathText.includes('syncWorkspaceTextState({')) {
    throw new Error('expected workspace save-as flow to reuse the shared workspace text-state sync helper after file creation')
  }
  if (!importEffectsText.includes('buildActiveMarkdownDocumentPayload({') || !importEffectsText.includes('applyActiveMarkdownDocumentPayload({')) {
    throw new Error('expected toolbar import side effects to reuse the shared active markdown document payload helper')
  }
}

export function testSourceFilesDbPersistsOnlyChangedRows() {
  const dbPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesDb.ts')
  const workspaceStatePath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesWorkspaceState.ts')
  const text = readFileSync(dbPath, 'utf8')
  const workspaceStateText = readFileSync(workspaceStatePath, 'utf8')

  if (!text.includes('const existingById = new Map(existing.map(doc => [String(doc.get(\'id\') || \'\'), doc]))')) {
    throw new Error('expected source files db persistence to index existing rows by id before deciding which rows actually changed')
  }
  if (
    !text.includes('existingOrderIndex === row.orderIndex &&') ||
    !text.includes('areSourceFileRecordsEqual(existingPayload, row.payload, { includeGraphData: false, includeGraphRevision: false })') ||
    !text.includes('areSourceFileSourcesEqual(existingPayload.source, row.payload.source)')
  ) {
    throw new Error('expected source files db persistence to skip incrementalUpsert for unchanged source-file rows')
  }
  if (!workspaceStateText.includes('export function areSourceFilesWorkspaceStatesEqual(')) {
    throw new Error('expected source files db persistence to centralize workspace-state equality checks in the shared workspace-state helper')
  }
  if (
    !text.includes('const payload = normalizeSourceFilesWorkspaceState(state)') ||
    !text.includes('if (areSourceFilesWorkspaceStatesEqual(existingPayload, payload)) return')
  ) {
    throw new Error('expected source files workspace persistence to skip writes when the normalized workspace snapshot is unchanged via the shared helper')
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
