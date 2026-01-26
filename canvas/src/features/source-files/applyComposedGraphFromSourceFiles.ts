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

