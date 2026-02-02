import { useGraphStore } from '@/hooks/useGraphStore'
import { composeGraphFromSourceLayers } from '@/lib/graph/sourceLayers'

export function applyComposedGraphFromSourceFiles() {
  const store = useGraphStore.getState()
  const layers = (store.sourceFiles || []).map(f => ({
    id: f.id,
    name: f.name,
    enabled: Boolean(f.enabled),
    source: f.source,
    text: f.text,
    parsedTextHash: f.parsedTextHash,
    parsedGraphData: f.parsedGraphData,
  }))
  const { graphData, contentKey, orderKey } = composeGraphFromSourceLayers({ layers })

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

  const prevMeta = (store.graphData?.metadata || {}) as Record<string, unknown>
  const prevContentKey = typeof prevMeta.sourceLayerHash === 'string' ? prevMeta.sourceLayerHash : ''
  const prevOrderKey = typeof prevMeta.sourceLayerOrderHash === 'string' ? prevMeta.sourceLayerOrderHash : ''
  if (prevContentKey === contentKey && prevOrderKey === orderKey) return
  if (prevContentKey === contentKey && prevOrderKey !== orderKey) {
    store.setGraphDataPreservingLayout(graphData)
    return
  }
  store.setGraphData(graphData)
}
