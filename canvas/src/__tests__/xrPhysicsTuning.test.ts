import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readXrPhysicsWorld } from '@/features/three/xrPhysicsModel'
import {
  captureXrPhysicsSimulation,
  createXrPhysicsSimulation,
  stepXrPhysicsSimulation,
} from '@/features/three/xrPhysicsStepper'
import {
  XR_PHYSICS_BODY_CONTACT_DRAG_RATE,
  XR_PHYSICS_SURFACE_CONTACT_DRAG_RATE,
  resolveXrPhysicsContactDrag,
} from '@/features/three/xrPhysicsContactDrag'
import { resolveXrSubjectFootprint } from '@/features/three/xrMotionReferenceSubjectPlacement'
import { resolveXrSceneLibraryAsset } from '@/features/three/xrSceneLibrary'
import { sampleXrMotionReferenceFacingY } from '@/features/three/xrMotionReferenceModel'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

function contactVelocityAfterOneSecond(rate: number, contact: 'floor' | 'body'): number {
  const world = readXrPhysicsWorld({
    gravity: [0, -9.81, 0],
    fixedStepSeconds: 1 / rate,
    floor: { enabled: contact === 'floor', height: 0, friction: 0.7, restitution: 0 },
    bodies: contact === 'floor'
      ? {
          'friction:surface': {
            mode: 'dynamic', sizeMeters: [1, 1, 1], spawnPosition: [0, 0, 0],
            initialVelocity: [1, 0, 0], friction: 0.7, restitution: 0, linearDamping: 0,
          },
        }
      : {
          'friction:base': {
            mode: 'static', sizeMeters: [10, 1, 10], spawnPosition: [0, 0, 0],
            friction: 0.7, restitution: 0,
          },
          'friction:rider': {
            mode: 'dynamic', sizeMeters: [1, 1, 1], spawnPosition: [0, 1, 0],
            initialVelocity: [1, 0, 0], friction: 0.7, restitution: 0, linearDamping: 0,
          },
        },
  })
  const simulation = createXrPhysicsSimulation(world)
  for (let tick = 0; tick < rate; tick += 1) {
    stepXrPhysicsSimulation({ simulation, world, stepSeconds: 1 / rate })
  }
  const subjectId = contact === 'floor' ? 'friction:surface' : 'friction:rider'
  return captureXrPhysicsSimulation(simulation).find(body => body.subjectId === subjectId)!.velocity[0]
}

function testContactDragIsFixedRateInvariant(): void {
  const rates = [30, 60, 120, 240]
  const expectedSurface = resolveXrPhysicsContactDrag(0.7, XR_PHYSICS_SURFACE_CONTACT_DRAG_RATE, 1)
  const expectedBody = resolveXrPhysicsContactDrag(0.7, XR_PHYSICS_BODY_CONTACT_DRAG_RATE, 1)
  for (const rate of rates) {
    near(contactVelocityAfterOneSecond(rate, 'floor'), expectedSurface, 1e-12, `surface drag must be invariant at ${rate} Hz`)
    near(contactVelocityAfterOneSecond(rate, 'body'), expectedBody, 1e-12, `body contact drag must be invariant at ${rate} Hz`)
  }
}

function airborneContactVelocityAfterOneSecond(rate: number): number {
  const world = readXrPhysicsWorld({
    gravity: [0, -0.01, 0],
    fixedStepSeconds: 1 / rate,
    floor: { enabled: true, height: 0, friction: 0.1, restitution: 0 },
    bodies: {
      'friction:airborne': {
        mode: 'dynamic', sizeMeters: [1, 1, 1], spawnPosition: [0, 1.1, 0],
        initialVelocity: [1, -2, 0], friction: 0.1, restitution: 0, linearDamping: 0,
      },
    },
  })
  const simulation = createXrPhysicsSimulation(world)
  for (let tick = 0; tick < rate; tick += 1) {
    stepXrPhysicsSimulation({ simulation, world, stepSeconds: 1 / rate })
  }
  return captureXrPhysicsSimulation(simulation)[0]!.velocity[0]
}

function testAirborneFirstImpactDragIsFixedRateInvariant(): void {
  const velocities = [30, 60, 120].map(airborneContactVelocityAfterOneSecond)
  const spread = Math.max(...velocities) - Math.min(...velocities)
  assert(spread < 5e-5, `first-impact contact drag must use only remaining contact time; got ${velocities.join(', ')}`)
}

