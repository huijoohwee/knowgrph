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
  const designKey = buildZoomViewKey({ ...base, canvas2dRenderer: 'design' })

  if (!d3Key || !flowKey || !editorKey || !designKey) throw new Error('Expected zoom keys to be non-empty')
  if (d3Key === flowKey || d3Key === editorKey || d3Key === designKey) {
    throw new Error('Expected 2D renderers to have isolated zoom view keys')
  }
}
