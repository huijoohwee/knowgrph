import type { XrMotionReferenceStagePreset } from './xrSceneLibrary'

export const XR_TERRAIN_BOUNDARY_THICKNESS_METERS = 0.6

export type XrTerrainPerimeterSide = 'west' | 'east' | 'north' | 'south'

export type XrTerrainPerimeterEdge = Readonly<{
  side: XrTerrainPerimeterSide
  centerMeters: readonly [number, number]
  sizeMeters: readonly [number, number]
}>

export type XrTerrainPerimeter = Readonly<{
  widthMeters: number
  depthMeters: number
  halfWidthMeters: number
  halfDepthMeters: number
  boundaryThicknessMeters: number
  edges: readonly XrTerrainPerimeterEdge[]
}>

function edge(
  side: XrTerrainPerimeterSide,
  centerMeters: readonly [number, number],
  sizeMeters: readonly [number, number],
): XrTerrainPerimeterEdge {
  return Object.freeze({
    side,
    centerMeters: Object.freeze([...centerMeters]) as readonly [number, number],
    sizeMeters: Object.freeze([...sizeMeters]) as readonly [number, number],
  })
}

export function resolveXrTerrainPerimeter(
  stage: Pick<XrMotionReferenceStagePreset, 'sizeMeters'>,
): XrTerrainPerimeter {
  const widthMeters = Math.max(1, Number(stage.sizeMeters[0]) || 1)
  const depthMeters = Math.max(1, Number(stage.sizeMeters[1]) || 1)
  const halfWidthMeters = widthMeters / 2
  const halfDepthMeters = depthMeters / 2
  const boundaryThicknessMeters = XR_TERRAIN_BOUNDARY_THICKNESS_METERS
  const edges = Object.freeze([
    edge('west', [-halfWidthMeters, 0], [boundaryThicknessMeters, depthMeters]),
    edge('east', [halfWidthMeters, 0], [boundaryThicknessMeters, depthMeters]),
    edge('north', [0, -halfDepthMeters], [widthMeters + boundaryThicknessMeters, boundaryThicknessMeters]),
    edge('south', [0, halfDepthMeters], [widthMeters + boundaryThicknessMeters, boundaryThicknessMeters]),
  ])
  return Object.freeze({
    widthMeters,
    depthMeters,
    halfWidthMeters,
    halfDepthMeters,
    boundaryThicknessMeters,
    edges,
  })
}
