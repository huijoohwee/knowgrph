import { Box, Circle, CircleDot, Columns2, Cuboid, Diamond, FileText, GitMerge, Glasses, Grid3x3, Hexagon, Image as ImageIcon, Map, MonitorPlay, Palette, PanelsTopLeft, Pencil, Share2, Square, Table, Tags } from 'lucide-react'
import type { Canvas2dRendererId } from '@/lib/config'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import {
  CANVAS_2D_RENDERER_ORDER,
  getCanvas2dRendererMenuBadges,
  getCanvas2dRendererMenuDescription,
  getCanvas2dRendererMenuLabel,
  isD3Like2dRenderer,
} from '@/lib/config.render'
import type { CanvasViewModelState, CanvasViewOption, CanvasViewOptionId, CanvasViewRendererOption } from '@/components/toolbar/canvasViewTypes'

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
  flowchart: Columns2,
  flow: GitMerge,
  animatic: MonitorPlay,
  storyboard: PanelsTopLeft,
  design: Palette,
  flowEditor: Pencil,
}

const CANVAS_VIEW_RENDERER_OPTION_TITLE: Record<Canvas2dRendererId, string> = {
  d3: UI_COPY.canvasViewRendererD3Title,
  flowchart: UI_COPY.canvasViewRendererD3FlowchartTitle,
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
      children: [
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
      ],
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
          disabled: state.geospatialEnabled,
          disabledReason: state.geospatialEnabled ? 'Disabled in Geospatial Mode' : undefined,
        },
        {
          id: 'surface:3d',
          title: '3D Mode',
          label: '3D',
          Icon: Box,
          disabled: state.geospatialEnabled || state.layoutMode === 'radial',
          disabledReason: state.geospatialEnabled
            ? 'Disabled in Geospatial Mode'
            : state.layoutMode === 'radial'
              ? '3D Mode is disabled in Radial Layout'
              : undefined,
          enableHint: state.layoutMode === 'radial' ? 'Switch layout mode to Block' : undefined,
        },
        {
          id: 'surface:xr',
          title: 'XR Mode',
          label: 'XR',
          Icon: Glasses,
          disabled: state.geospatialEnabled || state.layoutMode === 'radial',
          disabledReason: state.geospatialEnabled
            ? 'Disabled in Geospatial Mode'
            : state.layoutMode === 'radial'
              ? 'XR Mode is disabled in Radial Layout'
              : undefined,
          enableHint: state.layoutMode === 'radial' ? 'Switch layout mode to Block' : undefined,
        },
        {
          id: 'surface:voxel',
          title: 'Voxel Mode',
          label: 'Voxel',
          Icon: Cuboid,
          disabled: state.geospatialEnabled || !state.schema || !state.voxelApplicable,
          disabledReason: state.geospatialEnabled
            ? 'Disabled in Geospatial Mode'
            : !state.schema
              ? 'Graph schema is not ready yet'
              : !state.voxelApplicable
                ? state.voxelDisabledReason?.reason
                : undefined,
          enableHint: state.geospatialEnabled
            ? 'Switch to Document Mode to enable'
            : !state.schema
              ? 'Wait for graph initialization, then retry'
              : !state.voxelApplicable
                ? state.voxelDisabledReason?.hint
                : undefined,
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
          id: 'control:grid',
          title: UI_LABELS.grid,
          label: 'Grid',
          Icon: Grid3x3,
          isActive: state.schema.behavior?.snapGrid?.enabled === true || state.schema.behavior?.canvasGrid?.enabled === true,
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
