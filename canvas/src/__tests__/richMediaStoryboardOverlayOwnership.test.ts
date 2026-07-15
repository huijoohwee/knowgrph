import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/storyboardWidget/richMediaPanelConfig'
import { listDisplayRichMediaOverlayNodes } from '@/lib/render/richMediaSsot'

export function testStoryboardFlowCanvasOverlayKeepsOnlyRichMediaPanels() {
  const imageNode = {
    id: 'img-1',
    type: 'image',
    properties: { imageUrl: 'https://example.com/demo.png' },
  } as any
  const storyboardPanelNode = {
    id: 'storyboard-panel-1',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    properties: { imageUrl: 'https://example.com/demo.png' },
  } as any
  const commonOptions = {
    renderMediaAsNodes: false,
    canvas2dRenderer: 'storyboard' as const,
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document' as const,
    poolMax: 24,
  }
  if (listDisplayRichMediaOverlayNodes({ ...commonOptions, nodes: [imageNode] }).length !== 0) {
    throw new Error('expected Storyboard Cards to own source media instead of entering the FlowCanvas Rich Media overlay pool')
  }
  const overlays = listDisplayRichMediaOverlayNodes({ ...commonOptions, nodes: [imageNode, storyboardPanelNode] })
  if (overlays.length !== 1 || overlays[0]?.id !== storyboardPanelNode.id) {
    throw new Error(`expected Storyboard FlowCanvas overlays to retain only Rich Media Panels, got ${JSON.stringify(overlays)}`)
  }
}
