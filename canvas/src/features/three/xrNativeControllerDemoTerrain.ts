import {
  buildXrPhysicsStructureColliders,
  readXrPhysicsStaticColliders,
  type XrPhysicsStaticCollider,
} from './xrPhysicsModel'
import {
  resolveXrMotionReferenceColliderStructures,
  resolveXrMotionReferenceStage,
  type XrMotionReferenceStageId,
} from './xrSceneLibrary'
import { resolveXrTerrainPerimeter } from './xrTerrainPerimeter'

export const XR_NATIVE_CONTROLLER_DEMO_MAX_ALTITUDE_METERS = 24
export const XR_NATIVE_PLAYGROUND_HALF_EXTENT_X = 15.4
export const XR_NATIVE_PLAYGROUND_HALF_EXTENT_Z = 13.4
export const XR_NATIVE_PLAYGROUND_CENTER_Z = 1.1

function resolveNativePlaygroundColliders(): readonly XrPhysicsStaticCollider[] {
  const boundaryHeight = XR_NATIVE_CONTROLLER_DEMO_MAX_ALTITUDE_METERS + 4
  const boundaryY = boundaryHeight / 2
  return readXrPhysicsStaticColliders([
    { id: 'native-island-west', center: [-XR_NATIVE_PLAYGROUND_HALF_EXTENT_X, boundaryY, XR_NATIVE_PLAYGROUND_CENTER_Z], sizeMeters: [0.6, boundaryHeight, XR_NATIVE_PLAYGROUND_HALF_EXTENT_Z * 2] },
    { id: 'native-island-east', center: [XR_NATIVE_PLAYGROUND_HALF_EXTENT_X, boundaryY, XR_NATIVE_PLAYGROUND_CENTER_Z], sizeMeters: [0.6, boundaryHeight, XR_NATIVE_PLAYGROUND_HALF_EXTENT_Z * 2] },
    { id: 'native-island-north', center: [0, boundaryY, XR_NATIVE_PLAYGROUND_CENTER_Z - XR_NATIVE_PLAYGROUND_HALF_EXTENT_Z], sizeMeters: [XR_NATIVE_PLAYGROUND_HALF_EXTENT_X * 2 + 0.6, boundaryHeight, 0.6] },
    { id: 'native-island-south', center: [0, boundaryY, XR_NATIVE_PLAYGROUND_CENTER_Z + XR_NATIVE_PLAYGROUND_HALF_EXTENT_Z], sizeMeters: [XR_NATIVE_PLAYGROUND_HALF_EXTENT_X * 2 + 0.6, boundaryHeight, 0.6] },
    { id: 'native-treasure-block', center: [-3.4, 0.8, -6.3], sizeMeters: [2.5, 1.6, 1.5] },
    { id: 'native-grotto-block', center: [-10.7, 1.8, -7], sizeMeters: [3.4, 3.6, 5.2] },
    { id: 'native-cannon-left', center: [1.6, 0.6, -6.25], sizeMeters: [1.5, 1.2, 1.8] },
    { id: 'native-cannon-right', center: [4.15, 0.6, -6.25], sizeMeters: [1.5, 1.2, 1.8] },
    { id: 'native-rear-fence', center: [0, 0.95, -9.35], sizeMeters: [19, 1.9, 0.3] },
    { id: 'native-ramp-step-a', center: [-8.8, 0.12, 0.25], sizeMeters: [3.8, 0.24, 1.2] },
    { id: 'native-ramp-step-b', center: [-8.8, 0.32, -0.75], sizeMeters: [3.8, 0.64, 0.9] },
    { id: 'native-ramp-step-c', center: [-8.8, 0.55, -1.5], sizeMeters: [3.8, 1.1, 0.65] },
  ])
}

export function resolveXrNativeControllerTerrainPerimeter(
  stageId: XrMotionReferenceStageId,
) {
  const stage = resolveXrMotionReferenceStage(stageId)
  if (stage.id !== 'tropical-playground') return resolveXrTerrainPerimeter(stage)
  return resolveXrTerrainPerimeter({
    sizeMeters: [
      XR_NATIVE_PLAYGROUND_HALF_EXTENT_X * 2,
      XR_NATIVE_PLAYGROUND_HALF_EXTENT_Z * 2,
    ],
  }, [0, XR_NATIVE_PLAYGROUND_CENTER_Z])
}

export function resolveXrNativeControllerTerrainColliders(
  stageId: XrMotionReferenceStageId,
): readonly XrPhysicsStaticCollider[] {
  const stage = resolveXrMotionReferenceStage(stageId)
  if (stage.id === 'tropical-playground') return resolveNativePlaygroundColliders()
  const perimeter = resolveXrNativeControllerTerrainPerimeter(stage.id)
  const boundaryHeight = XR_NATIVE_CONTROLLER_DEMO_MAX_ALTITUDE_METERS + 4
  const boundaryY = boundaryHeight / 2
  const boundaries = readXrPhysicsStaticColliders([
    ...perimeter.edges.map(edge => ({
      id: `terrain:${stage.id}:${edge.side}`,
      center: [edge.centerMeters[0], boundaryY, edge.centerMeters[1]] as const,
      sizeMeters: [edge.sizeMeters[0], boundaryHeight, edge.sizeMeters[1]] as const,
    })),
    { id: 'native-treasure-block', center: [-3.4, 0.8, -6.3], sizeMeters: [2.5, 1.6, 1.5] },
    { id: 'native-cannon-left', center: [1.6, 0.6, -6.25], sizeMeters: [1.5, 1.2, 1.8] },
    { id: 'native-cannon-right', center: [4.15, 0.6, -6.25], sizeMeters: [1.5, 1.2, 1.8] },
  ])
  const structuralColliders = buildXrPhysicsStructureColliders(
    resolveXrMotionReferenceColliderStructures(stage),
  )
  return Object.freeze([...boundaries, ...structuralColliders])
}
