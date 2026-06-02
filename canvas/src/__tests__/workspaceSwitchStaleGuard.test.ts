import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })
const markdownWorkspaceRuntimePath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
const markdownWorkspaceSelectionPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceSelection.ts')
const markdownWorkspaceViewShellPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceViewShell.tsx')
const markdownWorkspaceEffectiveContentPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceEffectiveContent.ts')
const markdownWorkspaceInteractionsPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceInteractions.ts')
const markdownWorkspaceDocumentSwitchPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceDocumentSwitch.ts')
const markdownPreviewTokensPath = () =>
  path.resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'useMarkdownPreviewTokens.ts')

export const testMarkdownWorkspaceRuntimeGuardsStaleIndexJobs = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readUtf8(runtimePath)
  if (!text.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('Expected workspace runtime open-edge layout normalization to use canonical overlay-open semantics')
  }
  if (!text.includes('}, [workspaceEditorOverlayOpen])')) {
    throw new Error('Expected workspace runtime open-edge layout normalization not to key off workspaceViewMode alone')
  }
  const indexingPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const indexingText = readUtf8(indexingPath)
  if (!indexingText.includes('const isStaleJob = () =>')) {
    throw new Error('Expected markdown workspace indexing to define stale-index job guard')
  }
  if (!indexingText.includes('if (isStaleJob()) return')) {
    throw new Error('Expected markdown workspace indexing to short-circuit stale jobs before mutating state')
  }
  if (!indexingText.includes('indexingInFlightPathRef')) {
    throw new Error('Expected markdown workspace indexing to track the active path that owns the in-flight indexing job')
  }
  if (!indexingText.includes('args.indexingInFlightPathRef.current === scheduledFor')) {
    throw new Error('Expected markdown workspace indexing cleanup to release cancelled in-flight jobs by owner path')
  }
  if (indexingText.includes('args.indexingInFlight,') || indexingText.includes('indexingInFlight,\\n    args.indexingInFlightRef')) {
    throw new Error('Expected markdown workspace indexing effect not to depend on indexingInFlight state and self-cancel started jobs')
  }
  if (!indexingText.includes('const geoGraph = isGeoCandidate') || !indexingText.includes('if (isStaleJob()) return')) {
    throw new Error('Expected workspace geospatial parse/index path to be protected by stale-job guard')
  }
  if (indexingText.includes('maybeAutoEnableGeospatialModeForGraphData')) {
    throw new Error('Expected passive Source Files indexing not to auto-enable geospatial surface mode while switching files')
  }
  const bootstrapPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceBootstrapState.ts')
  const bootstrapText = readUtf8(bootstrapPath)
  if (!bootstrapText.includes('const indexingInFlightPathRef = React.useRef<WorkspacePath | null>(null)')) {
    throw new Error('Expected markdown workspace bootstrap state to keep indexing in-flight ownership scoped by active path')
  }
  if (!bootstrapText.includes("const setMarkdownWorkspaceIndexingInFlight = useGraphStore(s => s.setMarkdownWorkspaceIndexingInFlight)")) {
    throw new Error('Expected markdown workspace bootstrap state to publish indexing status into the shared graph store')
  }
  if (!bootstrapText.includes('setMarkdownWorkspaceIndexingInFlight(indexingInFlight === true)')) {
    throw new Error('Expected markdown workspace bootstrap state to mirror local in-flight status into the shared graph store via effect sync')
  }
  if (bootstrapText.includes('setMarkdownWorkspaceIndexingInFlight(normalized)')) {
    throw new Error('Expected markdown workspace indexing setter wrapper to stay side-effect free and avoid graph-store updates during render-phase state updates')
  }
  if (!bootstrapText.includes('setMarkdownWorkspaceIndexingInFlight(false)')) {
    throw new Error('Expected markdown workspace bootstrap cleanup to clear shared indexing status on unmount')
  }
  if (!bootstrapText.includes('const outlineSourceText = activeTextOwnedByActivePath ? activeText : \'\'')) {
    throw new Error('Expected markdown workspace bootstrap state to gate TOC outline parsing by active-path-owned editor text during Source Files switching')
  }
  if (!bootstrapText.includes('const outlineText = useDebouncedValue(outlineSourceText, 160, outlineTextResetKey)')) {
    throw new Error('Expected markdown workspace bootstrap state to debounce TOC outline parsing from the gated active-path text source')
  }
  if (bootstrapText.includes('const outlineText = useDebouncedValue(activeText, 160, args.activePath)')) {
    throw new Error('Expected markdown workspace bootstrap state not to debounce TOC outline parsing directly from stale cross-path editor text')
  }
  const debouncedValueText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'hooks', 'useDebouncedValue.ts'))
  if (!debouncedValueText.includes('const valueRef = React.useRef(v)')
    || !debouncedValueText.includes('const resetKeyRef = React.useRef(resetKey)')
    || !debouncedValueText.includes('if (Object.is(valueRef.current, val)) return')
    || !debouncedValueText.includes('if (Object.is(resetKeyRef.current, resetKey)) return')
    || !debouncedValueText.includes('if (Object.is(valueRef.current, value)) return')) {
    throw new Error('Expected shared debounced value hook to avoid scheduling same-value updates during reset-key churn')
  }
  if (debouncedValueText.includes('setV(value)')) {
    throw new Error('Expected shared debounced value reset path not to synchronously dispatch during reset-key churn')
  }
  const documentSwitchText = readUtf8(markdownWorkspaceDocumentSwitchPath())
  if (!documentSwitchText.includes('export function isMarkdownWorkspaceDocumentSwitchPending(args:')) {
    throw new Error('Expected markdown workspace document switching to centralize pending-state ownership in a shared helper')
  }
  if (!documentSwitchText.includes('return !matchesMarkdownDocumentPath(activePath, markdownDocumentName)')) {
    throw new Error('Expected markdown workspace pending-state helper to key off active-path versus markdown-document ownership mismatch')
  }
  const canvasPageText = readUtf8(path.resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx'))
  if (!canvasPageText.includes('isMarkdownWorkspaceDocumentSwitchPending({')) {
    throw new Error('Expected Canvas page toolbar handoff to reuse the shared markdown workspace pending-state helper')
  }
  if (!canvasPageText.includes('Switching document:')) {
    throw new Error('Expected Canvas page to replace stale toolbar controls with a switching-document placeholder during source-file handoff')
  }
  const canvasViewportText = readUtf8(path.resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx'))
  if (!canvasViewportText.includes('documentSwitchPending ? (')) {
    throw new Error('Expected Canvas viewport to render a switching-document placeholder while the active document handoff is pending')
  }
  if (!canvasViewportText.includes('Preparing canvas view...')) {
    throw new Error('Expected Canvas viewport pending placeholder to suppress stale canvas content during source-file handoff')
  }
}

export const testMarkdownWorkspaceRuntimeWidgetAutoRestoreDoesNotMarkUserForcedDocument = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceWidgetMode.ts')
  const text = readUtf8(runtimePath)
  if (!text.includes('const setContentModeAuto = React.useCallback')) {
    throw new Error('Expected markdown workspace runtime to expose auto content mode setter')
  }
  if (!text.includes("setContentModeAuto('document')")) {
    throw new Error('Expected unavailable widget fallback to use auto content mode setter')
  }
  if (!text.includes("setContentModeAuto('widget')")) {
    throw new Error('Expected widget re-availability restore to use auto content mode setter')
  }
  if (!text.includes('const userForcedDocumentRef = React.useRef(false)')) {
    throw new Error('Expected markdown workspace runtime to keep explicit user-forced document tracking')
  }
  if (!text.includes("const setContentMode = React.useCallback((mode: 'document' | 'widget') => {")) {
    throw new Error('Expected markdown workspace runtime to funnel explicit content-mode changes through a sticky user-intent setter')
  }
  if (!text.includes("userForcedDocumentRef.current = mode === 'document'")) {
    throw new Error('Expected explicit document-mode selection to stay sticky until widget mode is explicitly re-enabled')
  }
  if (!text.includes('userForcedDocumentRef.current = false')) {
    throw new Error('Expected widget auto-restore to clear user-forced document tracking')
  }
  if (!text.includes('const widgetLookupActive = active && widgetCandidateIdsKey !== emptyWidgetCandidateIdsKey')) {
    throw new Error('Expected widget graph lookup to be gated by active widget candidate semantics')
  }
  if (!text.includes('const widgetBundleBuildActive = active && contentMode === \'widget\' && widgetAvailable')) {
    throw new Error('Expected widget bundle construction to run only when widget mode is active')
  }
  if (!text.includes('const widgetGraphSemanticKey = React.useMemo(() => {')) {
    throw new Error('Expected widget lookup caching to derive a semantic graph key before rebuilding node and edge maps')
  }
  const runtimeEntryText = readUtf8(markdownWorkspaceRuntimePath())
  if (!runtimeEntryText.includes('const graphSemanticKey = React.useMemo(() => {')) {
    throw new Error('Expected markdown workspace runtime to derive a semantic graph key from composed source-layer metadata')
  }
  if (!runtimeEntryText.includes('graphSemanticKey,')) {
    throw new Error('Expected markdown workspace runtime to pass semantic graph keys into widget mode')
  }
  const indexingPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const indexingText = readUtf8(indexingPath)
  if (!indexingText.includes("if (args.contentMode === 'widget' && args.widgetAvailable) return")) {
    throw new Error('Expected widget mode to skip markdown file re-indexing when widget content is the active SSOT')
  }
}

