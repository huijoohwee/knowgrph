import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/storyboardWidget/richMediaPanelConfig'
import { buildRichMediaPanelOverlayState, buildRichMediaPanelPreviewSpec, listDisplayRichMediaOverlayNodes } from '@/lib/render/richMediaSsot'

export function testRichMediaPanelOverlayStateRecognizesGenericStoryboardMediaFields() {
  const genericStoryboardVideoNode = {
    id: 'storyboard-generic-video-panel',
    type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
    properties: {
      mediaKind: 'video',
      mediaUrl: 'https://example.com/storyboard-drop.mp4',
    },
  } as const

  const genericStoryboardVideoPanel = buildRichMediaPanelOverlayState({ node: genericStoryboardVideoNode as never })
  if (!genericStoryboardVideoPanel || genericStoryboardVideoPanel.hasVideo !== true || genericStoryboardVideoPanel.hasImage !== false) {
    throw new Error(`expected Rich Media panel state to recognize storyboard generic video media fields, got ${JSON.stringify(genericStoryboardVideoPanel)}`)
  }

  const genericStoryboardVideoPreview = buildRichMediaPanelPreviewSpec({
    node: genericStoryboardVideoNode as never,
    panel: genericStoryboardVideoPanel,
  })
  if (!genericStoryboardVideoPreview || genericStoryboardVideoPreview.kind !== 'video' || genericStoryboardVideoPreview.url !== 'https://example.com/storyboard-drop.mp4') {
    throw new Error(`expected Rich Media panel preview SSOT to preserve storyboard generic video media fields, got ${JSON.stringify(genericStoryboardVideoPreview)}`)
  }

  const storyboardOverlays = listDisplayRichMediaOverlayNodes({
    renderMediaAsNodes: false,
    canvasRenderMode: '2d',
    canvas2dRenderer: 'storyboard',
    frontmatterModeEnabled: false,
    documentSemanticMode: 'document',
    nodes: [genericStoryboardVideoNode as never],
    poolMax: 24,
  })
  if (storyboardOverlays.length !== 1 || storyboardOverlays[0]?.id !== genericStoryboardVideoNode.id) {
    throw new Error(`expected Storyboard shared StoryboardWidget surface to render dropped Rich Media Panel overlays, got ${JSON.stringify(storyboardOverlays)}`)
  }
}