function testBodyContactDragPreservesCommonModeVelocity(): void {
  const world = readXrPhysicsWorld({
    gravity: [0, 0, 0],
    fixedStepSeconds: 0.02,
    floor: { enabled: false },
    bodies: {
      left: {
        mode: 'dynamic', sizeMeters: [1, 1, 1], spawnPosition: [-0.51, 0, 0],
        initialVelocity: [1, 0, 1], friction: 0.7, restitution: 0, linearDamping: 0,
      },
      right: {
        mode: 'dynamic', sizeMeters: [1, 1, 1], spawnPosition: [0.51, 0, 0],
        initialVelocity: [-1, 0, 1], friction: 0.7, restitution: 0, linearDamping: 0,
      },
    },
  })
  const simulation = createXrPhysicsSimulation(world)
  stepXrPhysicsSimulation({ simulation, world, stepSeconds: 0.02 })
  const bodies = captureXrPhysicsSimulation(simulation)
  near(bodies.find(body => body.subjectId === 'left')!.velocity[2], 1, 1e-12, 'left common-mode tangent must remain unchanged')
  near(bodies.find(body => body.subjectId === 'right')!.velocity[2], 1, 1e-12, 'right common-mode tangent must remain unchanged')
}

function testRotatedFootprintSeedsPhysicsHydration(): void {
  const asset = resolveXrSceneLibraryAsset('vehicle-sedan')
  const footprint = resolveXrSubjectFootprint({
    id: 'rotation-probe',
    assetId: asset.id,
    category: asset.category,
    label: 'Rotation probe',
    color: asset.defaultColor,
    position: [0, 0, 0],
    rotationYDegrees: 90,
    scale: 2,
  })
  near(footprint.sizeMeters[0], asset.dimensionsMeters[2] * 2, 1e-12, '90-degree footprint must rotate depth onto X')
  near(footprint.sizeMeters[1], asset.dimensionsMeters[1] * 2, 1e-12, 'footprint must preserve scaled height')
  near(footprint.sizeMeters[2], asset.dimensionsMeters[0] * 2, 1e-12, '90-degree footprint must rotate width onto Z')
  near(footprint.halfX * 2, footprint.sizeMeters[0], 1e-12, 'half-width must match the physics size')
  near(footprint.halfZ * 2, footprint.sizeMeters[2], 1e-12, 'half-depth must match the physics size')

  const bridge = readFileSync(resolve(process.cwd(), 'src/features/three/XrMotionReferenceRuntimeBridge.tsx'), 'utf8')
  assert(
    bridge.includes('sampleXrMotionReferenceMarks(track.marks, motion.playheadSeconds)')
      && bridge.includes('sampleXrMotionReferenceFacingY(track.marks, motion.playheadSeconds)')
      && bridge.includes('sizeMeters: resolveXrSubjectFootprint(subject, facingYRadians).sizeMeters'),
    'physics hydration must reuse the authored position and canonical footprint at the current playhead',
  )
}

function testTurningPathSeedsCurrentPlayheadFacingAndKeepsItFixed(): void {
  const asset = resolveXrSceneLibraryAsset('vehicle-sedan')
  const subject = {
    id: 'turning-path-probe',
    assetId: asset.id,
    category: asset.category,
    label: 'Turning path probe',
    color: asset.defaultColor,
    position: [0, 0, 0] as const,
    rotationYDegrees: 0,
    scale: 1,
  }
  const marks = [
    { id: 'turn:0', timeSeconds: 0, position: [0, 0, 0] as const, transition: 'linear' as const, gait: 'wheeled' as const },
    { id: 'turn:1', timeSeconds: 1, position: [0, 0, 2] as const, transition: 'linear' as const, gait: 'wheeled' as const },
    { id: 'turn:2', timeSeconds: 2, position: [2, 0, 2] as const, transition: 'linear' as const, gait: 'wheeled' as const },
  ]
  const firstSegment = resolveXrSubjectFootprint(subject, sampleXrMotionReferenceFacingY(marks, 0.5))
  const currentSegment = resolveXrSubjectFootprint(subject, sampleXrMotionReferenceFacingY(marks, 1.5))
  near(firstSegment.sizeMeters[0], asset.dimensionsMeters[0], 1e-12, 'first path segment must face the sedan forward')
  near(currentSegment.sizeMeters[0], asset.dimensionsMeters[2], 1e-12, 'current turning segment must rotate depth onto X')

  const stageRuntime = readFileSync(resolve(process.cwd(), 'src/features/three/XrPhysicsStageRuntime.tsx'), 'utf8')
  assert(
    stageRuntime.includes('const captured = capturedRef.current.get(body.subjectId)!')
      && stageRuntime.includes('object.quaternion.copy(captured.quaternion)'),
    'active physics frames must reapply the captured ownership quaternion',
  )
  assert(
    stageRuntime.includes('capture.object.quaternion.copy(capture.quaternion)')
      && stageRuntime.includes("if (!paused && runtime.phase === 'stopped') restoreAuthoredTransforms()")
      && stageRuntime.includes('if (paused) return'),
    'stopping physics must restore the authored quaternion unless Game owns the frozen XR scene',
  )
}

export function testXrPhysicsTuningIsRateInvariantAndRotationAware(): void {
  testContactDragIsFixedRateInvariant()
  testAirborneFirstImpactDragIsFixedRateInvariant()
  testBodyContactDragPreservesCommonModeVelocity()
  testRotatedFootprintSeedsPhysicsHydration()
  testTurningPathSeedsCurrentPlayheadFacingAndKeepsItFixed()
}
