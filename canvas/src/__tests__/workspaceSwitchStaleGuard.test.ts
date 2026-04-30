import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })
const markdownWorkspaceRuntimePath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
const markdownWorkspaceEffectiveContentPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceEffectiveContent.ts')
const markdownWorkspaceInteractionsPath = () =>
  path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceInteractions.ts')

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
  if (!indexingText.includes('await maybeAutoEnableGeospatialModeForGraphData') || !indexingText.includes('if (isStaleJob()) return')) {
    throw new Error('Expected geospatial auto-enable path to be protected by stale-job guard')
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
  if (!text.includes('userForcedDocumentRef.current = false')) {
    throw new Error('Expected widget auto-restore to clear user-forced document tracking')
  }
  if (!text.includes('const widgetLookupActive = active && widgetCandidateIdsKey !== emptyWidgetCandidateIdsKey')) {
    throw new Error('Expected widget graph lookup to be gated by active widget candidate semantics')
  }
  if (!text.includes('if (contentMode !== \'widget\' || widgetNodeIds.length === 0 || !graphLookupById) return \'\'')) {
    throw new Error('Expected widget bundle construction to run only when widget mode is active')
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
  if (!text.includes('const widgetNodeIdSet = new Set(widgetNodeIds)')) {
    throw new Error('Expected markdown workspace runtime to track widget bundle node ids as a set')
  }
  if (!text.includes('nodes: widgetNodes,')) {
    throw new Error('Expected widget bundle graph to include all open widget nodes')
  }
  if (!text.includes('return widgetNodeIdSet.has(sourceId) || widgetNodeIdSet.has(targetId)')) {
    throw new Error('Expected widget bundle edges to be collected from the open widget set')
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
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readUtf8(runtimePath)
  const effectStart = text.indexOf("  React.useEffect(() => {\n    const docKey = String(activeDocumentKey || '').trim()")
  const effectEnd = text.indexOf('  React.useEffect(() => {\n    const path = activePath', effectStart)
  const effectSection = effectStart >= 0 && effectEnd > effectStart ? text.slice(effectStart, effectEnd) : ''
  if (!effectSection.includes('if (!matchesMarkdownDocumentPath(docKey, markdownName)) return')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to reuse shared markdown document path matching')
  }
  if (effectSection.includes("if (contentMode === 'widget') return")) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to refresh hidden markdown editor state even while widget mode is active')
  }
  if (!effectSection.includes('const hasUnsavedUserEdit = !!(')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to guard against unsaved user edits')
  }
  if (!effectSection.includes('patchWorkspaceEntryInlineText(activePath, nextText)')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to refresh workspace entry inline text')
  }
  if (!effectSection.includes('setActiveTextProgrammatic(nextText)')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to refresh active editor text programmatically')
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
  if (!interactionsText.includes('const workspaceApplyEffectsEnabled = active && workspaceCanvasPaneOpen === true')) {
    throw new Error('Expected markdown workspace apply effects to be gated by active runtime and workspace pane visibility')
  }
  if (!interactionsText.includes("if (!workspaceApplyEffectsEnabled || canvasWorkspaceSyncMode !== 'realtime' || contentMode === 'widget') return")) {
    throw new Error('Expected realtime editor->graph sync to explicitly gate by workspace apply effect state, realtime mode, and widget mode')
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
  const mainPath = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'MarkdownWorkspaceMainLegacy.tsx')
  const editorPanePath = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'editor', 'MarkdownEditorPane.tsx')
  const layoutPath = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'layout', 'MarkdownWorkspaceLayout.tsx')
  const toolbarPath = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'MarkdownWorkspaceToolbar.tsx')
  const dropdownPath = path.resolve(process.cwd(), 'src', 'components', 'toolbar', 'ToolbarDropdownSelect.tsx')
  const typesPath = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'types.ts')
  const mainText = readUtf8(mainPath)
  const editorPaneText = readUtf8(editorPanePath)
  const layoutText = readUtf8(layoutPath)
  const toolbarText = readUtf8(toolbarPath)
  const dropdownText = readUtf8(dropdownPath)
  const typesText = readUtf8(typesPath)
  if (!typesText.includes('DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY')) {
    throw new Error('Expected workspace pane visibility defaults to live in the shared main types module')
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
  if (!mainText.includes('prev.markdown && !prev.json && !prev.viewer ? prev : { json: false, markdown: true, viewer: false }')) {
    throw new Error('Expected toolbar Editor Workspace open to normalize to markdown-only visibility')
  }
  if (!mainText.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('Expected workspace main open-edge pane normalization to use canonical overlay-open semantics')
  }
  if (!mainText.includes('}, [workspaceEditorOverlayOpen])')) {
    throw new Error('Expected workspace main open-edge pane normalization not to key off workspaceViewMode alone')
  }
  if (dropdownText.includes('flushSync')) {
    throw new Error('Expected toolbar dropdown selection not to force a synchronous close commit before opening Workspace View')
  }
  if (editorPaneText.includes('const lineStarts = React.useMemo')) {
    throw new Error('Expected markdown editor pane not to scan full text for line starts during open render')
  }
  if (!editorPaneText.includes('const getLineStarts = React.useCallback')) {
    throw new Error('Expected markdown editor pane to build line starts lazily after caret events')
  }
  if (!mainText.includes("const markdownPaneVisible = layoutMode === 'editor' ? true : layoutMode === 'split' && splitPaneVisibility.markdown")) {
    throw new Error('Expected markdown pane visibility to keep editor mode usable while keeping split markdown editor opt-in')
  }
  if (!mainText.includes('if (!markdownPaneVisible && !viewerPaneVisible) return null')) {
    throw new Error('Expected JSON-to-markdown derivation to be skipped when markdown and viewer panes are hidden')
  }
  if (!layoutText.includes('props.splitPaneVisibility.json ?')) {
    throw new Error('Expected layout to avoid mounting hidden JSON editor pane')
  }
  if (!toolbarText.includes('DEFAULT_MARKDOWN_WORKSPACE_PANE_VISIBILITY')) {
    throw new Error('Expected toolbar split pane fallback to reuse shared visibility defaults')
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
