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

export function testSourceFilesBootstrapResyncsOnWorkspaceViewModeChanges() {
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const text = readFileSync(bootstrapPath, 'utf8')

  if (!text.includes('useGraphStore.subscribe(s => s.workspaceViewMode')) {
    throw new Error('expected source files bootstrap to resync active workspace materialization when workspace view mode changes')
  }
  if (!text.includes('useMarkdownExplorerStore.subscribe(s => s.activePath')) {
    throw new Error('expected source files bootstrap to continue resyncing on active path changes')
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
  const runtimePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
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
}

export function testMarkdownApplyPrefersCanonicalSourceFileComposePath() {
  const slicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSlice.ts')
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const sliceText = readFileSync(slicePath, 'utf8')
  const ingestText = readFileSync(ingestPath, 'utf8')

  if (!sliceText.includes('function findSourceFileForMarkdownDocument')) {
    throw new Error('expected markdown apply path to centralize active source-file resolution before direct parser apply')
  }
  if (!sliceText.includes('const exactSourceFile = findSourceFileForMarkdownDocument(state, nextName)')) {
    throw new Error('expected applyMarkdownDocumentToGraph to prefer a matching source file for active markdown documents')
  }
  if (!sliceText.includes("await mod.parseAndApplySourceFile(exactSourceFile.id)")) {
    throw new Error('expected applyMarkdownDocumentToGraph to reuse the canonical source-file parse/apply flow')
  }
  if (!ingestText.includes('export async function parseAndApplySourceFile(fileId: string): Promise<void>')) {
    throw new Error('expected source-file ingest integration to export canonical parseAndApplySourceFile for shared callers')
  }
}

export function testWorkspaceCanvasAutoApplySkipsWidgetMode() {
  const runtimePath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readFileSync(runtimePath, 'utf8')
  const anchor = "React.useEffect(() => {\n    if (!workspaceCanvasPaneOpen) return"
  const idx = text.indexOf(anchor)
  if (idx < 0) {
    throw new Error('expected workspace canvas auto-apply effect in markdown workspace runtime')
  }
  const body = text.slice(idx, idx + 500)
  if (!body.includes("if (contentMode === 'widget') return")) {
    throw new Error('expected workspace canvas auto-apply effect to skip widget mode so reopen cannot apply widget bundle text as a full document')
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

  const setIdx = text.indexOf('store.setSourceFiles(merged)')
  const applyIdx = text.indexOf('await scheduleApplyComposedFromSourceFiles()')
  if (setIdx < 0 || applyIdx < 0 || applyIdx <= setIdx) {
    throw new Error('expected markdown workspace runtime refresh to schedule composed apply immediately after setSourceFiles so delete/refresh clears stale overlays without page reload')
  }
}
