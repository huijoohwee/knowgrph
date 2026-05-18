import type { Canvas2dRendererId } from '@/lib/config'
import type { GraphSchema } from '@/lib/graph/schema'
import { togglePortHandlesEnabledInSchema } from '@/lib/graph/portHandlesBehavior'
import { SNAP_GRID_SIZE_DEFAULT } from '@/lib/canvas/snapGridSize'
import type { CanvasViewOptionId } from '@/components/toolbar/canvasViewTypes'
import { isFrontmatterOnlyCanvas2dRenderer, isFrontmatterOnlyPolicyActive } from '@/lib/config.render'

type CanvasViewActionParams = {
  id: CanvasViewOptionId
  ensureBaselineUnlocked: () => boolean
  geospatialEnabled: boolean
  onOpenGeospatialMode: () => void
  canvas2dRenderer: Canvas2dRendererId
  canvas3dMode: string
  canvasRenderMode: '2d' | '3d'
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  renderMediaAsNodes: boolean
  schema: GraphSchema
  setCanvas2dRenderer: (id: Canvas2dRendererId) => void
  setCanvasRenderMode: (mode: '2d' | '3d') => void
  setCanvas3dMode: (mode: string) => void
  setSchema: (schema: GraphSchema) => void
  setRenderMediaAsNodes: (enabled: boolean) => void
  setDocumentSemanticMode: (mode: 'document' | 'keyword') => void
  setFrontmatterModeEnabled: (enabled: boolean) => void
  setMultiDimTableModeEnabled: (enabled: boolean) => void
}

