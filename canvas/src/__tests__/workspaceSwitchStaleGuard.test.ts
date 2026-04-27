import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

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
  if (!text.includes('if (!matchesMarkdownDocumentPath(docKey, markdownName)) return')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to reuse shared markdown document path matching')
  }
  if (!text.includes('const hasUnsavedUserEdit = !!(')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to guard against unsaved user edits')
  }
  if (!text.includes('patchWorkspaceEntryInlineText(activePath, nextText)')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to refresh workspace entry inline text')
  }
  if (!text.includes('setActiveTextProgrammatic(nextText)')) {
    throw new Error('Expected markdown workspace runtime graph writeback sync to refresh active editor text programmatically')
  }
}
