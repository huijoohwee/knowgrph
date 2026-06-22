import { Box, ChartGantt, Circle, CircleDot, Columns2, Cuboid, Diamond, FileText, GitGraph, GitMerge, Glasses, Grid3x3, Hexagon, History, Image as ImageIcon, Images, Magnet, Map, MonitorPlay, Network, Palette, PanelsTopLeft, Pencil, Share2, Square, Table, Tags, Workflow } from 'lucide-react'
import type { Canvas2dRendererId } from '@/lib/config'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import {
  CANVAS_2D_RENDERER_ORDER,
  getCanvas2dRendererMenuBadges,
  getCanvas2dRendererMenuDescription,
  getCanvas2dRendererMenuLabel,
  isD3Like2dRenderer,
  supportsCanvas2dMinimap,
} from '@/lib/config.render'
import type { CanvasViewModelState, CanvasViewOption, CanvasViewOptionId, CanvasViewRendererOption } from '@/components/toolbar/canvasViewTypes'
import {
  CANVAS_GRID_DISPLAY_CONTROL_DESCRIPTION,
  CANVAS_GRID_DISPLAY_CONTROL_ID,
  CANVAS_GRID_DISPLAY_CONTROL_LABEL,
  CANVAS_GRID_DISPLAY_CONTROL_TITLE,
  SNAP_GRID_DISPLAY_CONTROL_DESCRIPTION,
  SNAP_GRID_DISPLAY_CONTROL_ID,
  SNAP_GRID_DISPLAY_CONTROL_LABEL,
  SNAP_GRID_DISPLAY_CONTROL_TITLE,
  readCanvasGridDisplayControlActive,
  readSnapGridDisplayControlActive,
} from '@/lib/canvas/canvasGridDisplayControls'
import { getCanvasSurfaceModeDisabledCopy, type CanvasSurfaceModeId } from '@/lib/canvas/canvas3dMode'

const isAnimationApplicable = (state: CanvasViewModelState) => {
  if (
    !(
      state.frontmatterModeEnabled ||
      state.multiDimTableModeEnabled ||
      state.documentSemanticMode === 'document' ||
      state.documentSemanticMode === 'keyword'
    )
  ) {
    return false
  }
  return (
    (state.canvasRenderMode === '3d' && state.canvas3dMode !== 'voxel') ||
    (state.canvasRenderMode === '2d' && state.canvas2dRenderer === 'd3')
  )
}

const CANVAS_VIEW_RENDERER_OPTION_ICON: Record<Canvas2dRendererId, CanvasViewRendererOption['Icon']> = {
  d3: CircleDot,
  dashboard: Grid3x3,
  gallery: Images,
  media: ImageIcon,
  flowchart: Columns2,
  multiDimTable: Table,
  gitGraph: GitGraph,
  gantt: ChartGantt,
  flow: GitMerge,
  animatic: MonitorPlay,
  storyboard: PanelsTopLeft,
  design: Palette,
  flowEditor: Pencil,
}

const CANVAS_VIEW_RENDERER_OPTION_TITLE: Record<Canvas2dRendererId, string> = {
  d3: UI_COPY.canvasViewRendererD3Title,
  dashboard: UI_COPY.canvasViewRendererDashboardTitle,
  gallery: UI_COPY.canvasViewRendererGalleryTitle,
  media: UI_COPY.canvasViewRendererMediaTitle,
  flowchart: UI_COPY.canvasViewRendererD3FlowchartTitle,
  multiDimTable: UI_COPY.canvasViewRendererMultiDimTableTitle,
  gitGraph: UI_COPY.canvasViewRendererGitGraphTitle,
  gantt: UI_COPY.canvasViewRendererGanttTitle,
  flow: UI_COPY.canvasViewRendererFlowTitle,
  animatic: UI_COPY.canvasViewRendererAnimaticTitle,
  storyboard: UI_COPY.canvasViewRendererStoryboardTitle,
  design: UI_COPY.canvasViewRendererDesignTitle,
  flowEditor: UI_COPY.canvasViewRendererFlowEditorTitle,
}

export const getCanvasViewRendererOptions = (): CanvasViewRendererOption[] =>
  CANVAS_2D_RENDERER_ORDER.map(id => ({
    id,
    title: CANVAS_VIEW_RENDERER_OPTION_TITLE[id],
    Icon: CANVAS_VIEW_RENDERER_OPTION_ICON[id],
    label: getCanvas2dRendererMenuLabel(id),
    description: getCanvas2dRendererMenuDescription(id),
    badges: getCanvas2dRendererMenuBadges(id),
  }))