export const testMarkdownWorkspaceRuntimeWidgetBundleIncludesOpenWidgetSet = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceWidgetMode.ts')
  const text = readUtf8(runtimePath)
  if (!text.includes('const resolvedWidgetNodeIds = React.useMemo(() => {')) {
    throw new Error('Expected markdown workspace runtime to derive widget content from a widget node id set')
  }
  if (!text.includes('const widgetBundleGraph = React.useMemo(() => {')) {
    throw new Error('Expected markdown workspace runtime to resolve widget bundle graph state through a dedicated memo')
  }
  if (!text.includes('nodes: widgetNodes,')) {
    throw new Error('Expected widget bundle graph to include all open widget nodes')
  }
  if (!text.includes('getCachedGraphSubsetByNodeIds({')) {
    throw new Error('Expected widget bundle edges to reuse the shared cached graph subset helper per graph revision')
  }
  if (!text.includes("cacheScope: 'markdown-workspace-widget-bundle'")) {
    throw new Error('Expected widget bundle edges to be collected through the dedicated widget-bundle subset cache scope')
  }
}

export const testMarkdownWorkspaceRuntimeFlowEditorDirectApplyUsesIncomingGraphInsteadOfPreviousComposition = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readUtf8(runtimePath)
  if (!text.includes('const shouldUseDirectGraphDataFor = (graphData: GraphData | null | undefined) =>')) {
    throw new Error('Expected markdown workspace runtime to compute direct-apply policy from incoming graph data')
  }
  if (!text.includes("return String(meta.sourceLayerComposition || '') !== 'compose'")) {
    throw new Error('Expected flow editor direct-apply policy to keep non-composed incoming graphs direct')
  }
  if (!text.includes('if (shouldUseDirectGraphDataFor(gd))')) {
    throw new Error('Expected parsed markdown graph apply path to use incoming graph data for direct/composed decision')
  }
  if (!text.includes('if (shouldUseDirectGraphDataFor(cachedGraph))')) {
    throw new Error('Expected cached parsed graph apply path to use incoming graph data for direct/composed decision')
  }
}

