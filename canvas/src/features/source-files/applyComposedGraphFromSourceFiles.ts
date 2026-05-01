import { useGraphStore } from '@/hooks/useGraphStore'
import {
  buildSourceLayerKeys,
  composeGraphFromSourceLayers,
  resolveSourceLayerKeyChange,
} from '@/lib/graph/sourceLayers'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import {
  resolveComposedApplyDeferralReason,
  shouldClearComposedGraphForEmptyState,
} from '@/features/source-files/composedApplyGuards'
import { resolvePreferredComposedSourceRawTextFromState } from '@/features/source-files/composedSourceSelection'

let pendingComposeRaf: number | null = null

function applyComposedSourceImportModes(graphData: ReturnType<typeof composeGraphFromSourceLayers>['graphData']) {
  try {
    applyFrontmatterFlowImportModes(graphData)
  } catch {
    void 0
  }
  const store = useGraphStore.getState()
  const rawText = resolvePreferredComposedSourceRawTextFromState({
    state: store,
    explorerActivePath: useMarkdownExplorerStore.getState().activePath,
  })
  if (!rawText) return
  try {
    applyCanvasFrontmatterPreset({ graphData, rawText })
  } catch {
    void 0
  }
}

export function scheduleApplyComposedGraphFromSourceFiles() {
  if (pendingComposeRaf != null) return
  const w = typeof window !== 'undefined' ? window : null
  if (!w || typeof w.requestAnimationFrame !== 'function') {
    applyComposedGraphFromSourceFiles()
    return
  }
  pendingComposeRaf = w.requestAnimationFrame(() => {
    pendingComposeRaf = null
    applyComposedGraphFromSourceFiles()
  })
}

export function applyComposedGraphFromSourceFiles() {
  const store = useGraphStore.getState()
  const hasEnabledSourceFiles = (store.sourceFiles || []).some(f => Boolean(f?.enabled))
  if (!hasEnabledSourceFiles) {
    if (
      shouldClearComposedGraphForEmptyState({
        previousGraphData: store.graphData,
        hasEnabledSourceFiles,
        hasEnabledContent: false,
      })
    ) {
      store.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} })
    }
    return
  }
  const layers = (store.sourceFiles || []).map(f => ({
    id: f.id,
    name: f.name,
    enabled: Boolean(f.enabled),
    status: f.status,
    source: f.source,
    text: f.text,
    parsedTextHash: f.parsedTextHash,
    parsedGraphRevision: f.parsedGraphRevision,
    parsedGraphData: f.parsedGraphData,
  }))

  const hasEnabledContent = layers.some(layer => {
    if (!layer.enabled) return false
    if (layer.parsedGraphData) return true
    return Boolean(String(layer.text || '').trim())
  })
  if (!hasEnabledContent) {
    if (
      shouldClearComposedGraphForEmptyState({
        previousGraphData: store.graphData,
        hasEnabledSourceFiles,
        hasEnabledContent,
      })
    ) {
      store.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} })
    }
    return
  }

  const { contentKey, orderKey } = buildSourceLayerKeys(layers)
  const change = resolveSourceLayerKeyChange({
    previousGraphData: store.graphData,
    contentKey,
    orderKey,
  })
  if (change === 'unchanged') return

  const { graphData } = composeGraphFromSourceLayers({ layers, precomputedKeys: { contentKey, orderKey } })
  if (
    resolveComposedApplyDeferralReason({
      layers,
      composedGraphData: graphData,
      previousGraphData: store.graphData,
    })
  ) return

  if (change === 'order-only') {
    store.setGraphDataPreservingLayout(graphData)
    applyComposedSourceImportModes(graphData)
    return
  }
  store.setGraphData(graphData)
  applyComposedSourceImportModes(graphData)
}
