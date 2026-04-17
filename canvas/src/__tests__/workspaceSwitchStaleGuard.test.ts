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

export const testMarkdownWorkspaceRuntimeQuickEditorAutoRestoreDoesNotMarkUserForcedDocument = () => {
  const runtimePath = path.resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readUtf8(runtimePath)
  if (!text.includes('const setContentModeFromUser = React.useCallback')) {
    throw new Error('Expected markdown workspace runtime to expose user-driven content mode setter')
  }
  if (!text.includes('const setContentModeAuto = React.useCallback')) {
    throw new Error('Expected markdown workspace runtime to expose auto content mode setter')
  }
  if (!text.includes("setContentModeAuto('document')")) {
    throw new Error('Expected unavailable quick editor fallback to use auto content mode setter')
  }
  if (!text.includes("setContentModeAuto('nodeQuickEditor')")) {
    throw new Error('Expected quick editor re-availability restore to use auto content mode setter')
  }
  if (!text.includes('setContentMode={setContentModeFromUser}')) {
    throw new Error('Expected markdown workspace UI actions to use user-driven content mode setter')
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
