import { readFileSync } from 'node:fs'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { buildFlowCanvasLayoutSchemaSignature } from '@/components/FlowCanvas/useFlowCanvasLayoutState'
import { drawInfiniteGridInWorldContext } from '@/lib/canvas/infiniteGrid'
import { readCanvasGridRenderConfigFromSchema } from '@/lib/canvas/canvasGridConfig'
import {
  CANVAS_GRID_DISPLAY_CONTROL_DESCRIPTION,
  CANVAS_GRID_DISPLAY_CONTROL_ID,
  CANVAS_GRID_DISPLAY_CONTROL_LABEL,
  CANVAS_GRID_DISPLAY_CONTROL_TITLE,
  SNAP_GRID_DISPLAY_CONTROL_DESCRIPTION,
  SNAP_GRID_DISPLAY_CONTROL_ID,
  SNAP_GRID_DISPLAY_CONTROL_LABEL,
  SNAP_GRID_DISPLAY_CONTROL_TITLE,
  buildCanvasGridVisibilityBehaviorPatch,
  buildSnapGridBehaviorPatch,
  readCanvasGridDisplayControlActive,
  readSnapGridDisplayControlActive,
} from '@/lib/canvas/canvasGridDisplayControls'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'

type FakeCanvasContext = {
  globalAlpha: number
  strokeStyle: string
  fillStyle: string
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  arcCalls: number
  fillCalls: number
  strokeCalls: number
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>
  arcs: Array<{ x: number; y: number; radius: number }>
  currentMove: { x: number; y: number } | null
  save: () => void
  restore: () => void
  beginPath: () => void
  moveTo: (_x: number, _y: number) => void
  lineTo: (_x: number, _y: number) => void
  arc: (_x: number, _y: number, _radius: number, _startAngle: number, _endAngle: number) => void
  fill: () => void
  stroke: () => void
}

const createFakeContext = (): FakeCanvasContext => {
  return {
    globalAlpha: 1,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    arcCalls: 0,
    fillCalls: 0,
    strokeCalls: 0,
    lines: [],
    arcs: [],
    currentMove: null,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo(x, y) {
      this.currentMove = { x, y }
    },
    lineTo(x, y) {
      if (this.currentMove) this.lines.push({ x1: this.currentMove.x, y1: this.currentMove.y, x2: x, y2: y })
    },
    arc(x, y, radius) {
      this.arcCalls += 1
      this.arcs.push({ x, y, radius })
    },
    fill() {
      this.fillCalls += 1
    },
    stroke() {
      this.strokeCalls += 1
    },
  }
}

export function testLockedCanvasGridDrawsLinesWhenZoomedOut() {
  const ctx = createFakeContext()
  drawInfiniteGridInWorldContext(ctx as unknown as CanvasRenderingContext2D, {
    enabled: true,
    gridSize: 10,
    viewportW: 800,
    viewportH: 600,
    dpr: 2,
    transform: { k: 0.5, x: 0, y: 0 },
    lockToBaseStep: true,
    anchor: 'cellCenter',
    paint: {
      variant: 'lines',
      minorStroke: '#111827',
      majorStroke: '#111827',
    },
  })
  if (ctx.strokeCalls <= 0) {
    throw new Error('expected locked line grid to draw visible snap-aligned layers at 0.5x zoom')
  }
}

export function testLockedCanvasGridDrawsLinesWhenFitZoomMakesBaseStepSubPixel() {
  const ctx = createFakeContext()
  drawInfiniteGridInWorldContext(ctx as unknown as CanvasRenderingContext2D, {
    enabled: true,
    gridSize: 10,
    viewportW: 1440,
    viewportH: 900,
    dpr: 1,
    transform: { k: 0.05, x: 0, y: 0 },
    lockToBaseStep: true,
    anchor: 'cellCenter',
    paint: {
      variant: 'lines',
      minorStroke: '#111827',
      majorStroke: '#111827',
    },
  })
  if (ctx.strokeCalls <= 0) {
    throw new Error('expected locked line grid to draw when fit-to-view zoom makes the base step subpixel')
  }
}

