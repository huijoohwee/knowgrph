import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'
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
import { resolvePreferredEnabledComposedSourceFileFromState } from '@/features/source-files/composedSourceSelection'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashSignatureParts } from '@/lib/hash/signature'
import { getSourceFileTextHash } from '@/features/source-files/sourceFilesSignatures'

let pendingComposeRaf: number | null = null
let pendingComposeAfterWorkspaceOverlayClose = false
let workspaceOverlayComposeRetryUnsubscribe: (() => void) | null = null
let lastAppliedComposedImportModesSignature = ''

function ensureWorkspaceOverlayComposeRetrySubscription() {
  if (workspaceOverlayComposeRetryUnsubscribe) return
  workspaceOverlayComposeRetryUnsubscribe = useGraphStore.subscribe(
    s => [s.workspaceViewMode, s.workspaceCanvasPaneOpen] as const,
    ([workspaceViewMode, workspaceCanvasPaneOpen], previous) => {
      const workspaceOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })
      const previousOverlayOpen = Array.isArray(previous)
        ? isWorkspaceEditorOverlayOpen({ workspaceViewMode: previous[0], workspaceCanvasPaneOpen: previous[1] })
        : workspaceOverlayOpen
      if (!pendingComposeAfterWorkspaceOverlayClose || workspaceOverlayOpen || !previousOverlayOpen) return
      pendingComposeAfterWorkspaceOverlayClose = false
      scheduleApplyComposedGraphFromSourceFiles()
    },
  )
}

function buildComposedImportModesSignature(args: {
  state: ReturnType<typeof useGraphStore.getState>
  graphData: ReturnType<typeof composeGraphFromSourceLayers>['graphData']
  explorerActivePath: string | null
}): {
  signature: string
  rawText: string
} {
  const preferredSourceFile = resolvePreferredEnabledComposedSourceFileFromState({
    state: args.state,
    explorerActivePath: args.explorerActivePath,
  })
  const preferredSourcePath = String(preferredSourceFile?.source?.path || preferredSourceFile?.name || '').trim()
  const preferredSourceText = String(preferredSourceFile?.text || '')
  const preferredSourceTextHash = String(preferredSourceFile?.parsedTextHash || '').trim()
    || (preferredSourceFile ? getSourceFileTextHash(preferredSourceFile) : '')
  const graphSemanticKey = buildScopedGraphSemanticKey('composed-import-modes', {
    graphData: args.graphData,
  })
  return {
    signature: hashSignatureParts([
      'composed-import-modes',
      graphSemanticKey,
      preferredSourcePath,
      preferredSourceTextHash,
    ]),
    rawText: preferredSourceText,
  }
}

function applyComposedSourceImportModes(graphData: ReturnType<typeof composeGraphFromSourceLayers>['graphData']) {
  try {
    const store = useGraphStore.getState()
    const explorerActivePath = useMarkdownExplorerStore.getState().activePath
    const { signature, rawText } = buildComposedImportModesSignature({
      state: store,
      graphData,
      explorerActivePath,
    })
    if (signature && lastAppliedComposedImportModesSignature === signature) return
    applyFrontmatterFlowImportModes(graphData)
    if (rawText) {
      applyCanvasFrontmatterPreset({ graphData, rawText })
    }
    lastAppliedComposedImportModesSignature = signature
  } catch {
    void 0
  }
}

function requestWorkspaceOpenFlowEditorFit(graphData: ReturnType<typeof composeGraphFromSourceLayers>['graphData']) {
  const kind = String(((graphData?.metadata || {}) as Record<string, unknown>)?.kind || '').trim()
  if (kind !== 'frontmatter-flow') return
  const st = useGraphStore.getState()
  if (!isWorkspaceEditorOverlayOpen(st)) return
  if (st.canvasRenderMode !== '2d' || st.canvas2dRenderer !== 'flowEditor') return
  st.requestZoom('fit', { intent: 'fitToView' })
}

export function scheduleApplyComposedGraphFromSourceFiles() {
  ensureWorkspaceOverlayComposeRetrySubscription()
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
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen(store)
  const hasEnabledSourceFiles = (store.sourceFiles || []).some(f => Boolean(f?.enabled))
  if (!hasEnabledSourceFiles) {
    lastAppliedComposedImportModesSignature = ''
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
    lastAppliedComposedImportModesSignature = ''
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
  if (change === 'unchanged') {
    const graphData = store.graphData
    const metadata =
      graphData?.metadata && typeof graphData.metadata === 'object'
        ? (graphData.metadata as Record<string, unknown>)
        : null
    if (graphData && String(metadata?.sourceLayerComposition || '') === 'compose') {
      applyComposedSourceImportModes(graphData)
    }
    return
  }
  if (String((store.graphData?.metadata as Record<string, unknown> | null)?.sourceLayerComposition || '') !== 'compose') {
    lastAppliedComposedImportModesSignature = ''
  }

  const { graphData } = composeGraphFromSourceLayers({ layers, precomputedKeys: { contentKey, orderKey } })
  if (
    resolveComposedApplyDeferralReason({
      layers,
      composedGraphData: graphData,
      previousGraphData: store.graphData,
      workspaceEditorOverlayOpen,
    })
  ) {
    if (workspaceEditorOverlayOpen) pendingComposeAfterWorkspaceOverlayClose = true
    return
  }

  pendingComposeAfterWorkspaceOverlayClose = false

  if (change === 'order-only') {
    store.setGraphDataPreservingLayout(graphData)
    applyComposedSourceImportModes(graphData)
    requestWorkspaceOpenFlowEditorFit(graphData)
    return
  }
  store.setGraphData(graphData)
  applyComposedSourceImportModes(graphData)
  requestWorkspaceOpenFlowEditorFit(graphData)
}
