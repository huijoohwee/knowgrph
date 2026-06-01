import type { GraphNode, JSONValue } from '@/lib/graph/types'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { WIDGET_BASE_SIZE } from '@/lib/canvas/overlayWidgetZoom'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function spreadMissingNodePositions(nodes: GraphNode[]): GraphNode[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return nodes
  const unresolvedIndexes: number[] = []
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const x = asFiniteNumber(node?.x)
    const y = asFiniteNumber(node?.y)
    if (x == null || y == null) {
      unresolvedIndexes.push(i)
      continue
    }
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (unresolvedIndexes.length === 0) return nodes

  const containsBuiltInWidgetOrPanel = nodes.some(node => {
    const type = String(node?.type || '').trim()
    return (
      type === FLOW_TEXT_GENERATION_NODE_TYPE_ID
      || type === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
      || type === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
      || type === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    )
  })
  const GAP_X = containsBuiltInWidgetOrPanel ? (WIDGET_BASE_SIZE.width + 120) : 360
  const GAP_Y = containsBuiltInWidgetOrPanel ? (WIDGET_BASE_SIZE.height + 120) : 260
  const occupied = new Set<string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const x = asFiniteNumber(nodes[i]?.x)
    const y = asFiniteNumber(nodes[i]?.y)
    if (x == null || y == null) continue
    occupied.add(`${Math.round(x)}:${Math.round(y)}`)
  }
  const centerX = Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) / 2 : 0
  const centerY = Number.isFinite(minY) && Number.isFinite(maxY) ? (minY + maxY) / 2 : 0
  const shouldPlaceOutsideOccupiedBand =
    containsBuiltInWidgetOrPanel
    && occupied.size > 0
    && Number.isFinite(maxX)
    && Number.isFinite(centerX)
    && Number.isFinite(minY)
  const outsideBandCols = shouldPlaceOutsideOccupiedBand
    ? Math.max(1, Math.ceil(Math.sqrt(unresolvedIndexes.length)))
    : 1
  const outsideBandRows = shouldPlaceOutsideOccupiedBand
    ? Math.max(1, Math.ceil(unresolvedIndexes.length / outsideBandCols))
    : 1
  const outsideBandStartX = shouldPlaceOutsideOccupiedBand
    ? Math.round(centerX - ((outsideBandCols - 1) * GAP_X) / 2)
    : 0
  const outsideBandStartY = shouldPlaceOutsideOccupiedBand
    ? Math.round(minY - outsideBandRows * GAP_Y)
    : 0

  let cursor = 0
  for (let i = 0; i < unresolvedIndexes.length; i += 1) {
    const nodeIndex = unresolvedIndexes[i]!
    const placed = findNextMissingNodePosition({
      cursor,
      occupied,
      shouldPlaceOutsideOccupiedBand,
      outsideBandCols,
      outsideBandStartX,
      outsideBandStartY,
      centerX,
      centerY,
      gapX: GAP_X,
      gapY: GAP_Y,
    })
    cursor = placed.nextCursor
    const baseProps = isRecord(nodes[nodeIndex]?.properties)
      ? ({ ...(nodes[nodeIndex]!.properties as Record<string, JSONValue>) } as Record<string, JSONValue>)
      : ({} as Record<string, JSONValue>)
    if (typeof baseProps['visual:xIndex'] === 'undefined') {
      baseProps['visual:xIndex'] = Math.floor(placed.x / Math.max(320, GAP_X)) as unknown as JSONValue
    }
    if (typeof baseProps['visual:yIndex'] === 'undefined') {
      baseProps['visual:yIndex'] = Math.floor(placed.y / Math.max(220, GAP_Y)) as unknown as JSONValue
    }
    baseProps['frontmatter:autoSeededPos'] = true as unknown as JSONValue
    nodes[nodeIndex] = {
      ...(nodes[nodeIndex] as GraphNode),
      x: placed.x,
      y: placed.y,
      properties: baseProps,
    }
  }

  return nodes
}

function findNextMissingNodePosition(args: {
  cursor: number
  occupied: Set<string>
  shouldPlaceOutsideOccupiedBand: boolean
  outsideBandCols: number
  outsideBandStartX: number
  outsideBandStartY: number
  centerX: number
  centerY: number
  gapX: number
  gapY: number
}): { x: number; y: number; nextCursor: number } {
  let cursor = args.cursor
  while (true) {
    const next = args.shouldPlaceOutsideOccupiedBand
      ? readOutsideBandPosition(args, cursor)
      : readSpiralPosition(args, cursor)
    cursor += 1
    const key = `${next.x}:${next.y}`
    if (args.occupied.has(key)) continue
    args.occupied.add(key)
    return { ...next, nextCursor: cursor }
  }
}

function readOutsideBandPosition(args: {
  outsideBandCols: number
  outsideBandStartX: number
  outsideBandStartY: number
  gapX: number
  gapY: number
}, cursor: number): { x: number; y: number } {
  const col = cursor % args.outsideBandCols
  const row = Math.floor(cursor / args.outsideBandCols)
  return {
    x: Math.round(args.outsideBandStartX + col * args.gapX),
    y: Math.round(args.outsideBandStartY + row * args.gapY),
  }
}

function readSpiralPosition(args: {
  centerX: number
  centerY: number
  gapX: number
  gapY: number
}, cursor: number): { x: number; y: number } {
  const ring = Math.floor(Math.sqrt(cursor))
  const side = ring * 2 + 1
  const max = side * side
  const leg = Math.max(1, side - 1)
  const offset = max - cursor
  const legIdx = Math.floor(offset / leg)
  const legPos = offset % leg
  let gx = 0
  let gy = 0
  if (ring === 0) {
    gx = 0
    gy = 0
  } else if (legIdx === 0) {
    gx = ring - legPos
    gy = -ring
  } else if (legIdx === 1) {
    gx = -ring
    gy = -ring + legPos
  } else if (legIdx === 2) {
    gx = -ring + legPos
    gy = ring
  } else {
    gx = ring
    gy = ring - legPos
  }
  return {
    x: Math.round(args.centerX + gx * args.gapX),
    y: Math.round(args.centerY + gy * args.gapY),
  }
}