export const buildCanvasViewOptions = (
  state: CanvasViewModelState,
  rendererOptions: CanvasViewRendererOption[],
): CanvasViewOption[] => {
  const animationApplicable = isAnimationApplicable(state)
  const bottomSurfaceOpen = state.bottomSurfaceCollapsed !== true
  const timelineBottomPanelVisible = bottomSurfaceOpen && state.bottomSurfaceTab === 'timeline'
  const flowchartBottomPanelVisible = bottomSurfaceOpen && state.bottomSurfaceTab === 'flowchart'
  const gitGraphBottomPanelVisible = bottomSurfaceOpen && state.bottomSurfaceTab === 'gitGraph'
  const ganttBottomPanelVisible = bottomSurfaceOpen && state.bottomSurfaceTab === 'gantt'
  const architectureBottomPanelVisible = bottomSurfaceOpen && state.bottomSurfaceTab === 'architecture'
  const eventModelingBottomPanelVisible = bottomSurfaceOpen && state.bottomSurfaceTab === 'eventModeling'
  const minimapSupported = state.canvasRenderMode === '2d' && supportsCanvas2dMinimap(state.canvas2dRenderer)
  const minimapVisible = minimapSupported && state.minimapCollapsed !== true
  const surfaceModeArgs = {
    canvas2dRenderer: state.canvas2dRenderer,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    multiDimTableModeEnabled: state.multiDimTableModeEnabled,
    geospatialEnabled: state.geospatialEnabled,
    layoutMode: state.layoutMode,
    schema: state.schema,
  }
  const getSurfaceModeDisabledCopy = (mode: CanvasSurfaceModeId) => getCanvasSurfaceModeDisabledCopy(surfaceModeArgs, mode)
  const surfaceMode2dDisabledCopy = getSurfaceModeDisabledCopy('2d')
  const surfaceMode3dDisabledCopy = getSurfaceModeDisabledCopy('3d')
  const surfaceModeXrDisabledCopy = getSurfaceModeDisabledCopy('xr')
  const surfaceModeVoxelDisabledCopy = getSurfaceModeDisabledCopy('voxel')
  const nodeShapeMode = state.schema.behavior?.nodeShapeMode
  const nodeShapeIcon =
    nodeShapeMode === 'rect'
      ? Square
      : nodeShapeMode === 'diamond'
        ? Diamond
        : nodeShapeMode === 'hex'
          ? Hexagon
          : Circle
  const nodeShapeTitle =
    nodeShapeMode === 'rect'
      ? 'Node Shape: Rect'
      : nodeShapeMode === 'diamond'
        ? 'Node Shape: Diamond'
        : nodeShapeMode === 'hex'
          ? 'Node Shape: Hex'
          : 'Node Shape: Circle'
  const flowEditorLayoutChildren: readonly CanvasViewOption[] = [
    {
      id: 'layout:flowEditorRebalance',
      title: 'Re-balance Flow Editor layout',
      label: 'Re-balance',
      Icon: Columns2,
      disabled: state.geospatialEnabled,
      disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
      enableHint: state.geospatialEnabled ? 'Switch to Document Mode to enable' : undefined,
    },
  ]
  const d3LikeLayoutChildren: readonly CanvasViewOption[] = [
    {
      id: 'layout:block',
      title: 'Block layout',
      label: 'Block',
      Icon: Columns2,
      disabled: state.geospatialEnabled || !state.isD3Like2dLayoutToggle,
      disabledReason: state.geospatialEnabled
        ? 'Disabled in Geospatial Mode'
        : !state.isD3Like2dLayoutToggle
          ? 'Available for D3 and Flowchart renderer'
          : undefined,
      enableHint: state.geospatialEnabled
        ? 'Switch to Document Mode to enable'
        : !state.isD3Like2dLayoutToggle
          ? 'Switch renderer to D3 or Flowchart'
          : undefined,
    },
    {
      id: 'layout:radial',
      title: 'Radial layout',
      label: 'Radial',
      Icon: CircleDot,
      disabled: state.geospatialEnabled || !state.isD3Like2dLayoutToggle,
      disabledReason: state.geospatialEnabled
        ? 'Disabled in Geospatial Mode'
        : !state.isD3Like2dLayoutToggle
          ? 'Available for D3 and Flowchart renderer'
          : undefined,
      enableHint: state.geospatialEnabled
        ? 'Switch to Document Mode to enable'
        : !state.isD3Like2dLayoutToggle
          ? 'Switch renderer to D3 or Flowchart'
          : undefined,
    },
  ]

  const optionsWithDisabled = rendererOptions.map(option => {
    const supportsD3LikeLayout = isD3Like2dRenderer(option.id)
    const disabledForRadial = state.layoutMode === 'radial' && !supportsD3LikeLayout
    const disabledForGeospatial = state.geospatialEnabled
    const disabledOption = disabledForRadial || disabledForGeospatial
    return {
      id: `renderer:${option.id}` as const,
      title: option.title,
      label: option.label,
      description: option.description,
      badges: option.badges,
      Icon: option.Icon,
      disabled: disabledOption,
      disabledReason: disabledForGeospatial
        ? 'Disabled in Geospatial Mode'
        : disabledForRadial
            ? 'Disabled in Radial Layout'
            : undefined,
      enableHint: disabledForGeospatial
        ? 'Switch to Document Mode to enable'
        : disabledForRadial
            ? 'Switch layout mode to Block to enable'
            : undefined,
    } satisfies CanvasViewOption
  })

  return [
    {
      id: 'renderer:menu',
      title: '2D Renderer',
      label: '2D',
      Icon: CircleDot,
      children: optionsWithDisabled,
    },
    {
      id: 'layout:menu',
      title: 'Layout Mode',
      label: 'Layout',
      Icon: Columns2,
      dividerBefore: true,
      children: state.canvas2dRenderer === 'flowEditor' ? flowEditorLayoutChildren : d3LikeLayoutChildren,
    },
    {
      id: 'document:menu',
      title: 'Document Modes',
      label: 'Docs',
      Icon: FileText,
      dividerBefore: true,
      children: [
        {
          id: 'document:documentStructure',
          title: UI_LABELS.documentStructureMode,
          label: 'Doc',
          Icon: FileText,
          disabled: state.geospatialEnabled || state.frontmatterOnlyAllowed,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : state.frontmatterOnlyAllowed ? UI_COPY.frontmatterModeTooltip : undefined,
        },
        {
          id: 'document:keyword',
          title: UI_LABELS.keywordMode,
          label: 'Key',
          Icon: Tags,
          disabled: state.geospatialEnabled || state.frontmatterOnlyAllowed,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : state.frontmatterOnlyAllowed ? UI_COPY.frontmatterModeTooltip : undefined,
        },
        {
          id: 'document:frontmatter',
          title: UI_LABELS.frontmatterMode,
          label: 'Front',
          Icon: GitMerge,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'document:multiDimTable',
          title: UI_LABELS.multiDimTableMode,
          label: 'Table',
          Icon: Table,
          disabled: state.geospatialEnabled || state.frontmatterOnlyAllowed,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : state.frontmatterOnlyAllowed ? UI_COPY.frontmatterModeTooltip : undefined,
        },
      ],
    },
    {
      id: 'surface:menu',
      title: 'Surface Mode',
      label: 'Surface',
      Icon: Box,
      dividerBefore: true,
      children: [
        {
          id: 'surface:2d',
          title: '2D Mode',
          label: '2D',
          Icon: Columns2,
          disabled: !!surfaceMode2dDisabledCopy,
          disabledReason: surfaceMode2dDisabledCopy?.reason,
          enableHint: surfaceMode2dDisabledCopy?.hint,
        },
        {
          id: 'surface:3d',
          title: '3D Mode',
          label: '3D',
          Icon: Box,
          disabled: !!surfaceMode3dDisabledCopy,
          disabledReason: surfaceMode3dDisabledCopy?.reason,
          enableHint: surfaceMode3dDisabledCopy?.hint,
        },
        {
          id: 'surface:xr',
          title: 'XR Mode',
          label: 'XR',
          Icon: Glasses,
          disabled: !!surfaceModeXrDisabledCopy,
          disabledReason: surfaceModeXrDisabledCopy?.reason,
          enableHint: surfaceModeXrDisabledCopy?.hint,
        },
        {
          id: 'surface:voxel',
          title: 'Voxel Mode',
          label: 'Voxel',
          Icon: Cuboid,
          disabled: !!surfaceModeVoxelDisabledCopy,
          disabledReason: surfaceModeVoxelDisabledCopy?.reason,
          enableHint: surfaceModeVoxelDisabledCopy?.hint,
        },
        {
          id: 'view:geospatial',
          title: UI_COPY.geospatialModeOnTitle,
          label: 'Geo',
          Icon: Map,
        },
      ],
    },
    {
      id: 'animation:menu',
      title: 'Animation Mode',
      label: 'Anim',
      Icon: GitMerge,
      dividerBefore: true,
      children: [
        {
          id: 'animation:force',
          title: 'Force-directed Graph',
          label: 'Force',
          Icon: GitMerge,
          disabled: state.geospatialEnabled || !animationApplicable,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : 'Animation is not applicable in current view',
          enableHint: state.geospatialEnabled ? 'Switch to Document Mode to enable' : undefined,
        },
        {
          id: 'animation:orbit',
          title: 'Orbit-style nested radial',
          label: 'Orbit',
          Icon: GitMerge,
          disabled: state.geospatialEnabled || !animationApplicable,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : 'Animation is not applicable in current view',
          enableHint: state.geospatialEnabled ? 'Switch to Document Mode to enable' : undefined,
        },
      ],
    },
    {
      id: 'control:menu',
      title: 'Display Controls',
      label: 'Display',
      Icon: Grid3x3,
      dividerBefore: true,
      children: [
        {
          id: 'control:richMedia',
          title: UI_LABELS.renderMediaAsNodes,
          label: 'Media',
          Icon: ImageIcon,
          isActive: state.renderMediaAsNodes,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'control:nodeShape',
          title: nodeShapeTitle,
          label: 'Node',
          Icon: nodeShapeIcon,
        },
        {
          id: 'control:clusterShape',
          title: state.schema.layout?.groups?.shape === 'rect' ? UI_LABELS.groupShapeRect : UI_LABELS.groupShapePolygon,
          label: 'Group',
          Icon: state.schema.layout?.groups?.shape === 'rect' ? Square : Hexagon,
        },
        {
          id: 'control:portHandles',
          title: UI_LABELS.portHandles,
          label: 'Ports',
          Icon: Share2,
          isActive: state.schema.behavior?.portHandles?.enabled === true,
        },
        {
          id: 'control:minimap',
          title: 'Minimap',
          label: 'Minimap',
          Icon: Map,
          isActive: minimapVisible,
          disabled: state.geospatialEnabled || !minimapSupported,
          disabledReason: state.geospatialEnabled
            ? 'Disabled in Geospatial Mode'
            : !minimapSupported
              ? 'Current renderer does not support Minimap'
              : undefined,
          enableHint: state.geospatialEnabled
            ? 'Switch to Document Mode to enable'
            : !minimapSupported
              ? 'Switch to a minimap-capable 2D renderer'
              : undefined,
        },
        {
          id: CANVAS_GRID_DISPLAY_CONTROL_ID,
          title: CANVAS_GRID_DISPLAY_CONTROL_TITLE,
          label: CANVAS_GRID_DISPLAY_CONTROL_LABEL,
          Icon: Grid3x3,
          description: CANVAS_GRID_DISPLAY_CONTROL_DESCRIPTION,
          isActive: readCanvasGridDisplayControlActive(state.schema),
        },
        {
          id: SNAP_GRID_DISPLAY_CONTROL_ID,
          title: SNAP_GRID_DISPLAY_CONTROL_TITLE,
          label: SNAP_GRID_DISPLAY_CONTROL_LABEL,
          Icon: Magnet,
          description: SNAP_GRID_DISPLAY_CONTROL_DESCRIPTION,
          isActive: readSnapGridDisplayControlActive(state.schema),
        },
        {
          id: 'control:timeline',
          title: 'Timeline',
          label: 'Time',
          Icon: History,
          isActive: timelineBottomPanelVisible,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'control:flowchart',
          title: 'Flowchart',
          label: 'Flow',
          Icon: Columns2,
          isActive: flowchartBottomPanelVisible,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'control:gitGraph',
          title: 'GitGraph',
          label: 'Git',
          Icon: GitGraph,
          isActive: gitGraphBottomPanelVisible,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'control:gantt',
          title: 'Gantt-Timeline',
          label: 'Gantt',
          Icon: ChartGantt,
          isActive: ganttBottomPanelVisible,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'control:architecture',
          title: 'Architecture',
          label: 'Arch',
          Icon: Network,
          isActive: architectureBottomPanelVisible,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'control:eventModeling',
          title: 'Event Model',
          label: 'Event',
          Icon: Workflow,
          isActive: eventModelingBottomPanelVisible,
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
      ],
    },
  ]
}

export const getCanvasViewTriggerState = (
  state: CanvasViewModelState,
  rendererOptions: CanvasViewRendererOption[],
): { id: CanvasViewOptionId; title: string; label: string } => {
  if (state.geospatialEnabled) return { id: 'view:geospatial', title: UI_COPY.geospatialModeOnTitle, label: 'Geo' }
  if (state.canvasRenderMode === '3d') {
    if (state.canvas3dMode === 'voxel') return { id: 'surface:voxel', title: 'Voxel Mode', label: 'Voxel' }
    if (state.canvas3dMode === 'xr') return { id: 'surface:xr', title: 'XR Mode', label: 'XR' }
    return { id: 'surface:3d', title: '3D Mode', label: '3D' }
  }
  const activeRenderer = rendererOptions.find(o => o.id === state.canvas2dRenderer) || rendererOptions[0]
  return {
    id: `renderer:${activeRenderer.id}` as CanvasViewOptionId,
    title: activeRenderer.title,
    label: activeRenderer.label,
  }
}
