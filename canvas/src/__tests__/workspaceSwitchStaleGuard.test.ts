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
  if (!text.includes('const isStaleJob = () =>')) {
    throw new Error('Expected markdown workspace runtime to define stale-index job guard')
  }
  if (!text.includes('if (isStaleJob()) return')) {
    throw new Error('Expected markdown workspace runtime to short-circuit stale jobs before mutating state')
  }
  if (!text.includes('await maybeAutoEnableGeospatialModeForGraphData') || !text.includes('if (isStaleJob()) return')) {
    throw new Error('Expected geospatial auto-enable path to be protected by stale-job guard')
  }
}

export const testMarkdownWorkspaceRuntimeWidgetAutoRestoreDoesNotMarkUserForcedDocument = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
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
  if (!text.includes("if (contentMode === 'widget' && widgetAvailable) return")) {
    throw new Error('Expected widget mode to skip markdown file re-indexing when widget content is the active SSOT')
  }
}

export const testMarkdownWorkspaceRuntimeWidgetBundleIncludesOpenWidgetSet = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readUtf8(runtimePath)
  if (!text.includes('const widgetNodeIds = React.useMemo(() => {')) {
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
  if (!interactionsText.includes("if (!workspaceCanvasPaneOpen || canvasWorkspaceSyncMode !== 'realtime' || contentMode === 'widget') return")) {
    throw new Error('Expected realtime editor->graph sync to explicitly gate by workspace pane, realtime mode, and widget mode')
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
