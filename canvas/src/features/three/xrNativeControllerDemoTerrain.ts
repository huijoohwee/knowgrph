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

export function buildXrNativeControllerTerrainColliders(args: Readonly<{
  stageId: XrMotionReferenceStageId
  maxAltitudeMeters: number
  fallbackColliders: readonly XrPhysicsStaticCollider[]
}>): readonly XrPhysicsStaticCollider[] {
  const stage = resolveXrMotionReferenceStage(args.stageId)
  if (stage.id === 'tropical-playground') return args.fallbackColliders
  const perimeter = resolveXrTerrainPerimeter(stage)
  const boundaryHeight = args.maxAltitudeMeters + 4
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