export const testMarkdownWorkspaceRuntimeGraphWritebackRefreshesActiveEditorTextSafely = () => {
  const text = readUtf8(markdownWorkspaceSelectionPath())
  const effectStart = text.indexOf("  React.useEffect(() => {\n    const writebackSync = resolveMarkdownWorkspaceSelectionWritebackSync({")
  const effectEnd = text.indexOf('  React.useEffect(() => {\n    const path = args.activePath', effectStart)
  const effectSection = effectStart >= 0 && effectEnd > effectStart ? text.slice(effectStart, effectEnd) : ''
  if (!effectSection.includes('if (!writebackSync) return')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to reuse the shared writeback precondition helper')
  }
  if (effectSection.includes("if (contentMode === 'widget') return")) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to refresh hidden markdown editor state even while widget mode is active')
  }
  if (!effectSection.includes('const hasUnsavedUserEdit = !!(')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to guard against unsaved user edits')
  }
  if (!effectSection.includes('commitMarkdownWorkspaceWriteback({')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to reuse the shared writeback commit helper')
  }
}

export const testMarkdownWorkspaceSelectionClearsStaleEditorTextBeforeSsotDocumentSwitch = () => {
  const text = readUtf8(markdownWorkspaceSelectionPath())
  if (!text.includes('const previousActivePathRef = React.useRef<WorkspacePath | null>(args.activePath)')) {
    throw new Error('Expected markdown workspace selection to track the previous active path before synchronizing the active markdown document')
  }
  const clearEffectStart = text.indexOf('  const previousActivePathRef = React.useRef<WorkspacePath | null>(args.activePath)')
  const ssotSyncStart = text.indexOf('  useMarkdownEditorSsotSync({', clearEffectStart)
  const clearEffectSection = clearEffectStart >= 0 && ssotSyncStart > clearEffectStart ? text.slice(clearEffectStart, ssotSyncStart) : ''
  if (!clearEffectSection.includes('if (!nextPath || !prevPath || prevPath === nextPath || activeEntryKind === \'folder\' || !args.activeRef.current) return')) {
    throw new Error('Expected markdown workspace selection to clear stale text only for real file-to-file transitions')
  }
  if (!clearEffectSection.includes("args.setActiveTextProgrammatic('')")) {
    throw new Error('Expected markdown workspace selection to blank stale editor text before SSOT sync can publish the previous file under the next document key')
  }
  if (!clearEffectSection.includes('args.setHighlightedLineRange(null)') || !clearEffectSection.includes('args.clearStatus()')) {
    throw new Error('Expected markdown workspace selection to clear transient line focus and status when switching files with stale editor text')
  }
  if (!clearEffectSection.includes('const switchedActivePathRef = React.useRef<{ prev: WorkspacePath; next: WorkspacePath } | null>(null)')) {
    throw new Error('Expected markdown workspace selection to track explicit switched active path pair for deterministic same-tick switch hydration')
  }
  if (!clearEffectSection.includes('args.lastLoadedRef.current = { path: nextPath, text: nextText }')) {
    throw new Error('Expected markdown workspace selection to update last-loaded snapshot when immediate switched-path text hydration is applied')
  }
  if (!clearEffectSection.includes('args.setActiveTextProgrammatic(nextText)')) {
    throw new Error('Expected markdown workspace selection to hydrate switched-file text immediately when inline active entry text is available')
  }
}

