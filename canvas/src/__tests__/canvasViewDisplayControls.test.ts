import { readFileSync } from 'node:fs'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { buildCanvasViewOptions, getCanvasViewRendererOptions } from '@/components/toolbar/canvasViewMenu'
import { BLOCK_SCHEMA } from '@/__tests__/canvas3dMode.test'

export function testGridSnapDisplayControlsReuseSharedUtilityOwner() {
  const actionsSource = readFileSync(new URL('../components/toolbar/canvasViewActions.ts', import.meta.url), 'utf8')
  const menuSource = readFileSync(new URL('../components/toolbar/canvasViewMenu.ts', import.meta.url), 'utf8')
  const sharedSource = readFileSync(new URL('../lib/canvas/canvasGridDisplayControls.ts', import.meta.url), 'utf8')
  for (const snippet of [
    'buildCanvasGridVisibilityBehaviorPatch',
    'buildSnapGridBehaviorPatch',
    'CANVAS_GRID_DISPLAY_CONTROL_ID',
    'SNAP_GRID_DISPLAY_CONTROL_ID',
  ]) {
    if (!actionsSource.includes(snippet)) {
      throw new Error(`expected Canvas View actions to reuse shared Grid/Snap utility snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    'CANVAS_GRID_DISPLAY_CONTROL_DESCRIPTION',
    'CANVAS_GRID_DISPLAY_CONTROL_LABEL',
    'CANVAS_GRID_DISPLAY_CONTROL_TITLE',
    'SNAP_GRID_DISPLAY_CONTROL_DESCRIPTION',
    'SNAP_GRID_DISPLAY_CONTROL_LABEL',
    'SNAP_GRID_DISPLAY_CONTROL_TITLE',
    'readCanvasGridDisplayControlActive',
    'readSnapGridDisplayControlActive',
  ]) {
    if (!menuSource.includes(snippet)) {
      throw new Error(`expected Canvas View menu to reuse shared Grid/Snap utility snippet: ${snippet}`)
    }
  }
  for (const snippet of [
    "CANVAS_GRID_DISPLAY_CONTROL_ID = 'control:grid'",
    "SNAP_GRID_DISPLAY_CONTROL_ID = 'control:snapGrid'",
    "CANVAS_GRID_DISPLAY_CONTROL_TITLE = 'Grid'",
    "SNAP_GRID_DISPLAY_CONTROL_TITLE = 'Snap to Grid'",
    'buildCanvasGridVisibilityBehaviorPatch',
    'buildSnapGridBehaviorPatch',
  ]) {
    if (!sharedSource.includes(snippet)) {
      throw new Error(`expected shared Grid/Snap utility owner to define snippet: ${snippet}`)
    }
  }
  for (const forbidden of [
    'const buildVisibleCanvasGridBehavior',
    'const readSnapGridSizeForBehaviorPatch',
    'SNAP_GRID_SIZE_DEFAULT',
    'coerceSnapGridTuple',
  ]) {
    if (actionsSource.includes(forbidden)) {
      throw new Error(`expected Canvas View actions to avoid local Grid/Snap helper ownership: ${forbidden}`)
    }
  }
  for (const forbidden of [
    "title: 'Snap to Grid'",
    "description: 'Show canvas grid'",
    "description: 'Align drag and keyboard movement to grid'",
    'state.schema.behavior?.canvasGrid?.enabled === true',
    'state.schema.behavior?.snapGrid?.enabled === true',
  ]) {
    if (menuSource.includes(forbidden)) {
      throw new Error(`expected Canvas View menu to avoid local Grid/Snap metadata or active-state ownership: ${forbidden}`)
    }
  }
}

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
      bottomSurfaceCollapsed: true,
      bottomSurfaceTab: 'stats',
      minimapCollapsed: false,
      geospatialEnabled: false,
      layoutMode: 'block',
      schema: BLOCK_SCHEMA,
      frontmatterOnlyAllowed: false,
      isD3Like2dLayoutToggle: false,
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
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    minimapCollapsed: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: markUnexpected('setBehavior') as any,
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
    setBottomSurfaceCollapsed: markUnexpected('setBottomSurfaceCollapsed'),
    setBottomSurfaceTab: markUnexpected('setBottomSurfaceTab') as any,
    setMinimapCollapsed: collapsed => calls.push(`minimap:${String(collapsed)}`),
    setDocumentSemanticMode: markUnexpected('setDocumentSemanticMode') as any,
    setFrontmatterModeEnabled: markUnexpected('setFrontmatterModeEnabled'),
    setMultiDimTableModeEnabled: markUnexpected('setMultiDimTableModeEnabled'),
  })
  if (calls.join('|') !== 'minimap:true') throw new Error(`Expected Minimap toggle to collapse the shared minimap, got ${calls.join('|')}`)
  if (unexpectedViewMutations.length > 0) throw new Error(`Expected Minimap toggle not to mutate Canvas View Mode setters, got ${unexpectedViewMutations.join(', ')}`)
}

export function testDashboardRendererGridToggleUsesSharedDisplayControl() {
  const displayControls = buildCanvasViewOptions(
    {
      canvas2dRenderer: 'dashboard',
      canvas3dMode: '3d',
      canvasRenderMode: '2d',
      documentSemanticMode: 'document',
      frontmatterModeEnabled: false,
      multiDimTableModeEnabled: false,
      renderMediaAsNodes: false,
      timelineEnabled: false,
      bottomSurfaceCollapsed: true,
      bottomSurfaceTab: 'stats',
      minimapCollapsed: false,
      geospatialEnabled: false,
      layoutMode: 'block',
      schema: BLOCK_SCHEMA,
      frontmatterOnlyAllowed: false,
      isD3Like2dLayoutToggle: false,
    },
    getCanvasViewRendererOptions(),
  ).find(option => option.id === 'control:menu')
  const gridToggle = displayControls?.children?.find(child => child.id === 'control:grid')
  const snapGridToggle = displayControls?.children?.find(child => child.id === 'control:snapGrid')
  const minimapToggle = displayControls?.children?.find(child => child.id === 'control:minimap')
  if (!gridToggle || gridToggle.disabled || gridToggle.isActive === true || gridToggle.children?.length) {
    throw new Error('Expected Dashboard Display Controls to expose Grid as an inactive single-action toggle')
  }
  if (!snapGridToggle || snapGridToggle.disabled || snapGridToggle.isActive === true || snapGridToggle.children?.length || snapGridToggle.title !== 'Snap to Grid') {
    throw new Error('Expected Dashboard Display Controls to expose Snap to Grid as an inactive single-action toggle')
  }
  if (!minimapToggle?.disabled) {
    throw new Error('Expected Dashboard renderer to avoid enabling the D3 minimap path')
  }

  const unexpectedViewMutations: string[] = []
  const markUnexpected = (name: string) => () => { unexpectedViewMutations.push(name) }
  let nextBehavior: any = null
  applyCanvasViewSelection({
    id: 'control:grid',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => { throw new Error('Expected Grid toggle to avoid opening Geospatial Mode') },
    canvas2dRenderer: 'dashboard',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    minimapCollapsed: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: behavior => { nextBehavior = behavior },
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
    setBottomSurfaceCollapsed: markUnexpected('setBottomSurfaceCollapsed'),
    setBottomSurfaceTab: markUnexpected('setBottomSurfaceTab') as any,
    setMinimapCollapsed: markUnexpected('setMinimapCollapsed'),
    setDocumentSemanticMode: markUnexpected('setDocumentSemanticMode') as any,
    setFrontmatterModeEnabled: markUnexpected('setFrontmatterModeEnabled'),
    setMultiDimTableModeEnabled: markUnexpected('setMultiDimTableModeEnabled'),
  })
  if (nextBehavior?.snapGrid || nextBehavior?.canvasGrid?.enabled !== true) {
    throw new Error(`Expected Dashboard Grid toggle to write only shared canvasGrid behavior, got ${JSON.stringify(nextBehavior)}`)
  }
  if (unexpectedViewMutations.length > 0) {
    throw new Error(`Expected Dashboard Grid toggle not to mutate renderer or surface setters, got ${unexpectedViewMutations.join(', ')}`)
  }
  nextBehavior = null
  applyCanvasViewSelection({
    id: 'control:snapGrid',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => { throw new Error('Expected Snap to Grid toggle to avoid opening Geospatial Mode') },
    canvas2dRenderer: 'dashboard',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    minimapCollapsed: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: behavior => { nextBehavior = behavior },
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
    setBottomSurfaceCollapsed: markUnexpected('setBottomSurfaceCollapsed'),
    setBottomSurfaceTab: markUnexpected('setBottomSurfaceTab') as any,
    setMinimapCollapsed: markUnexpected('setMinimapCollapsed'),
    setDocumentSemanticMode: markUnexpected('setDocumentSemanticMode') as any,
    setFrontmatterModeEnabled: markUnexpected('setFrontmatterModeEnabled'),
    setMultiDimTableModeEnabled: markUnexpected('setMultiDimTableModeEnabled'),
  })
  if (nextBehavior?.snapGrid?.enabled !== true || nextBehavior?.canvasGrid) {
    throw new Error(`Expected Dashboard Snap to Grid toggle to write only shared snapGrid behavior, got ${JSON.stringify(nextBehavior)}`)
  }
  if (unexpectedViewMutations.length > 0) {
    throw new Error(`Expected Dashboard Grid/Snap toggles not to mutate renderer or surface setters, got ${unexpectedViewMutations.join(', ')}`)
  }
}
