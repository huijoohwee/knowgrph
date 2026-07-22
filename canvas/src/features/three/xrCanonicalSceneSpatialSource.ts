import {
  buildXrPhysicsStructureColliders,
  type XrPhysicsStaticCollider,
} from './xrPhysicsModel'
import {
  resolveXrNativeControllerTerrainColliders,
  resolveXrNativeControllerTerrainPerimeter,
} from './xrNativeControllerDemoTerrain'
import {
  resolveXrMotionReferenceColliderStructures,
  resolveXrMotionReferenceStage,
  type XrMotionReferenceStageId,
  type XrMotionReferenceStagePreset,
} from './xrSceneLibrary'
import { resolveXrTerrainPerimeter, type XrTerrainPerimeter } from './xrTerrainPerimeter'

export type XrCanonicalSceneProjection = 'authored' | 'native-controller'

export type XrCanonicalSceneSpatialSource = Readonly<{
  stage: XrMotionReferenceStagePreset
  perimeter: XrTerrainPerimeter
  projection: XrCanonicalSceneProjection
  staticColliders: readonly XrPhysicsStaticCollider[]
}>

export function resolveXrCanonicalSceneProjection(input: Readonly<{
  physicsRunReady: boolean
}>): XrCanonicalSceneProjection {
  return input.physicsRunReady ? 'native-controller' : 'authored'
}

export function resolveXrCanonicalSceneSpatialSource(input: Readonly<{
  projection: XrCanonicalSceneProjection
  stageId: XrMotionReferenceStageId
}>): XrCanonicalSceneSpatialSource {
  const stage = resolveXrMotionReferenceStage(input.stageId)
  const staticColliders = input.projection === 'native-controller'
    ? resolveXrNativeControllerTerrainColliders(stage.id)
    : buildXrPhysicsStructureColliders(resolveXrMotionReferenceColliderStructures(stage))
  return Object.freeze({
    stage,
    perimeter: input.projection === 'native-controller'
      ? resolveXrNativeControllerTerrainPerimeter(stage.id)
      : resolveXrTerrainPerimeter(stage),
    projection: input.projection,
    staticColliders,
  })
}
