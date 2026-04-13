import type React from 'react'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config'
import type { GraphSchema } from '@/lib/graph/schema'

export type CanvasViewOptionId =
  | 'renderer:menu'
  | `renderer:${Canvas2dRendererId}`
  | 'layout:menu'
  | 'layout:block'
  | 'layout:radial'
  | 'document:menu'
  | 'document:documentStructure'
  | 'document:keyword'
  | 'document:frontmatter'
  | 'document:multiDimTable'
  | 'surface:menu'
  | 'surface:2d'
  | 'surface:3d'
  | 'surface:voxel'
  | 'animation:menu'
  | 'animation:force'
  | 'animation:orbit'
  | 'control:menu'
  | 'control:richMedia'
  | 'control:nodeShape'
  | 'control:clusterShape'
  | 'control:portHandles'
  | 'control:grid'
  | 'view:geospatial'

export type CanvasViewOption = {
  id: CanvasViewOptionId
  title: string
  label: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
  children?: readonly CanvasViewOption[]
  isActive?: boolean
  dividerBefore?: boolean
  disabled?: boolean
  disabledReason?: string
  enableHint?: string
}

export type CanvasViewRendererOption = {
  id: Canvas2dRendererId
  title: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
  label: string
}

export type CanvasViewModelState = {
  canvas2dRenderer: Canvas2dRendererId
  canvas3dMode: Canvas3dModeId
  canvasRenderMode: '2d' | '3d'
  documentSemanticMode: string
  frontmatterModeEnabled: boolean
  multiDimTableModeEnabled: boolean
  renderMediaAsNodes: boolean
  geospatialEnabled: boolean
  layoutMode?: string
  schema: GraphSchema
  frontmatterOnlyAllowed: boolean
  isD3Like2dLayoutToggle: boolean
  voxelApplicable: boolean
  voxelDisabledReason: { reason: string; hint: string } | null
}
