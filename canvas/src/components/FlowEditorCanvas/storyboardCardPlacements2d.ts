import { isStoryboardFixedCardOwnedNode } from '@/components/FlowEditorCanvas/storyboardCardOwnership2d'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { resolveCanvasAspectRatioSize, type CanvasAspectRatioMode } from '@/lib/canvas/canvasAspectRatioDisplayControls'
import { readSnapGridConfigFromSchema, snapPointToGrid } from '@/lib/canvas/gridSnap'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX } from '@/lib/render/richMediaPanelDefaults'

const DEFAULT_GRID_GAP = 64

export type StoryboardCardPlacement = {
  x: number
  y: number
}

const readFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export const readStoryboardCardSize2d = (node: GraphNode, aspectRatioMode: CanvasAspectRatioMode): { width: number; height: number } => {
  const props = (node.properties || {}) as Record<string, unknown>
  return resolveCanvasAspectRatioSize({
    defaultWidth: RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX,
    mode: aspectRatioMode,
    width: readFiniteNumber(props['visual:width']),
  })
}

const readDefaultCardSize = (aspectRatioMode: CanvasAspectRatioMode): { width: number; height: number } =>
  resolveCanvasAspectRatioSize({
    defaultWidth: RICH_MEDIA_PANEL_DEFAULT_WIDTH_PX,
    mode: aspectRatioMode,
  })

export const readStoryboardCardCenter2d = (node: GraphNode | undefined): StoryboardCardPlacement | null => {
  if (!node) return null
  const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : null
  const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : null
  return x == null || y == null ? null : { x, y }
}

const ceilToStep = (value: number, step: number): number => {
  const v = Number.isFinite(value) ? Math.max(1, value) : 1
  const s = Number.isFinite(step) ? Math.max(1, step) : 1
  return Math.ceil(v / s) * s
}

export const buildFixedStoryboardCardPlacements2d = (args: {
  aspectRatioMode: CanvasAspectRatioMode
  board: ReturnType<typeof buildStoryboardBoardModel>
  nodeById: Map<string, GraphNode>
  schema: GraphSchema | null | undefined
}): Map<string, StoryboardCardPlacement> => {
  const { aspectRatioMode, board, nodeById, schema } = args
  const out = new Map<string, StoryboardCardPlacement>()
  const orderedCards = board.lanes
    .flatMap(lane => lane.cards)
    .filter(card => isStoryboardFixedCardOwnedNode(nodeById.get(card.id)))
  if (orderedCards.length === 0) return out

  const centers: StoryboardCardPlacement[] = []
  const defaultSize = readDefaultCardSize(aspectRatioMode)
  let maxCardWidth: number = defaultSize.width
  let maxCardHeight: number = defaultSize.height
  for (let i = 0; i < orderedCards.length; i += 1) {
    const node = nodeById.get(orderedCards[i]!.id)
    if (!node) continue
    const center = readStoryboardCardCenter2d(node)
    if (center) centers.push(center)
    const size = readStoryboardCardSize2d(node, aspectRatioMode)
    maxCardWidth = Math.max(maxCardWidth, size.width)
    maxCardHeight = Math.max(maxCardHeight, size.height)
  }

  const origin = centers.length > 0
    ? {
        x: centers.reduce((sum, p) => sum + p.x, 0) / centers.length,
        y: centers.reduce((sum, p) => sum + p.y, 0) / centers.length,
      }
    : { x: 0, y: 0 }
  const grid = readSnapGridConfigFromSchema(schema)
  const gapX = grid.enabled ? Math.max(grid.x * 2, DEFAULT_GRID_GAP) : DEFAULT_GRID_GAP
  const gapY = grid.enabled ? Math.max(grid.y * 2, DEFAULT_GRID_GAP) : DEFAULT_GRID_GAP
  const cellWidth = grid.enabled ? ceilToStep(maxCardWidth + gapX, grid.x) : maxCardWidth + gapX
  const cellHeight = grid.enabled ? ceilToStep(maxCardHeight + gapY, grid.y) : maxCardHeight + gapY
  const visibleLanes = board.lanes
    .map(lane => ({ ...lane, cards: lane.cards.filter(card => isStoryboardFixedCardOwnedNode(nodeById.get(card.id))) }))
    .filter(lane => lane.cards.length > 0)
  const columnCount = Math.max(1, visibleLanes.length)
  const rowCount = Math.max(1, visibleLanes.reduce((max, lane) => Math.max(max, lane.cards.length), 0))
  const centerLaneOffset = (columnCount - 1) / 2
  const centerRowOffset = (rowCount - 1) / 2

  for (let laneIndex = 0; laneIndex < visibleLanes.length; laneIndex += 1) {
    const lane = visibleLanes[laneIndex]!
    for (let rowIndex = 0; rowIndex < lane.cards.length; rowIndex += 1) {
      const card = lane.cards[rowIndex]!
      const node = nodeById.get(card.id)
      const size = node ? readStoryboardCardSize2d(node, aspectRatioMode) : defaultSize
      const rawCenter = {
        x: origin.x + (laneIndex - centerLaneOffset) * cellWidth,
        y: origin.y + (rowIndex - centerRowOffset) * cellHeight,
      }
      if (!grid.enabled) {
        out.set(card.id, rawCenter)
        continue
      }
      const snappedTopLeft = snapPointToGrid({
        x: rawCenter.x - size.width / 2,
        y: rawCenter.y - size.height / 2,
      }, grid)
      out.set(card.id, {
        x: snappedTopLeft.x + size.width / 2,
        y: snappedTopLeft.y + size.height / 2,
      })
    }
  }
  return out
}

export const applyFixedStoryboardCardPlacementsToGraphData2d = (args: {
  aspectRatioMode: CanvasAspectRatioMode
  graphData: GraphData | null
  graphRevision: number
  schema: GraphSchema | null | undefined
  widgetRegistry?: ReadonlyArray<WidgetRegistryEntry> | null
}): GraphData | null => {
  const { aspectRatioMode, graphData, graphRevision, schema, widgetRegistry } = args
  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as GraphNode[]) : []
  if (!graphData || nodes.length === 0) return graphData
  const board = buildStoryboardBoardModel({ graphData, graphRevision, widgetRegistry })
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = String(node?.id || '').trim()
    if (id) nodeById.set(id, node)
  }
  const placements = buildFixedStoryboardCardPlacements2d({ aspectRatioMode, board, nodeById, schema })
  if (placements.size === 0) return graphData
  let changed = false
  const nextNodes = nodes.map(node => {
    const id = String(node?.id || '').trim()
    const placement = id ? placements.get(id) : null
    if (!placement) return node
    changed = true
    return { ...node, x: placement.x, y: placement.y, fx: placement.x, fy: placement.y, vx: 0, vy: 0 } as GraphNode
  })
  return changed ? { ...graphData, nodes: nextNodes } : graphData
}
