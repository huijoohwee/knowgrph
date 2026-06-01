import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { Z_INDEX_GRAPH_OVERLAY_BASE, Z_INDEX_GRAPH_OVERLAY_SELECTED } from '@/lib/ui/zIndex'
export {
  RICH_MEDIA_PANEL_DEFAULT_HEIGHT_PX as RICH_MEDIA_ASPECT_DEFAULT_HEIGHT,
  RICH_MEDIA_PANEL_DEFAULT_VIEW_SIZE,
  RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX as RICH_MEDIA_ASPECT_DEFAULT_WIDTH,
} from '@/lib/render/richMediaPanelDefaults'
export {
  handleWidgetInnerPanelScrollCapture,
  handleWidgetInnerPanelWheelCapture,
} from '@/lib/canvas/widgetInnerPanelScrolling'

export type NodeOverlayEditorProps = {
  visible?: boolean
  active: boolean
  interactionPassthrough?: boolean
  flowEditorSurfaceId?: string
  overlayCollectiveCount?: number
  node: GraphNode
  viewportW: number
  viewportH: number
  canvasWindowOffset?: { left: number; top: number } | null
  autoRevealKey?: number
  stackIndex?: number
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  graphMetaKind?: string | null
  graphMetaKey?: string | null
  portHandleEdges?: ReadonlyArray<GraphEdge>
  registryEntries?: ReadonlyArray<WidgetRegistryEntry>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  toolMode?: 'select' | 'addEdge'
  pendingEdgeSourceId?: string | null
  zoomViewKey?: string | null
  onBeginAddEdgeFromNode?: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode?: (nodeId: string, portKey?: string | null) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRun: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onUpdateKvEntry?: () => void
  onPinnedInCanvasChange?: (pinnedInCanvas: boolean) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
}

export const FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_BASE = Z_INDEX_GRAPH_OVERLAY_BASE
export const FLOW_EDITOR_NODE_OVERLAY_Z_INDEX_SELECTED = Z_INDEX_GRAPH_OVERLAY_SELECTED
export const WIDGET_ACTIONS_TOOLBAR_OFFSET_PX = 40
export const WIDGET_ACTIONS_TOOLBAR_CLEARANCE_PX = 48
export const WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX = 8
export const WIDGET_ACTIONS_TOOLBAR_SIDE_CLEARANCE_PX = 220
export const RICH_MEDIA_ASPECT_MIN_WIDTH = 220
export const RICH_MEDIA_ASPECT_MIN_HEIGHT = 160