export const testMarkdownWorkspaceSelectionAppliesFrontmatterFileSwitchAtActiveDocumentBoundary = () => {
  const text = readUtf8(markdownWorkspaceSelectionPath())
  const viewShellText = readUtf8(markdownWorkspaceViewShellPath())
  const presetHelperPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'workspaceSwitchPreset.ts')
  if (fs.existsSync(presetHelperPath)) {
    throw new Error('Expected Source Files switching not to retain a YAML frontmatter preset detector/helper')
  }
  if (text.includes('const hasGraphData =')) {
    throw new Error('Expected markdown workspace selection frontmatter replay dedupe to avoid empty-graph retry loops that can churn and freeze on file switching')
  }
  if (
    text.includes('readCanvasWorkspacePresetSwitchContext') ||
    text.includes('hasCanvasWorkspacePresetForSwitch') ||
    text.includes('buildCanvasWorkspacePresetSwitchSemanticKey') ||
    text.includes('canvasWorkspacePreset:')
  ) {
    throw new Error('Expected Source Files switching to avoid local YAML Canvas preset aliases outside the active document owner')
  }
  if (text.includes('primeStrictFrontmatterFlowEditorMode') || text.includes('shouldPrimeStrictFlowEditorModeForWorkspaceText')) {
    throw new Error('Expected markdown workspace selection to avoid stale Flow Editor-only preset priming')
  }
  if (text.includes('applyCanvasWorkspacePresetForSwitch')) {
    throw new Error('Expected markdown workspace selection not to pre-apply YAML Canvas presets while switching files')
  }
  if (viewShellText.includes('applyCanvasWorkspacePresetForSwitch') || viewShellText.includes('flushSync')) {
    throw new Error('Expected markdown workspace explorer click path not to pre-apply YAML Canvas presets before active document ownership changes')
  }
  if (text.includes('FRONTMATTER_SWITCH_GRAPH_APPLY_DELAY_MS') || text.includes('frontmatterSwitchGraphApplyTimerRef') || text.includes('applyGraphAfterSelection')) {
    throw new Error('Expected markdown workspace selection not to schedule graph apply from Source Files selection state')
  }
  if (!text.includes('autoEnableFrontmatter: true,\n        applyViewPreset: true,\n        applyToGraph: true')) {
    throw new Error('Expected markdown workspace selection to apply selected file content and YAML Canvas view presets through the active document owner')
  }
  if (!text.includes('forceApplyToGraph: true')) {
    throw new Error('Expected markdown workspace selection to force the selected file to replace stale Canvas graph data')
  }
  if (!text.includes('if (nextPath && prevPath && prevPath !== nextPath) {') || !text.includes('if (switched.next !== args.activePath) return')) {
    throw new Error('Expected markdown workspace selection to keep the pending file switch stable until the active document owner consumes the matching path')
  }
  if (!text.includes('readWorkspaceActiveDocumentResolvedText({') || !text.includes('args.patchWorkspaceEntryInlineText(nextPath, nextText)')) {
    throw new Error('Expected markdown workspace selection to hydrate metadata-only workspace entries through the shared active-document resolver before applying selected file frontmatter')
  }
  if (!text.includes('normalizeWebpageFrontmatterToMarkdown: false')) {
    throw new Error('Expected Source Files frontmatter replay to keep original markdown flow blocks instead of normalizing to webpage key/value markdown')
  }
  if (!text.includes("hashStringToHexSharedContentCached(text, 'markdown-workspace-switch')")) {
    throw new Error('Expected plain document switch signatures to reuse the shared-content text hash cache instead of rescanning identical markdown under a switch-local cache key')
  }
  if (text.includes("'markdown-workspace-document-switch-apply',\n      activeDocumentKey,\n      nextText,")) {
    throw new Error('Expected plain document switch signatures not to embed full markdown text in signature parts')
  }
}

export const testWorkspaceSwitchPresetDetectsCanonicalKgFrontmatter = () => {
  const text = readUtf8(markdownWorkspaceSelectionPath())
  if (text.includes('kgCanvas') || text.includes('kgFrontmatter') || text.includes('parseCanvasWorkspaceFrontmatterPresetBlock')) {
    throw new Error('Expected Source Files switching to stay file-agnostic and not inspect canonical kg YAML frontmatter keys')
  }
}

export const testMarkdownEditorSsotSyncUsesHashedTextRefs = () => {
  const text = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useMarkdownEditorSsotSync.ts'))
  if (!text.includes('hashStringToHexCached')) {
    throw new Error('Expected markdown editor SSOT sync to reuse bounded text hash caching')
  }
  if (!text.includes('const lastPushedRef = React.useRef<{ key: string; textHash: string } | null>(null)')) {
    throw new Error('Expected markdown editor SSOT sync to avoid retaining full pushed document text')
  }
  if (!text.includes('const lastSeenRef = React.useRef<{ key: string; signature: string } | null>(null)')) {
    throw new Error('Expected markdown editor SSOT sync to track compact signatures instead of full seen document text')
  }
  if (text.includes('textRaw: string') || text.includes('lastPushedRef.current = { key, text:')) {
    throw new Error('Expected markdown editor SSOT sync not to store full active markdown text in refs')
  }
}

