import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { buildCanvasViewOptions, getCanvasViewRendererOptions } from '@/components/toolbar/canvasViewMenu'
import { BLOCK_SCHEMA } from '@/__tests__/canvas3dMode.test'

export function testCanvasViewMinimapToggleUsesDisplayControlOption() {
  const displayControls = buildCanvasViewOptions(
    {
      canvas2dRenderer: 'flowEditor',
      canvas3dMode: '3d',
      canvasRenderMode: '2d',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: false,
      multiDimTableModeEnabled: false,
      renderMediaAsNodes: false,
      timelineEnabled: false,
      minimapCollapsed: false,
      geospatialEnabled: false,
      layoutMode: 'block',
      schema: BLOCK_SCHEMA,
      frontmatterOnlyAllowed: false,
      isD3Like2dLayoutToggle: false,
      voxelApplicable: true,
      voxelDisabledReason: null,
    },
    getCanvasViewRendererOptions(),
  ).find(option => option.id === 'control:menu')
  const minimapToggle = displayControls?.children?.find(child => child.id === 'control:minimap')
  if (!minimapToggle || minimapToggle.disabled || minimapToggle.isActive !== true || minimapToggle.children?.length) {
    throw new Error('Expected Flow Editor Display Controls to expose an active single-action Minimap toggle')
  }

  const calls: string[] = []
  const unexpectedViewMutations: string[] = []
  const markUnexpected = (name: string) => () => { unexpectedViewMutations.push(name) }
  applyCanvasViewSelection({
    id: 'control:minimap',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => { throw new Error('Expected Minimap toggle to avoid opening Geospatial Mode') },
    canvas2dRenderer: 'flowEditor',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    minimapCollapsed: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: markUnexpected('setBehavior') as any,
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
    setMinimapCollapsed: collapsed => calls.push(`minimap:${String(collapsed)}`),
    setDocumentSemanticMode: markUnexpected('setDocumentSemanticMode') as any,
    setFrontmatterModeEnabled: markUnexpected('setFrontmatterModeEnabled'),
    setMultiDimTableModeEnabled: markUnexpected('setMultiDimTableModeEnabled'),
  })
  if (calls.join('|') !== 'minimap:true') throw new Error(`Expected Minimap toggle to collapse the shared minimap, got ${calls.join('|')}`)
  if (unexpectedViewMutations.length > 0) throw new Error(`Expected Minimap toggle not to mutate Canvas View Mode setters, got ${unexpectedViewMutations.join(', ')}`)
}