export function testLockedCanvasGridDrawsDotsWhenZoomedOut() {
  const ctx = createFakeContext()
  drawInfiniteGridInWorldContext(ctx as unknown as CanvasRenderingContext2D, {
    enabled: true,
    gridSize: 10,
    viewportW: 800,
    viewportH: 600,
    dpr: 2,
    transform: { k: 0.5, x: 0, y: 0 },
    lockToBaseStep: true,
    anchor: 'cellCenter',
    paint: {
      variant: 'dots',
      minorStroke: '#111827',
      majorStroke: '#111827',
    },
  })
  if (ctx.fillCalls <= 0 || ctx.arcCalls <= 0) {
    throw new Error('expected locked dot grid to draw visible snap-aligned dots at 0.5x zoom')
  }
}

export function testCanvasGridDefaultsAreVisibleHighFidelityLines() {
  const config = readCanvasGridRenderConfigFromSchema({
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      canvasGrid: { enabled: true },
    },
  })
  if (!config) throw new Error('expected enabled canvas grid render config')
  if (config.variant !== 'lines') throw new Error(`expected line grid default, got ${config.variant}`)
  if (config.minorAlpha < 0.16 || config.majorAlpha < 0.34) {
    throw new Error(`expected visible alpha defaults, got ${config.minorAlpha}/${config.majorAlpha}`)
  }
  if (config.majorWidthPx <= config.minorWidthPx) {
    throw new Error(`expected major grid width to exceed minor width, got ${config.minorWidthPx}/${config.majorWidthPx}`)
  }
}

export function testCanvasGridRenderConfigAlignsToSnapGridTupleAxes() {
  const config = readCanvasGridRenderConfigFromSchema({
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      snapGrid: { enabled: false, size: [20, 50] },
      canvasGrid: { enabled: true, variant: 'lines', majorEvery: 5 },
    },
  })
  if (!config) throw new Error('expected enabled canvas grid render config')
  if (config.anchor !== 'gridLine') {
    throw new Error(`expected 2D canvas grid to align to snap grid lines, got anchor ${config.anchor}`)
  }
  if (config.size !== 20 || config.sizeX !== 20 || config.sizeY !== 50) {
    throw new Error(`expected grid render config to preserve tuple axes 20x50, got size=${config.size} sizeX=${config.sizeX} sizeY=${config.sizeY}`)
  }
}

export function testLineGridUsesSharedAnchorAndIndependentAxisSteps() {
  const ctx = createFakeContext()
  drawInfiniteGridInWorldContext(ctx as unknown as CanvasRenderingContext2D, {
    enabled: true,
    gridSize: 20,
    gridSizeY: 50,
    viewportW: 61,
    viewportH: 151,
    dpr: 1,
    transform: { k: 1, x: 0, y: 0 },
    lockToBaseStep: true,
    anchor: 'gridLine',
    paint: {
      variant: 'lines',
      minorStroke: '#111827',
      majorStroke: '#111827',
      minMinorStepPx: 2,
      minMajorStepPx: 999_999,
    },
  })
  const vertical = Array.from(new Set(ctx.lines.filter(line => line.x1 === line.x2).map(line => line.x1))).sort((a, b) => a - b)
  const horizontal = Array.from(new Set(ctx.lines.filter(line => line.y1 === line.y2).map(line => line.y1))).sort((a, b) => a - b)
  if (vertical.slice(0, 4).join(',') !== '0,20,40,60') {
    throw new Error(`expected line grid vertical axes to use x step 20, got ${vertical.join(',')}`)
  }
  if (horizontal.slice(0, 4).join(',') !== '0,50,100,150') {
    throw new Error(`expected line grid horizontal axes to use y step 50, got ${horizontal.join(',')}`)
  }

  const centered = createFakeContext()
  drawInfiniteGridInWorldContext(centered as unknown as CanvasRenderingContext2D, {
    enabled: true,
    gridSize: 10,
    gridSizeY: 20,
    viewportW: 31,
    viewportH: 61,
    dpr: 1,
    transform: { k: 1, x: 0, y: 0 },
    lockToBaseStep: true,
    anchor: 'cellCenter',
    paint: {
      variant: 'lines',
      minorStroke: '#111827',
      majorStroke: '#111827',
      minMinorStepPx: 2,
      minMajorStepPx: 999_999,
    },
  })
  const centeredVertical = Array.from(new Set(centered.lines.filter(line => line.x1 === line.x2).map(line => line.x1))).sort((a, b) => a - b)
  const centeredHorizontal = Array.from(new Set(centered.lines.filter(line => line.y1 === line.y2).map(line => line.y1))).sort((a, b) => a - b)
  if (centeredVertical.filter(value => value >= 0).slice(0, 4).join(',') !== '5,15,25,35') {
    throw new Error(`expected cell-center line grid vertical axes to honor x offset, got ${centeredVertical.join(',')}`)
  }
  if (centeredHorizontal.filter(value => value >= 0).slice(0, 4).join(',') !== '10,30,50,70') {
    throw new Error(`expected cell-center line grid horizontal axes to honor y offset, got ${centeredHorizontal.join(',')}`)
  }
}

