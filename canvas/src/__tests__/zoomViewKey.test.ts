import { buildZoomViewKey } from '@/components/GraphCanvas/zoomViewKey'

export const testZoomViewKeyChangesOnCollapsedGroups = () => {
  const base = {
    canvasRenderMode: '2d',
    schemaLayoutEngineJson: '{"layout":{"mode":"force"}}',
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    graphMetaKey: 'markdown:local',
    renderMediaAsNodes: false,
    mediaPanelDensity: 'normal',
    collapsedGroupIdsKey: '',
  }

  const k1 = buildZoomViewKey(base)
  const k2 = buildZoomViewKey({ ...base, collapsedGroupIdsKey: 'community:0' })
  if (k1 === k2) throw new Error('expected zoom view key to change when collapsed groups change')
}
