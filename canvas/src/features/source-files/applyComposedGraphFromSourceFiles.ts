import { useGraphStore } from '@/hooks/useGraphStore'
import { buildSourceLayerKeys, composeGraphFromSourceLayers } from '@/lib/graph/sourceLayers'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'
import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'

let pendingComposeRaf: number | null = null

function normalizeComposedSourcePath(rawPath: unknown): string {
  const text = String(rawPath || '').trim().replace(/\\/g, '/')
  if (!text) return ''
  const withoutWorkspacePrefix = text.startsWith('workspace:') ? text.slice('workspace:'.length) : text
  const normalized = normalizeWorkspacePath(withoutWorkspacePrefix)
  return normalized === '/' ? '' : normalized
}

function resolvePreferredComposedSourceRawText(): string {
  const store = useGraphStore.getState()
  const activePath =
    normalizeComposedSourcePath(store.markdownDocumentName) ||
    normalizeComposedSourcePath(useMarkdownExplorerStore.getState().activePath)
  const sourceFiles = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
  if (activePath) {
    const activeSourceFile = sourceFiles.find(file => {
      if (!file?.enabled) return false
      return normalizeComposedSourcePath(file.source?.path || file.name || '') === activePath
    })
    if (activeSourceFile && String(activeSourceFile.text || '').trim()) {
      return String(activeSourceFile.text || '')
    }
  }
  const firstEnabledSeed = sourceFiles.find(file => file?.enabled && String(file.text || '').trim())
  return firstEnabledSeed ? String(firstEnabledSeed.text || '') : ''
}

function applyComposedSourceImportModes(graphData: ReturnType<typeof composeGraphFromSourceLayers>['graphData']) {
  try {
    applyFrontmatterFlowImportModes(graphData)
  } catch {
    void 0
  }
  const rawText = resolvePreferredComposedSourceRawText()
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
  if (!hasEnabledSourceFiles) return
  const layers = (store.sourceFiles || []).map(f => ({
    id: f.id,
    name: f.name,
    enabled: Boolean(f.enabled),
    source: f.source,
    text: f.text,
    parsedTextHash: f.parsedTextHash,
    parsedGraphRevision: f.parsedGraphRevision,
    parsedGraphData: f.parsedGraphData,
  }))

  const prevMeta = (store.graphData?.metadata || {}) as Record<string, unknown>
  const prevContentKey = typeof prevMeta.sourceLayerHash === 'string' ? prevMeta.sourceLayerHash : ''
  const prevOrderKey = typeof prevMeta.sourceLayerOrderHash === 'string' ? prevMeta.sourceLayerOrderHash : ''

  const { contentKey, orderKey } = buildSourceLayerKeys(layers)
  if (prevContentKey === contentKey && prevOrderKey === orderKey) return

  const { graphData } = composeGraphFromSourceLayers({ layers, precomputedKeys: { contentKey, orderKey } })

  const composedHasContent = !!((graphData.nodes && graphData.nodes.length) || (graphData.edges && graphData.edges.length))
  const hasPendingEnabledRemoteSource = layers.some(layer => {
    if (!layer.enabled) return false
    const source = layer.source
    if (!source || source.kind !== 'url') return false
    if (String(source.url || '').trim() === '') return false
    if (String(layer.text || '').trim()) return false
    return !layer.parsedGraphData
  })
  const prevHasContent = !!(
    store.graphData &&
    ((store.graphData.nodes && store.graphData.nodes.length) || (store.graphData.edges && store.graphData.edges.length))
  )
  if (!composedHasContent && hasPendingEnabledRemoteSource) return
  if (!composedHasContent && prevHasContent) {
    const hasPendingEnabledText = layers.some(l => l.enabled && String(l.text || '').trim() && !l.parsedGraphData)
    const hasAnyParsedEnabled = layers.some(l => l.enabled && !!l.parsedGraphData)
    if (hasPendingEnabledText && !hasAnyParsedEnabled) return
  }

  if (prevContentKey === contentKey && prevOrderKey !== orderKey) {
    store.setGraphDataPreservingLayout(graphData)
    applyComposedSourceImportModes(graphData)
    return
  }
  store.setGraphData(graphData)
  applyComposedSourceImportModes(graphData)
}