export const applyCanvasViewSelection = (params: CanvasViewActionParams) => {
  const {
    id,
    ensureBaselineUnlocked,
    geospatialEnabled,
    onOpenGeospatialMode,
    canvas2dRenderer,
    canvas3dMode,
    canvasRenderMode,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    renderMediaAsNodes,
    schema,
    setCanvas2dRenderer,
    setCanvasRenderMode,
    setCanvas3dMode,
    setSchema,
    setRenderMediaAsNodes,
    setDocumentSemanticMode,
    setFrontmatterModeEnabled,
    setMultiDimTableModeEnabled,
  } = params

  if (!ensureBaselineUnlocked()) return
  const frontmatterOnlyAllowed = isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer })

  if (id.startsWith('renderer:')) {
    if (id === 'renderer:menu') return
    const nextRenderer = id.slice('renderer:'.length) as Canvas2dRendererId
    const rendererChanged = nextRenderer !== canvas2dRenderer
    if (canvasRenderMode !== '2d') setCanvasRenderMode('2d')
    if (rendererChanged) setCanvas2dRenderer(nextRenderer)
    if (isFrontmatterOnlyCanvas2dRenderer(nextRenderer)) {
      if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
      if (!frontmatterModeEnabled) setFrontmatterModeEnabled(true)
      if (documentSemanticMode !== 'document') setDocumentSemanticMode('document')
    }
    return
  }
  if (id === 'layout:block' || id === 'layout:radial') {
    const nextMode = id === 'layout:block' ? 'block' : 'radial'
    if (schema.layout?.mode === nextMode) return
    setSchema({
      ...schema,
      layout: {
        ...(schema.layout || {}),
        mode: nextMode,
      },
    })
    return
  }
  if (id === 'document:menu') {
    return
  }
  if (id === 'layout:menu') {
    return
  }
  if (id === 'animation:menu') {
    return
  }
  if (id === 'control:menu') {
    return
  }
  if (id === 'surface:menu') {
    return
  }
  if (id === 'document:documentStructure') {
    if (geospatialEnabled) return
    if (frontmatterOnlyAllowed) {
      if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
      if (!frontmatterModeEnabled) setFrontmatterModeEnabled(true)
      if (documentSemanticMode !== 'document') setDocumentSemanticMode('document')
      return
    }
    if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
    if (frontmatterModeEnabled) setFrontmatterModeEnabled(false)
    setDocumentSemanticMode('document')
    return
  }
  if (id === 'document:keyword') {
    if (geospatialEnabled || frontmatterOnlyAllowed) return
    if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
    if (frontmatterModeEnabled) setFrontmatterModeEnabled(false)
    setDocumentSemanticMode('keyword')
    return
  }
  if (id === 'document:frontmatter') {
    if (geospatialEnabled) return
    if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
    if (!frontmatterModeEnabled) setFrontmatterModeEnabled(true)
    if (documentSemanticMode !== 'document') setDocumentSemanticMode('document')
    return
  }
  if (id === 'document:multiDimTable') {
    if (geospatialEnabled || frontmatterOnlyAllowed) return
    if (frontmatterModeEnabled) setFrontmatterModeEnabled(false)
    if (!multiDimTableModeEnabled) setMultiDimTableModeEnabled(true)
    if (documentSemanticMode !== 'document') setDocumentSemanticMode('document')
    return
  }
  if (id === 'surface:2d') {
    setCanvasRenderMode('2d')
    return
  }
  if (id === 'surface:voxel') {
    if (geospatialEnabled) {
      onOpenGeospatialMode()
      return
    }
    if (schema.layout?.mode !== 'block') {
      setSchema({
        ...schema,
        layout: {
          ...(schema.layout || {}),
          mode: 'block',
        },
      })
    }
    if (canvas2dRenderer !== 'flowchart') {
      setCanvas2dRenderer('flowchart')
    }
    setCanvas3dMode('voxel')
    setCanvasRenderMode('3d')
    return
  }
  if (id === 'surface:3d') {
    setCanvasRenderMode('3d')
    setCanvas3dMode('3d')
    return
  }
  if (id === 'surface:xr') {
    if (geospatialEnabled) {
      onOpenGeospatialMode()
      return
    }
    setCanvasRenderMode('3d')
    setCanvas3dMode('xr')
    return
  }
  if (id === 'animation:force' || id === 'animation:orbit') {
    const semanticApplicable =
      frontmatterModeEnabled ||
      multiDimTableModeEnabled ||
      documentSemanticMode === 'document' ||
      documentSemanticMode === 'keyword'
    const rendererApplicable =
      (canvasRenderMode === '3d' && canvas3dMode !== 'voxel') ||
      (canvasRenderMode === '2d' && canvas2dRenderer === 'd3')
    if (!(semanticApplicable && rendererApplicable)) return
    const nextEnabled = id === 'animation:orbit'
    if ((schema.layout?.forces?.radialOrbitEnabled !== false) === nextEnabled) return
    setSchema({
      ...schema,
      layout: {
        ...(schema.layout || {}),
        forces: {
          ...((schema.layout || {}).forces || {}),
          radialOrbitEnabled: nextEnabled,
        },
      },
    })
    return
  }
  if (id === 'control:richMedia') {
    setRenderMediaAsNodes(!renderMediaAsNodes)
    return
  }
  if (id === 'control:nodeShape') {
    const currentMode = schema.behavior?.nodeShapeMode
    const current: 'circle' | 'rect' | 'diamond' | 'hex' =
      currentMode === 'rect' || currentMode === 'diamond' || currentMode === 'hex' ? currentMode : 'circle'
    const order: ReadonlyArray<'circle' | 'rect' | 'diamond' | 'hex'> = ['circle', 'rect', 'diamond', 'hex']
    const index = order.indexOf(current)
    const nextMode = order[(index >= 0 ? index + 1 : 0) % order.length]
    setSchema({
      ...schema,
      behavior: {
        ...schema.behavior,
        nodeShapeMode: nextMode,
      },
    })
    return
  }
  if (id === 'control:clusterShape') {
    const currentShape = schema.layout?.groups?.shape === 'rect' ? 'rect' : 'geo'
    setSchema({
      ...schema,
      layout: {
        ...(schema.layout || {}),
        groups: {
          ...((schema.layout || {}).groups || {}),
          shape: currentShape === 'rect' ? 'geo' : 'rect',
        },
      },
    })
    return
  }
  if (id === 'control:portHandles') {
    const next = togglePortHandlesEnabledInSchema(schema)
    if (next.changed) setSchema(next.schema)
    return
  }
  if (id === 'control:grid') {
    const behavior = schema.behavior
    const snapGrid = (behavior.snapGrid || {}) as { enabled?: boolean; size?: number }
    const canvasGrid = (behavior.canvasGrid || {}) as { enabled?: boolean }
    const nextEnabled = !(snapGrid.enabled === true || canvasGrid.enabled === true)
    setSchema({
      ...schema,
      behavior: {
        ...behavior,
        snapGrid: {
          ...snapGrid,
          enabled: nextEnabled,
          size:
            typeof snapGrid.size === 'number' && Number.isFinite(snapGrid.size)
              ? snapGrid.size
              : SNAP_GRID_SIZE_DEFAULT,
        },
        canvasGrid: {
          ...canvasGrid,
          enabled: nextEnabled,
        },
      },
    })
    return
  }
  onOpenGeospatialMode()
}