export function testCanvasGridOverlaySurfaceOwnsRendererGridLayerProps() {
  const overlaySurfaceSource = readFileSync(new URL('../components/CanvasGridOverlaySurface.tsx', import.meta.url), 'utf8')
  for (const snippet of [
    'InfiniteGridCanvasOverlay',
    'CanvasGridRenderConfig',
    'data-kg-canvas-grid-overlay-surface',
    'data-kg-canvas-grid-anchor',
    'data-kg-canvas-grid-size-x',
    'data-kg-canvas-grid-size-y',
    'const gridSizeX = canvasGrid.sizeX || canvasGrid.size || 10',
    'const gridSizeY = canvasGrid.sizeY || canvasGrid.sizeX || canvasGrid.size || 10',
    'gridSize={gridSizeX}',
    'gridSizeY={gridSizeY}',
    'getEventTarget={props.getEventTarget}',
  ]) {
    if (!overlaySurfaceSource.includes(snippet)) {
      throw new Error(`expected shared canvas grid overlay surface to own snippet: ${snippet}`)
    }
  }

  const rendererSources = [
    {
      name: 'd3',
      surfaceId: 'surfaceId="d3"',
      source: readFileSync(new URL('../components/GraphCanvasRoot/GraphCanvasRootImpl.tsx', import.meta.url), 'utf8'),
    },
    {
      name: 'design',
      surfaceId: 'surfaceId="design"',
      source: readFileSync(new URL('../components/DesignCanvas/DesignCanvasRenderShell.tsx', import.meta.url), 'utf8'),
    },
    {
      name: 'dashboard',
      surfaceId: 'surfaceId="dashboard"',
      source: readFileSync(new URL('../components/DashboardCanvas/index.tsx', import.meta.url), 'utf8'),
    },
  ]
  for (const renderer of rendererSources) {
    if (!renderer.source.includes('CanvasGridOverlaySurface')) {
      throw new Error(`expected ${renderer.name} renderer to reuse CanvasGridOverlaySurface`)
    }
    if (!renderer.source.includes(renderer.surfaceId)) {
      throw new Error(`expected ${renderer.name} renderer to mark its shared canvas grid surface`)
    }
    if (renderer.source.includes('<InfiniteGridCanvasOverlay')) {
      throw new Error(`expected ${renderer.name} renderer not to duplicate InfiniteGridCanvasOverlay props`)
    }
    if (renderer.source.includes('gridSize={canvasGrid?.size || 10}')) {
      throw new Error(`expected ${renderer.name} renderer not to duplicate canvasGrid prop fanout`)
    }
  }
}