export const testMarkdownWorkspaceSelectionUsesEntryIndexForSwitchHotPath = () => {
  const selectionText = readUtf8(markdownWorkspaceSelectionPath())
  const derivedText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceSelectionDerived.ts'))
  const syncText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceSelectionSync.ts'))
  const bootstrapText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceSelectionBootstrap.ts'))
  const canonicalText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceSelectionCanonicalPath.ts'))
  const viewShellText = readUtf8(markdownWorkspaceViewShellPath())
  const explorerStateText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceExplorerState.tsx'))
  const indexText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'workspaceEntriesIndex.ts'))
  if (!selectionText.includes('const entriesIndex = React.useMemo(() => buildWorkspaceEntriesIndex(args.entries), [args.entries])')) {
    throw new Error('Expected markdown workspace selection to build one entries index per entries revision instead of scanning on active-path switches')
  }
  if (!selectionText.includes('if (selectionPathRef.current === normalized) return')
    || !selectionText.includes('if (normalizeMarkdownWorkspaceSelectionPath(args.activePath) === normalized) return')
    || !selectionText.includes('selectionPath: selectionPathRef.current')
    || !selectionText.includes('setSelectionPathSafe(nextSelectionPath)')) {
    throw new Error('Expected markdown workspace selection effects to avoid scheduling same-path state updates during workspace open')
  }
  if (!syncText.includes('const activePath = normalizeMarkdownWorkspaceSelectionPath(args.activePath)')
    || !syncText.includes('resolveMarkdownWorkspaceDocsMirrorCanonicalPath(rawActivePath, args.entriesIndex)')
    || !syncText.includes('const selectionPath = normalizeMarkdownWorkspaceSelectionPath(args.selectionPath)')
    || !syncText.includes('if (activePath && selectionPath === activePath) return undefined')) {
    throw new Error('Expected workspace selection helpers to normalize path aliases before invalidating pending active-document paths')
  }
  if (!derivedText.includes('entriesIndex: WorkspaceEntriesIndex') || !derivedText.includes('getWorkspaceEntry(args.entriesIndex, args.activePath)')) {
    throw new Error('Expected selection derivation to resolve active and selection entries through the shared entries index')
  }
  if (derivedText.includes('args.entries.find(') || syncText.includes('args.entries.some(') || canonicalText.includes('args.entries.some(')) {
    throw new Error('Expected selection helpers to avoid repeated linear scans when only the active Source Files path changes')
  }
  if (!bootstrapText.includes('workspaceFilePaths: args.entriesIndex.filePaths')
    || !bootstrapText.includes('hasWorkspaceEntry(args.entriesIndex, activePath)')
    || !bootstrapText.includes('return canonicalize(args.entriesIndex.firstFilePath) || args.entriesIndex.firstFilePath')) {
    throw new Error('Expected active-path bootstrap fallback to reuse indexed file paths and first-file metadata')
  }
  if (!viewShellText.includes('const entriesIndex = React.useMemo(() => buildWorkspaceEntriesIndex(entries), [entries])')
    || !viewShellText.includes('hasWorkspaceFileEntry(entriesIndex, sitemapPath)')
    || !viewShellText.includes('hasWorkspaceFileEntry(entriesIndex, journeyPath)')) {
    throw new Error('Expected Source Files shell actions to use indexed file lookups instead of per-click/per-render scans')
  }
  if (!explorerStateText.includes('getFirstDescendantFilePath(entriesIndex, folder)')
    || !indexText.includes('firstDescendantFileByFolderPath')) {
    throw new Error('Expected folder contract targeting to use first-descendant file metadata from the shared entries index')
  }
}

export const testMarkdownPreviewTokenCachesUseCompactBoundedKeys = () => {
  const text = readUtf8(markdownPreviewTokensPath())
  if (!text.includes('const lexedMarkdownCache = new Map<string, CacheEntry<LexedMarkdownResult>>()')) {
    throw new Error('Expected markdown preview lex cache values to carry size metadata behind compact string keys')
  }
  if (!text.includes('const currentTokensKey = React.useMemo(() => buildMarkdownTokensKey(text), [text])')) {
    throw new Error('Expected markdown preview caches to use the exact compact markdown token key instead of whole document strings')
  }
  if (!text.includes('LEXED_CACHE_MAX_TOTAL_CHARS') || !text.includes('LEXED_CACHE_MAX_ENTRY_CHARS')) {
    throw new Error('Expected markdown preview token cache to enforce memory budgets while switching across Source Files')
  }
  if (text.includes('readCachedValue(lexedMarkdownCache, text)') || text.includes('writeCachedValue(lexedMarkdownCache, text')) {
    throw new Error('Expected markdown preview token cache not to retain full markdown text as a Map key')
  }
  if (text.includes('const tokenKeyCache = new Map<string, string>()')) {
    throw new Error('Expected markdown preview token key caching not to pin full markdown strings in memory')
  }
}

export const testFrontmatterSwitchHotPathUsesHeaderOnlyExtraction = () => {
  const frontmatterText = readUtf8(path.resolve(process.cwd(), 'src', 'lib', 'markdown', 'frontmatter.ts'))
  const webpageMetaText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'webpage', 'webpageMeta.ts'))
  const mermaidInputText = readUtf8(path.resolve(process.cwd(), '..', 'grph-shared', 'src', 'markdown', 'mermaidInput.ts'))
  if (!frontmatterText.includes('export function extractYamlFrontmatterHeaderBlock(rawText: string): YamlFrontmatterHeaderBlock | null')) {
    throw new Error('Expected frontmatter utilities to expose a header-only extractor for Source Files switch hot paths')
  }
  if (!frontmatterText.includes('const header = extractYamlFrontmatterHeaderBlock(text)')
    || !frontmatterText.includes('if (bodyTextCache == null) bodyTextCache = text.slice(rawBlock.length)')) {
    throw new Error('Expected full frontmatter extraction to build body text only for callers that actually need it')
  }
  if (!frontmatterText.includes('export function parseCanvasWorkspaceFrontmatterPreset(rawText: string): CanvasWorkspaceFrontmatterPreset | null {\n  const block = extractYamlFrontmatterHeaderBlock(rawText)')) {
    throw new Error('Expected canvas frontmatter preset parsing not to copy full markdown bodies on plain file switches')
  }
  if (!frontmatterText.includes('export function parseWebpageFrontmatterMeta(rawText: string): WebpageFrontmatterMeta | null {\n  const block = extractYamlFrontmatterHeaderBlock(rawText)')) {
    throw new Error('Expected webpage frontmatter parsing not to retain full body slices during workspace switching')
  }
  if (!webpageMetaText.includes('YamlFrontmatterHeaderBlock')) {
    throw new Error('Expected webpage metadata helpers to accept header-only frontmatter blocks')
  }
  if (mermaidInputText.includes('raw.match(/^---') || !mermaidInputText.includes("const end = raw.indexOf('\\n---')")) {
    throw new Error('Expected shared frontmatter Mermaid detection to scan only the YAML header instead of regex-capturing full markdown text')
  }
}

