import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'

export const testZoomViewKeyIncludesPresentationKeys = () => {
  const base = {
    canvasRenderMode: '2d',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    graphMetaKey: 'markdown:local',
    renderMediaAsNodes: false,
    mediaPanelDensity: 'normal',
    collapsedGroupIdsKey: '',
    schemaNodesPresentationJson: '{"nodeShapes":{"Image":"rect"}}',
    schemaGroupsPresentationJson: '{"groups":{"enabled":true}}',
  }

  const k1 = buildZoomViewKey(base)
  const k2 = buildZoomViewKey({ ...base, schemaNodesPresentationJson: '{"nodeShapes":{"Image":"circle"}}' })
  if (k1 === k2) throw new Error('expected zoom view key to change when nodes presentation changes')

  const k3 = buildZoomViewKey({ ...base, schemaGroupsPresentationJson: '{"groups":{"enabled":false}}' })
  if (k1 === k3) throw new Error('expected zoom view key to change when groups presentation changes')
}