export function testSharedCanvasGridDisplayControlHelpersBuildIndependentPatches() {
  const schema: GraphSchema = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      snapGrid: { enabled: false, size: [20, 40] },
      canvasGrid: { enabled: false, variant: 'dots', majorEvery: 5, dotRadiusPx: 1 },
    },
  }
  if (
    CANVAS_GRID_DISPLAY_CONTROL_ID !== 'control:grid' ||
    CANVAS_GRID_DISPLAY_CONTROL_TITLE !== 'Grid' ||
    CANVAS_GRID_DISPLAY_CONTROL_LABEL !== 'Grid' ||
    CANVAS_GRID_DISPLAY_CONTROL_DESCRIPTION !== 'Show canvas grid'
  ) {
    throw new Error('expected shared Grid control metadata to stay stable')
  }
  if (
    SNAP_GRID_DISPLAY_CONTROL_ID !== 'control:snapGrid' ||
    SNAP_GRID_DISPLAY_CONTROL_TITLE !== 'Snap to Grid' ||
    SNAP_GRID_DISPLAY_CONTROL_LABEL !== 'Snap' ||
    SNAP_GRID_DISPLAY_CONTROL_DESCRIPTION !== 'Align drag and keyboard movement to grid'
  ) {
    throw new Error('expected shared Snap to Grid control metadata to stay stable')
  }
  if (readCanvasGridDisplayControlActive(schema) || readSnapGridDisplayControlActive(schema)) {
    throw new Error('expected shared Grid/Snap active readers to reflect disabled schema state')
  }
  const gridPatch = buildCanvasGridVisibilityBehaviorPatch(schema)
  if (Object.prototype.hasOwnProperty.call(gridPatch, 'snapGrid')) {
    throw new Error('expected shared Grid patch to avoid mutating snapGrid')
  }
  const patchedGridSchema: GraphSchema = {
    ...schema,
    behavior: {
      ...schema.behavior,
      ...gridPatch,
    },
  }
  if (!readCanvasGridDisplayControlActive(patchedGridSchema) || readSnapGridDisplayControlActive(patchedGridSchema)) {
    throw new Error('expected shared Grid patch to enable canvasGrid without enabling snapGrid')
  }
  const snapPatch = buildSnapGridBehaviorPatch(schema)
  if (Object.prototype.hasOwnProperty.call(snapPatch, 'canvasGrid')) {
    throw new Error('expected shared Snap to Grid patch to avoid mutating canvasGrid')
  }
  const snapGrid = snapPatch.snapGrid as { enabled?: boolean; size?: unknown } | undefined
  if (!snapGrid?.enabled || !Array.isArray(snapGrid.size) || snapGrid.size[0] !== 20 || snapGrid.size[1] !== 40) {
    throw new Error('expected shared Snap to Grid patch to preserve tuple size while enabling snapping')
  }
}

export function testToolbarGridToggleSeedsFullCanvasGridVisualConfig() {
  const legacySchema: GraphSchema = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      snapGrid: { enabled: false, size: [20, 40] },
      canvasGrid: { enabled: false, variant: 'dots', majorEvery: 5, dotRadiusPx: 1 },
    },
  }
  let nextBehavior: Partial<GraphSchema['behavior']> | null = null
  const unexpectedViewMutations: string[] = []
  const noop = () => undefined
  const markUnexpected = (name: string) => () => {
    unexpectedViewMutations.push(name)
  }
  applyCanvasViewSelection({
    id: 'control:grid',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: noop,
    canvas2dRenderer: 'canvas' as any,
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    schema: legacySchema,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: (behavior) => { nextBehavior = behavior },
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
    setBottomSurfaceCollapsed: markUnexpected('setBottomSurfaceCollapsed'),
    setBottomSurfaceTab: markUnexpected('setBottomSurfaceTab') as any,
    setDocumentSemanticMode: markUnexpected('setDocumentSemanticMode') as any,
    setFrontmatterModeEnabled: markUnexpected('setFrontmatterModeEnabled'),
    setMultiDimTableModeEnabled: markUnexpected('setMultiDimTableModeEnabled'),
  })

  if (unexpectedViewMutations.length > 0) {
    throw new Error(`expected Grid toggle not to mutate Canvas View Mode setters, got ${unexpectedViewMutations.join(', ')}`)
  }
  if (!nextBehavior) {
    throw new Error('expected Grid toggle to write through behavior-only setter')
  }
  const appliedSchema: GraphSchema = {
    ...legacySchema,
    behavior: {
      ...legacySchema.behavior,
      ...nextBehavior,
    },
  }
  if (appliedSchema.layout !== legacySchema.layout) {
    throw new Error('expected Grid toggle behavior patch to preserve schema.layout object identity')
  }
  const behavior = appliedSchema.behavior
  const snapGrid = behavior?.snapGrid as { enabled?: boolean; size?: unknown } | undefined
  const canvasGrid = behavior?.canvasGrid as any
  if (snapGrid?.enabled !== false || !Array.isArray(snapGrid.size) || snapGrid.size[0] !== 20 || snapGrid.size[1] !== 40) {
    throw new Error('expected toolbar Grid toggle to preserve disabled React Flow-style snap-grid tuple')
  }
  if (!canvasGrid?.enabled) throw new Error('expected toolbar grid toggle to enable canvas grid')
  if (canvasGrid.variant !== 'dots') throw new Error('expected explicit dot variant to be preserved')
  if (canvasGrid.minorAlpha < 0.16 || canvasGrid.majorAlpha < 0.34 || canvasGrid.majorWidthPx < 1.25) {
    throw new Error('expected toolbar grid toggle to seed full visible canvas-grid visual config')
  }
}