export const testFrontmatterCanvasSwitchSkipsDuplicateAndPlainMarkdownApply = () => {
  const runtimeText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'CanvasFrontmatterRuntime.tsx'))
  const loaderText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'parsers', 'loader.ts'))
  const documentActionsText = readUtf8(path.resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataDocumentActions.ts'))
  const presetText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'parsers', 'canvasFrontmatterPreset.ts'))
  if (!runtimeText.includes('isPendingFrontmatterFlowGraph(graphData)')) {
    throw new Error('Expected Canvas frontmatter runtime to skip auto-apply while explicit Source Files frontmatter graph parsing is pending')
  }
  if (!runtimeText.includes('if (markdownDocumentApplyViewPreset === false) return')) {
    throw new Error('Expected Canvas frontmatter runtime to keep passive Source Files switches from auto-applying layout presets')
  }
  if (!runtimeText.includes('if (!containsFrontmatterMermaid(text)) return')) {
    throw new Error('Expected Canvas frontmatter runtime to skip parser imports for plain markdown documents')
  }
  if (!runtimeText.includes("hashStringToHexCached(`canvas-frontmatter-runtime:${markdownDocumentName || 'document.md'}`, text)")) {
    throw new Error('Expected Canvas frontmatter runtime dedupe to reuse bounded text hashing')
  }
  if (!loaderText.includes('if (!containsFrontmatterMermaid(text)) return false')) {
    throw new Error('Expected parser auto-apply fallback to avoid loading parsers for markdown without YAML Mermaid frontmatter')
  }
  if (!documentActionsText.includes('const shouldResolveCanvasPreset = args?.applyViewPreset !== false || args?.applyToGraph === true')) {
    throw new Error('Expected active markdown document updates to skip canvas preset parsing when switch payloads disable preset and graph apply')
  }
  if (!documentActionsText.includes('const needsAutoEnable = shouldAutoEnableFrontmatter &&') || !documentActionsText.includes('containsFrontmatterMermaid(nextText)')) {
    throw new Error('Expected markdown document state updates to scan frontmatter Mermaid only when auto-enable may change state')
  }
  if (!documentActionsText.includes('preset: parsedTextPreset || undefined')) {
    throw new Error('Expected graph apply path to pass pre-parsed canvas frontmatter presets through to avoid repeat YAML parsing')
  }
  if (!presetText.includes('preset?: CanvasWorkspaceFrontmatterPreset | null') || !presetText.includes('if (args.preset) return args.preset')) {
    throw new Error('Expected canvas frontmatter preset application to accept pre-parsed presets from the switch hot path')
  }
}

export const testMarkdownWorkspaceDerivedViewsCentralizePersistenceWriteback = () => {
  const derivedViewsPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceDerivedViews.tsx')
  const ioPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'markdownWorkspaceRuntime.io.ts')
  const derivedViewsText = readUtf8(derivedViewsPath)
  const ioText = readUtf8(ioPath)
  if (!derivedViewsText.includes('const persistDerivedWorkspaceText = React.useCallback(')) {
    throw new Error('Expected derived workspace views to extract shared persistence/writeback plumbing behind a local helper')
  }
  if (!derivedViewsText.includes('await writeWorkspaceFileAndSync({')) {
    throw new Error('Expected derived workspace views to reuse the shared workspace file persistence helper')
  }
  if (derivedViewsText.includes('commitMarkdownWorkspaceWriteback({')) {
    throw new Error('Expected derived workspace views not to duplicate direct writeback commits once the shared persistence helper is in place')
  }
  if (derivedViewsText.includes('await fs.writeFileText(args.activePath, nextText)')) {
    throw new Error('Expected derived workspace views not to duplicate raw filesystem writeback sequences per view')
  }
  if (!ioText.includes('commitMarkdownWorkspaceWriteback({')) {
    throw new Error('Expected shared workspace file persistence helper to funnel editor/workspace refresh through the shared writeback commit')
  }
}

export const testMarkdownWorkspaceRealtimeSyncAppliesEditorChangesBackToGraph = () => {
  const runtimeText = readUtf8(markdownWorkspaceRuntimePath())
  const interactionsText = readUtf8(markdownWorkspaceInteractionsPath())
  if (!runtimeText.includes("const canvasWorkspaceSyncMode = useGraphStore(s => s.canvasWorkspaceSyncMode)")) {
    throw new Error('Expected Markdown Workspace runtime to read shared canvas workspace sync mode state')
  }
  if (!interactionsText.includes("argsRef.current = args")) {
    throw new Error('Expected markdown workspace interactions to keep current inputs behind a ref for stable apply callbacks')
  }
  if (!interactionsText.includes('const workspaceApplyEffectsEnabled = active && workspaceCanvasPaneOpen === true && indexingInFlight !== true')) {
    throw new Error('Expected markdown workspace apply effects to stay disabled while indexing is still mutating workspace-backed source state')
  }
  if (!interactionsText.includes("if (!workspaceApplyEffectsEnabled || canvasWorkspaceSyncMode !== 'realtime' || contentMode === 'widget') return")) {
    throw new Error('Expected realtime editor->graph sync to explicitly gate by workspace apply effect state, realtime mode, and widget mode')
  }
  if (!interactionsText.includes('if (!userEditedActiveTextRef.current) return')) {
    throw new Error('Expected realtime editor->graph sync to skip programmatic text hydration and only apply after user edits')
  }
  if (!interactionsText.includes("const graphText = markdownDocumentName === name ? String(markdownDocumentText || '') : ''")) {
    throw new Error('Expected realtime editor->graph sync to compare against current graph-backed markdown document text')
  }
  if (!interactionsText.includes('lastRealtimeApplySigRef')) {
    throw new Error('Expected realtime editor->graph sync to dedupe repeated apply cycles')
  }
  if (!interactionsText.includes('WORKSPACE_REALTIME_APPLY_DEBOUNCE_MS')) {
    throw new Error('Expected realtime editor->graph sync to coalesce rapid typing behind the shared debounce window')
  }
  if (!interactionsText.includes('const sig = `${name}:${hashStringToHex(text)}`')) {
    throw new Error('Expected realtime editor->graph sync to dedupe via lightweight text hashing instead of storing whole document text in memory')
  }
  if (!interactionsText.includes('const timer = window.setTimeout(() => {')) {
    throw new Error('Expected realtime editor->graph sync to debounce apply scheduling during rapid editor input')
  }
  if (!interactionsText.includes('return () => window.clearTimeout(timer)')) {
    throw new Error('Expected realtime editor->graph sync debounce to cancel stale pending apply timers')
  }
  if (!interactionsText.includes('void handleApply()')) {
    throw new Error('Expected realtime editor->graph sync to reuse shared markdown apply path')
  }
  if (interactionsText.includes('}, [args, geoDatasetIntegration])')) {
    throw new Error('Expected markdown apply callback to avoid aggregate args dependency churn during Workspace View open')
  }
}

