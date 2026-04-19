import { useGraphStore } from '@/hooks/useGraphStore'
import { buildSourceLayerKeys, composeGraphFromSourceLayers } from '@/lib/graph/sourceLayers'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { applyFrontmatterFlowImportModes } from '@/features/parsers/frontmatterFlowImportMode'

let pendingComposeRaf: number | null = null

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
  if (isFrontmatterOnlyPolicyActive({ canvasRenderMode: store.canvasRenderMode, canvas2dRenderer: store.canvas2dRenderer })) return
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
  const prevHasContent = !!(
    store.graphData &&
    ((store.graphData.nodes && store.graphData.nodes.length) || (store.graphData.edges && store.graphData.edges.length))
  )
  if (!composedHasContent && prevHasContent) {
    const hasPendingEnabledText = layers.some(l => l.enabled && String(l.text || '').trim() && !l.parsedGraphData)
    const hasAnyParsedEnabled = layers.some(l => l.enabled && !!l.parsedGraphData)
    if (hasPendingEnabledText && !hasAnyParsedEnabled) return
  }

  if (prevContentKey === contentKey && prevOrderKey !== orderKey) {
    store.setGraphDataPreservingLayout(graphData)
    applyFrontmatterFlowImportModes(graphData)
    return
  }
  store.setGraphData(graphData)
  applyFrontmatterFlowImportModes(graphData)
}