export function testToolbarSnapGridToggleUsesBehaviorOnlySetterAndPreservesCanvasGrid() {
  const legacySchema: GraphSchema = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      snapGrid: { enabled: false, size: [20, 40] },
      canvasGrid: { enabled: true, variant: 'dots', majorEvery: 5, dotRadiusPx: 1 },
    },
  }
  let nextBehavior: Partial<GraphSchema['behavior']> | null = null
  const unexpectedViewMutations: string[] = []
  const noop = () => undefined
  const markUnexpected = (name: string) => () => {
    unexpectedViewMutations.push(name)
  }
  applyCanvasViewSelection({
    id: 'control:snapGrid',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: noop,
    canvas2dRenderer: 'canvas' as any,
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    schema: legacySchema,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: (behavior) => { nextBehavior = behavior },
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
    setBottomSurfaceCollapsed: markUnexpected('setBottomSurfaceCollapsed'),
    setBottomSurfaceTab: markUnexpected('setBottomSurfaceTab') as any,
    setDocumentSemanticMode: markUnexpected('setDocumentSemanticMode') as any,
    setFrontmatterModeEnabled: markUnexpected('setFrontmatterModeEnabled'),
    setMultiDimTableModeEnabled: markUnexpected('setMultiDimTableModeEnabled'),
  })

  if (unexpectedViewMutations.length > 0) {
    throw new Error(`expected Snap to Grid toggle not to mutate Canvas View Mode setters, got ${unexpectedViewMutations.join(', ')}`)
  }
  if (!nextBehavior) {
    throw new Error('expected Snap to Grid toggle to write through behavior-only setter')
  }
  const behavior = nextBehavior as Partial<GraphSchema['behavior']>
  const snapGrid = behavior.snapGrid as { enabled?: boolean; size?: unknown } | undefined
  if (!snapGrid?.enabled || !Array.isArray(snapGrid.size) || snapGrid.size[0] !== 20 || snapGrid.size[1] !== 40) {
    throw new Error('expected Snap to Grid toggle to enable snapping while preserving React Flow-style tuple')
  }
  if (Object.prototype.hasOwnProperty.call(behavior, 'canvasGrid')) {
    throw new Error('expected Snap to Grid toggle to avoid mutating canvas grid visibility or paint config')
  }
}

export function testCanvasGridDoesNotChangeFlowCanvasLayoutSignature() {
  const base: GraphSchema = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      snapGrid: { enabled: false, size: 10 },
      canvasGrid: { enabled: false, variant: 'lines', majorEvery: 5, dotRadiusPx: 1.25 },
    },
  }
  const gridEnabled: GraphSchema = {
    ...base,
    behavior: {
      ...base.behavior,
      snapGrid: { enabled: true, size: [20, 40] },
      canvasGrid: {
        enabled: true,
        variant: 'dots',
        majorEvery: 4,
        dotRadiusPx: 2,
        minorAlpha: 0.2,
        majorAlpha: 0.4,
        minorWidthPx: 1,
        majorWidthPx: 2,
      },
    },
  }
  const baseKey = buildFlowCanvasLayoutSchemaSignature(base)
  const gridKey = buildFlowCanvasLayoutSchemaSignature(gridEnabled)
  if (baseKey !== gridKey) {
    throw new Error('expected snap/canvas grid changes to stay out of FlowCanvas layout signature')
  }

  const portHandlesChanged: GraphSchema = {
    ...base,
    behavior: {
      ...base.behavior,
      portHandles: {
        ...(base.behavior.portHandles || {}),
        enabled: true,
        size: 12,
      },
    },
  }
  const portKey = buildFlowCanvasLayoutSchemaSignature(portHandlesChanged)
  if (baseKey === portKey) {
    throw new Error('expected layout-affecting port handle changes to update FlowCanvas layout signature')
  }
}