export const testMarkdownWorkspaceSkipsMissingActiveEntryLoadsUntilPathRecovery = () => {
  const indexingPath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceIndexing.tsx')
  const text = readUtf8(indexingPath)
  if (!text.includes("if (!path || !args.activeEntry || args.activeEntryKind === 'folder') return")) {
    throw new Error('Expected markdown workspace indexing to skip file loads until the active path resolves to a real workspace entry')
  }
}

export const testMarkdownWorkspaceMainDefersHiddenPaneHeavyDerivations = () => {
  const mainPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'MarkdownWorkspaceMain.tsx')
  const editorPanePath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'editor', 'MarkdownEditorPane.tsx')
  const layoutPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'layout', 'MarkdownWorkspaceLayout.tsx')
  const initialPaneVisibilityPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'useInitialWorkspacePaneVisibility.ts')
  const toolbarPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'MarkdownWorkspaceToolbar.tsx')
  const dropdownPath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'ToolbarDropdownSelect.tsx')
  const typesPath = path.resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'types.ts')
  const mainText = readUtf8(mainPath)
  const editorPaneText = readUtf8(editorPanePath)
  const layoutText = readUtf8(layoutPath)
  const initialPaneVisibilityText = readUtf8(initialPaneVisibilityPath)
  const toolbarText = readUtf8(toolbarPath)
  const dropdownText = readUtf8(dropdownPath)
  const typesText = readUtf8(typesPath)
  if (!typesText.includes('DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY')) {
    throw new Error('Expected workspace pane visibility defaults to live in the shared main types module')
  }
  if (!typesText.includes('resolveMarkdownWorkspacePaneAvailability') || !typesText.includes("modelAssetFormat === 'glb'") || !typesText.includes("modelAssetFormat === 'gltf'")) {
    throw new Error('Expected workspace pane availability to classify GLB as bin and GLTF as JSON from a shared helper')
  }
  if (!typesText.includes('export function resolveMarkdownWorkspacePaneVisibility')) {
    throw new Error('Expected workspace pane visibility rules to live in a shared main types helper')
  }
  if (!typesText.includes('json: false')) {
    throw new Error('Expected JSON pane to be opt-in by default to avoid eager Markdown JSON-LD generation on load')
  }
  if (!typesText.includes('markdown: false')) {
    throw new Error('Expected Markdown editor pane to be opt-in by default in split loading so the viewer can render first')
  }
  if (mainText.includes('markdownDerivedViewerMode') || mainText.includes('markdownDerivedViewerKind')) {
    throw new Error('Expected workspace main loading to ignore persisted derived viewer modes to avoid stale heavy startup render paths')
  }
  if (!mainText.includes("React.useState<MarkdownWorkspaceDerivedViewerKind>('markdown')")) {
    throw new Error('Expected workspace main viewer kind to initialize from the cheap markdown SSOT')
  }
  if (!mainText.includes("React.useState<MarkdownWorkspaceDerivedViewerMode>('read')")) {
    throw new Error('Expected workspace main viewer mode to initialize from the cheap read SSOT')
  }
  if (!mainText.includes('const deferredSourceEditorTextRaw = React.useDeferredValue(sourceEditorTextRaw)')) {
    throw new Error('Expected workspace main to defer JSON editor source text before expensive JSON/JSON-LD derivations')
  }
  if (!mainText.includes('if (!jsonPaneVisible) return')) {
    throw new Error('Expected JSON editor text derivation to be gated by JSON pane visibility')
  }
  if (mainText.includes('setSplitPaneVisibility({ json: true, markdown: true, viewer: true })')) {
    throw new Error('Expected toolbar Editor Workspace open not to eagerly mount JSON, Markdown, and Viewer panes together')
  }
  if (!mainText.includes('useInitialWorkspacePaneVisibility({') || !initialPaneVisibilityText.includes('resolveMarkdownWorkspaceInitialPaneVisibility({')) {
    throw new Error('Expected workspace pane presets to flow through the shared initial visibility helper')
  }
  if (!mainText.includes('parseGlbAssetDocument(activeText)')) {
    throw new Error('Expected workspace main to derive model-asset pane policy from the parsed active Source File')
  }
  if (!mainText.includes('resolveMarkdownWorkspacePaneAvailability({ modelAssetFormat })')) {
    throw new Error('Expected workspace main to delegate GLTF/GLB pane selection to the shared availability helper')
  }
  if (!mainText.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('Expected workspace main open-edge pane normalization to use canonical overlay-open semantics')
  }
  if (!initialPaneVisibilityText.includes('args.webpageView ||') || !initialPaneVisibilityText.includes('args.workspaceEditorOverlayOpen')) {
    throw new Error('Expected workspace main pane normalization to include webpage view and canonical overlay-open semantics')
  }
  if (!mainText.includes('splitPaneVisibility,')
    || !initialPaneVisibilityText.includes('splitPaneVisibility: MarkdownWorkspacePaneVisibility')
    || !initialPaneVisibilityText.includes('areMarkdownWorkspacePaneVisibilitiesEqual(args.splitPaneVisibility, nextVisibility)')
    || !initialPaneVisibilityText.includes('if (!args.splitPaneVisibility.html) return')
    || !initialPaneVisibilityText.includes('if (args.splitPaneVisibility.viewer && args.splitPaneVisibility.html) return')) {
    throw new Error('Expected workspace pane preset normalization to check current visibility before scheduling state updates')
  }
  if (!mainText.includes('if (viewerInlineMarkdownDraftText !== null) setViewerInlineMarkdownDraftText(null)')
    || !mainText.includes('if (viewerInlineViewerText !== null) setViewerInlineViewerText(null)')
    || !mainText.includes('if (jsonDerivedMarkdownDraft !== null) setJsonDerivedMarkdownDraft(null)')
    || !mainText.includes('if (jsonDerivedMarkdownDraft !== jsonDerivedMarkdownBase) setJsonDerivedMarkdownDraft(jsonDerivedMarkdownBase)')) {
    throw new Error('Expected workspace draft reset effects to avoid scheduling no-op state updates during workspace open')
  }
  if (dropdownText.includes('flushSync')) {
    throw new Error('Expected toolbar dropdown selection not to force a synchronous close commit before opening Workspace View')
  }
  if (dropdownText.includes("if (!open) {\n      optionButtonRefs.current = []\n      setExpandedOptionId(null)")) {
    throw new Error('Expected closed toolbar dropdown effects not to re-clear expanded state on every parent option churn')
  }
  if (!dropdownText.includes('if (expandedOptionId !== null) setExpandedOptionId(null)')
    || !dropdownText.includes('if (activeParentOptionId && expandedOptionId == null) setExpandedOptionId(activeParentOptionId)')) {
    throw new Error('Expected toolbar dropdown expanded state writes to be guarded against closed-menu update loops')
  }
  if (editorPaneText.includes('const lineStarts = React.useMemo')) {
    throw new Error('Expected markdown editor pane not to scan full text for line starts during open render')
  }
  if (!editorPaneText.includes('const getLineStarts = React.useCallback')) {
    throw new Error('Expected markdown editor pane to build line starts lazily after caret events')
  }
  if (!mainText.includes('forceMarkdownEditorInEditorMode') || !mainText.includes('resolveMarkdownWorkspacePaneVisibility({')) {
    throw new Error('Expected workspace main pane visibility to reuse the shared visibility helper SSOT')
  }
  if (!mainText.includes('if (!markdownPaneVisible && !viewerPaneVisible) return null')) {
    throw new Error('Expected JSON-to-markdown derivation to be skipped when markdown and viewer panes are hidden')
  }
  if (!layoutText.includes('resolveMarkdownWorkspacePaneVisibility({')) {
    throw new Error('Expected layout to reuse the shared pane visibility helper SSOT')
  }
  if (!layoutText.includes('paneVisibility.json ?')) {
    throw new Error('Expected layout to avoid mounting hidden JSON editor pane')
  }
  if (!toolbarText.includes('DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY')) {
    throw new Error('Expected toolbar split pane fallback to reuse shared visibility defaults')
  }
  if (!toolbarText.includes('effectivePaneAvailability.bin') || !toolbarText.includes('not applicable for this Source File')) {
    throw new Error('Expected toolbar pane controls to show GLB bin state and grey out non-applicable model-asset panes')
  }
}

