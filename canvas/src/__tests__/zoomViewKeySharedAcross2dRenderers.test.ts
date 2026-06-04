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
  const gitGraphKey = buildZoomViewKey({ ...base, canvas2dRenderer: 'gitGraph' })

  if (!d3Key || !flowKey || !editorKey || !designKey || !gitGraphKey) throw new Error('Expected zoom keys to be non-empty')
  if (d3Key === flowKey || d3Key === editorKey || d3Key === designKey || d3Key === gitGraphKey) {
    throw new Error('Expected D3 and other 2D renderers to have isolated zoom view keys')
  }
  if (gitGraphKey === flowKey || gitGraphKey === editorKey || gitGraphKey === designKey) {
    throw new Error('Expected 2D renderers to have isolated zoom view keys')
  }
}
