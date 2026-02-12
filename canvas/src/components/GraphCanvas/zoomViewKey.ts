export function buildZoomViewKey(args: {
  canvasRenderMode: string
  canvas2dRenderer?: string
  schemaLayoutEngineJson: string
  frontmatterModeEnabled: boolean
  documentSemanticMode: string
  graphMetaKey: string
  renderMediaAsNodes: boolean
  mediaPanelDensity: string
  collapsedGroupIdsKey: string
}): string {
  return [
    String(args.canvasRenderMode),
    String(args.schemaLayoutEngineJson),
    String(args.frontmatterModeEnabled ? 1 : 0),
    String(args.documentSemanticMode),
    String(args.graphMetaKey),
    String(args.renderMediaAsNodes ? 1 : 0),
    String(args.mediaPanelDensity),
    String(args.collapsedGroupIdsKey),
  ].join('|')
}