export const testMarkdownWorkspaceRuntimeKeepsEffectiveContentInSharedSsot = () => {
  const runtimeText = readUtf8(markdownWorkspaceRuntimePath())
  const effectiveText = readUtf8(markdownWorkspaceEffectiveContentPath())
  if (!runtimeText.includes("import { useMarkdownWorkspaceEffectiveContent } from './useMarkdownWorkspaceEffectiveContent'")) {
    throw new Error('Expected markdown workspace runtime to import the effective-content SSOT hook')
  }
  if (!runtimeText.includes('const effectiveContent = useMarkdownWorkspaceEffectiveContent({')) {
    throw new Error('Expected markdown workspace runtime to delegate editor/viewer effective content derivation to the SSOT hook')
  }
  if (runtimeText.includes('const effectiveActiveText =') || runtimeText.includes('const editorLanguage = activePath')) {
    throw new Error('Expected markdown workspace runtime to avoid regrowing inline effective content and editor language derivation')
  }
  if (!effectiveText.includes('languageForPath(activePath)')) {
    throw new Error('Expected effective-content hook to centralize workspace editor language derivation')
  }
  if (!effectiveText.includes('disableEditorMutations')) {
    throw new Error('Expected effective-content hook to centralize editor mutation gating')
  }
  if (!effectiveText.includes('saveEnabled')) {
    throw new Error('Expected effective-content hook to centralize workspace save eligibility')
  }
}
