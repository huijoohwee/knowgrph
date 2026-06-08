import type { Canvas2dRendererId } from '@/lib/config'
import type { BottomSurfaceTab } from '@/hooks/store/store-types/core'
import type { GraphSchema } from '@/lib/graph/schema'
import { togglePortHandlesEnabledInSchema } from '@/lib/graph/portHandlesBehavior'
import {
  CANVAS_GRID_DISPLAY_CONTROL_ID,
  SNAP_GRID_DISPLAY_CONTROL_ID,
  buildCanvasGridVisibilityBehaviorPatch,
  buildSnapGridBehaviorPatch,
} from '@/lib/canvas/canvasGridDisplayControls'
import type { CanvasViewOptionId } from '@/components/toolbar/canvasViewTypes'
import {
  isFrontmatterOnlyCanvas2dRenderer,
  isFrontmatterOnlyPolicyActive,
  isTableGraphCanvas2dRenderer,
  supportsCanvas2dMinimap,
} from '@/lib/config.render'
import { resolveTimelineEnabled } from '@/lib/timeline/timelineVisibility'

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
  timelineEnabled: boolean
  bottomSurfaceCollapsed: boolean
  bottomSurfaceTab: BottomSurfaceTab
  minimapCollapsed?: boolean
  schema: GraphSchema
  setCanvas2dRenderer: (id: Canvas2dRendererId) => void
  setCanvasRenderMode: (mode: '2d' | '3d') => void
  setCanvas3dMode: (mode: string) => void
  setSchema: (schema: GraphSchema) => void
  setBehavior?: (behavior: Partial<GraphSchema['behavior']>) => void
  setRenderMediaAsNodes: (enabled: boolean) => void
  setTimelineEnabled: (enabled: boolean) => void
  setBottomSurfaceCollapsed: (collapsed: boolean) => void
  setBottomSurfaceTab: (tab: BottomSurfaceTab) => void
  setMinimapCollapsed?: (collapsed: boolean) => void
  setDocumentSemanticMode: (mode: 'document' | 'keyword') => void
  setFrontmatterModeEnabled: (enabled: boolean) => void
  setMultiDimTableModeEnabled: (enabled: boolean) => void
  requestFlowEditorLayoutRebalance?: () => void
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
    timelineEnabled,
    bottomSurfaceCollapsed,
    bottomSurfaceTab,
    minimapCollapsed = false,
    schema,
    setCanvas2dRenderer,
    setCanvasRenderMode,
    setCanvas3dMode,
    setSchema,
    setBehavior,
    setRenderMediaAsNodes,
    setTimelineEnabled,
    setBottomSurfaceCollapsed,
    setBottomSurfaceTab,
    setMinimapCollapsed,
    setDocumentSemanticMode,
    setFrontmatterModeEnabled,
    setMultiDimTableModeEnabled,
    requestFlowEditorLayoutRebalance,
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
  if (id === 'layout:flowEditorRebalance') {
    if (canvasRenderMode !== '2d' || canvas2dRenderer !== 'flowEditor') return
    requestFlowEditorLayoutRebalance?.()
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
    if (geospatialEnabled) return
    if (frontmatterModeEnabled) setFrontmatterModeEnabled(false)
    if (
      !multiDimTableModeEnabled ||
      canvasRenderMode !== '2d' ||
      !isTableGraphCanvas2dRenderer(canvas2dRenderer)
    ) {
      setMultiDimTableModeEnabled(true)
    }
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
    setCanvas3dMode('3d')
    setCanvasRenderMode('3d')
    return
  }
  if (id === 'surface:xr') {
    if (geospatialEnabled) {
      onOpenGeospatialMode()
      return
    }
    setCanvas3dMode('xr')
    setCanvasRenderMode('3d')
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
  if (id === 'control:timeline') {
    if (geospatialEnabled) return
    if (canvasRenderMode !== '2d' || canvas2dRenderer !== 'strybldr') {
      const nextTab: BottomSurfaceTab = 'timeline'
      if (bottomSurfaceCollapsed !== true && bottomSurfaceTab === nextTab) {
        setBottomSurfaceCollapsed(true)
        return
      }
      setBottomSurfaceTab(nextTab)
      setBottomSurfaceCollapsed(false)
      return
    }
    const nextEnabled = !resolveTimelineEnabled(timelineEnabled)
    if (resolveTimelineEnabled(timelineEnabled) !== nextEnabled) setTimelineEnabled(nextEnabled)
    return
  }
  if (id === 'control:gitGraph' || id === 'control:gantt') {
    if (geospatialEnabled) return
    const nextTab: BottomSurfaceTab = id === 'control:gitGraph' ? 'gitGraph' : 'gantt'
    if (bottomSurfaceCollapsed !== true && bottomSurfaceTab === nextTab) {
      setBottomSurfaceCollapsed(true)
      return
    }
    setBottomSurfaceTab(nextTab)
    setBottomSurfaceCollapsed(false)
    return
  }
  if (id === 'control:minimap') {
    if (geospatialEnabled || canvasRenderMode !== '2d' || !supportsCanvas2dMinimap(canvas2dRenderer)) return
    setMinimapCollapsed?.(!minimapCollapsed)
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
  if (id === CANVAS_GRID_DISPLAY_CONTROL_ID) {
    const behavior = schema.behavior
    const nextBehavior = buildCanvasGridVisibilityBehaviorPatch(schema)
    if (typeof setBehavior === 'function') {
      setBehavior(nextBehavior)
      return
    }
    setSchema({
      ...schema,
      behavior: {
        ...behavior,
        ...nextBehavior,
      },
    })
    return
  }
  if (id === SNAP_GRID_DISPLAY_CONTROL_ID) {
    const behavior = schema.behavior
    const nextBehavior = buildSnapGridBehaviorPatch(schema)
    if (typeof setBehavior === 'function') {
      setBehavior(nextBehavior)
      return
    }
    setSchema({
      ...schema,
      behavior: {
        ...behavior,
        ...nextBehavior,
      },
    })
    return
  }
  onOpenGeospatialMode()
}
