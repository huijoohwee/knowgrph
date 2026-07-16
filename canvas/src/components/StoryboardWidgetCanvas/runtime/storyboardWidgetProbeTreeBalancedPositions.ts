import { snapPointToGrid } from '@/lib/canvas/gridSnap'

type Point = { x: number; y: number }

export const readProbeTreeFootprintAspect = (positions: readonly Point[], cardWidth: number, cardHeight: number): number => {
  if (positions.length === 0) return 1
  const xValues = positions.map(position => position.x)
  const yValues = positions.map(position => position.y)
  const width = Math.max(...xValues) - Math.min(...xValues) + cardWidth
  const height = Math.max(...yValues) - Math.min(...yValues) + cardHeight
  return width / Math.max(1, height)
}

export const probeTreePositionsOverlap = (
  left: Point,
  right: Point,
  cardWidth: number,
  verticalTolerance: number,
): boolean => Math.abs(left.x - right.x) < cardWidth
  && Math.abs(left.y - right.y) < verticalTolerance

export function resolveBalancedProbeTreeBatchPositions(args: {
  count: number
  origin: Point
  gridSize: number
  columnOffset: number
  verticalStep: number
  waterfallStagger: number
  cardWidth: number
  cardHeight: number
  occupiedPositions: readonly Point[]
  footprintPositions: readonly Point[]
  startColumn: number
  baseWaterfallIndex?: number
  offsetPenaltyWeight?: number
  horizontalOffsetPenaltyWeight?: number
  verticalOffsetPenaltyWeight?: number
  maxVerticalOffsetSteps?: number
}): { positions: Point[]; columnSpan: number } {
  const count = Math.max(0, Math.floor(args.count))
  if (count === 0) return { positions: [], columnSpan: 0 }
  const rowsPerColumn = Math.max(1, Math.ceil(Math.sqrt(
    count * args.columnOffset / args.verticalStep,
  )))
  const columnCount = Math.ceil(count / rowsPerColumn)
  const positionsForOffset = (verticalOffset: number, horizontalOffset: number): Point[] => Array.from(
    { length: count },
    (_, index) => {
      const laneIndex = Math.floor(index / rowsPerColumn)
      const rowIndex = index % rowsPerColumn
      const laneSize = Math.min(rowsPerColumn, count - laneIndex * rowsPerColumn)
      return snapPointToGrid({
        x: args.origin.x + (args.startColumn + horizontalOffset + laneIndex) * args.columnOffset,
        y: args.origin.y
          + (rowIndex - (laneSize - 1) / 2) * args.verticalStep
          + ((args.baseWaterfallIndex || 0) + laneIndex) * args.waterfallStagger
          + verticalOffset,
      }, args.gridSize)
    },
  )
  const collides = (positions: readonly Point[]) => positions.some(position => (
    args.occupiedPositions.some(occupied => probeTreePositionsOverlap(
      position,
      occupied,
      args.cardWidth,
      args.verticalStep,
    ))
  ))
  let best: { positions: Point[]; score: number; columnSpan: number } | null = null
  for (let horizontalOffset = 0; horizontalOffset <= 12; horizontalOffset += 1) {
    for (let distance = 0; distance <= (args.maxVerticalOffsetSteps ?? 12); distance += 1) {
      const offsets = distance === 0 ? [0] : [distance, -distance]
      for (const offset of offsets) {
        const positions = positionsForOffset(offset * args.verticalStep, horizontalOffset)
        if (collides(positions)) continue
        const aspect = readProbeTreeFootprintAspect(
          [...args.footprintPositions, ...positions],
          args.cardWidth,
          args.cardHeight,
        )
        const offsetPenaltyWeight = args.offsetPenaltyWeight ?? 0.04
        const horizontalOffsetPenaltyWeight = args.horizontalOffsetPenaltyWeight ?? offsetPenaltyWeight
        const verticalOffsetPenaltyWeight = args.verticalOffsetPenaltyWeight ?? offsetPenaltyWeight
        const score = Math.abs(Math.log(Math.max(0.001, aspect)))
          + horizontalOffset * horizontalOffsetPenaltyWeight
          + distance * verticalOffsetPenaltyWeight
        if (!best || score < best.score) {
          best = { positions, score, columnSpan: horizontalOffset + columnCount }
        }
      }
    }
  }
  if (best) return { positions: best.positions, columnSpan: best.columnSpan }
  const maxOccupiedX = Math.max(args.origin.x, ...args.occupiedPositions.map(position => position.x))
  const firstBaseX = args.origin.x + args.startColumn * args.columnOffset
  const horizontalOffset = Math.max(0, Math.ceil(
    (maxOccupiedX + args.cardWidth - firstBaseX) / args.columnOffset,
  ))
  return {
    positions: positionsForOffset(0, horizontalOffset),
    columnSpan: horizontalOffset + columnCount,
  }
}
