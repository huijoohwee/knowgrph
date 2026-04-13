import { getVoxelModeInapplicableReason, isVoxelModeApplicable, resolveCanvas3dMode } from '@/lib/canvas/canvas3dMode'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import type { GraphSchema } from '@/lib/graph/schema'

const BLOCK_SCHEMA = {
  layout: { mode: 'block' },
  behavior: {
    allowEdgeCreation: true,
    allowNodeDrag: true,
  },
  nodeStyles: {},
  edgeStyles: {},
  rules: [],
} as unknown as GraphSchema

export function testVoxelModeRejectsGeospatialMode() {
  const args = {
    canvas2dRenderer: 'd3Bipartite' as const,
    documentSemanticMode: 'document' as const,
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    geospatialEnabled: true,
    schema: BLOCK_SCHEMA,
  }
  const reason = getVoxelModeInapplicableReason(args)
  if (reason !== 'geospatial') {
    throw new Error(`Expected Voxel Mode to report geospatial inapplicable reason, got ${String(reason)}`)
  }
  if (isVoxelModeApplicable(args)) {
    throw new Error('Expected Voxel Mode to be inapplicable while Geospatial Mode is enabled')
  }
  const resolved = resolveCanvas3dMode({ ...args, requested: 'voxel' })
  if (resolved !== '3d') {
    throw new Error(`Expected Voxel Mode request to fall back to 3D in Geospatial Mode, got ${resolved}`)
  }
}

export function testCanvasViewSelectionBlocksVoxelDuringGeospatialMode() {
  let openedGeospatialMode = 0
  let setCanvas2dRendererCalls = 0
  let setCanvas3dModeCalls = 0
  let setCanvasRenderModeCalls = 0
  let setSchemaCalls = 0

  applyCanvasViewSelection({
    id: 'surface:voxel',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: true,
    onOpenGeospatialMode: () => { openedGeospatialMode += 1 },
    canvas2dRenderer: 'd3',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'document',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    renderMediaAsNodes: false,
    schema: BLOCK_SCHEMA,
    setCanvas2dRenderer: () => { setCanvas2dRendererCalls += 1 },
    setCanvasRenderMode: () => { setCanvasRenderModeCalls += 1 },
    setCanvas3dMode: () => { setCanvas3dModeCalls += 1 },
    setSchema: () => { setSchemaCalls += 1 },
    setRenderMediaAsNodes: () => {},
    setDocumentSemanticMode: () => {},
    setFrontmatterModeEnabled: () => {},
    setMultiDimTableModeEnabled: () => {},
  })

  if (openedGeospatialMode !== 1) {
    throw new Error(`Expected Geospatial Mode opener to run once, got ${openedGeospatialMode}`)
  }
  if (setCanvas2dRendererCalls !== 0 || setCanvas3dModeCalls !== 0 || setCanvasRenderModeCalls !== 0 || setSchemaCalls !== 0) {
    throw new Error('Expected Voxel selection to avoid renderer or schema mutations while Geospatial Mode is enabled')
  }
}
