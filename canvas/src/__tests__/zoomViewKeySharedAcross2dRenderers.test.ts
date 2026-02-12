import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'

export const testZoomViewKeyIsIsolatedAcross2dRenderers = () => {
  const base = {
    canvasRenderMode: '2d',
    schemaLayoutEngineJson: '{"mode":"force"}',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    graphMetaKey: 'kind:source',
    renderMediaAsNodes: false,
    mediaPanelDensity: 'normal',
    collapsedGroupIdsKey: '',
  }

  const d3Key = buildZoomViewKey({ ...base, canvas2dRenderer: 'd3' })
  const flowKey = buildZoomViewKey({ ...base, canvas2dRenderer: 'flow' })
  const editorKey = buildZoomViewKey({ ...base, canvas2dRenderer: 'flowEditor' })

  if (!d3Key || !flowKey || !editorKey) throw new Error('Expected zoom keys to be non-empty')
  if (d3Key !== flowKey || d3Key !== editorKey) {
    throw new Error('Expected 2D renderers to share a zoom view key')
  }
}
