import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { buildFlowCanvasLayoutSchemaSignature } from '@/components/FlowCanvas/useFlowCanvasLayoutState'
import { drawInfiniteGridInWorldContext } from '@/lib/canvas/infiniteGrid'
import { readCanvasGridRenderConfigFromSchema } from '@/lib/canvas/canvasGridConfig'
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
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc() {
      this.arcCalls += 1
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
    schema: legacySchema,
    setCanvas2dRenderer: markUnexpected('setCanvas2dRenderer') as any,
    setCanvasRenderMode: markUnexpected('setCanvasRenderMode') as any,
    setCanvas3dMode: markUnexpected('setCanvas3dMode'),
    setSchema: markUnexpected('setSchema') as any,
    setBehavior: (behavior) => { nextBehavior = behavior },
    setRenderMediaAsNodes: markUnexpected('setRenderMediaAsNodes'),
    setTimelineEnabled: markUnexpected('setTimelineEnabled'),
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
  if (!snapGrid?.enabled || !Array.isArray(snapGrid.size) || snapGrid.size[0] !== 20 || snapGrid.size[1] !== 40) {
    throw new Error('expected toolbar grid toggle to preserve React Flow-style snap-grid tuple')
  }
  if (!canvasGrid?.enabled) throw new Error('expected toolbar grid toggle to enable canvas grid')
  if (canvasGrid.variant !== 'dots') throw new Error('expected explicit dot variant to be preserved')
  if (canvasGrid.minorAlpha < 0.16 || canvasGrid.majorAlpha < 0.34 || canvasGrid.majorWidthPx < 1.25) {
    throw new Error('expected toolbar grid toggle to seed full visible canvas-grid visual config')
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
