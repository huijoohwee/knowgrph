import assert from 'node:assert/strict'
import test from 'node:test'

import { PlanarPhysicsEngine } from '../features/physics/planarPhysicsEngine'
import {
  PLANAR_PHYSICS_SNAPSHOT_FORMAT,
  PLANAR_PHYSICS_SNAPSHOT_VERSION,
  type PlanarPhysicsOptions,
} from '../features/physics/planarPhysicsTypes'

const FIXED_STEP_SECONDS = 0.25

function buildMotionWorld(): PlanarPhysicsEngine {
  return new PlanarPhysicsEngine({
    fixedStepSeconds: FIXED_STEP_SECONDS,
    maxSubSteps: 8,
    gravity: [0, -8],
    bodies: [
      { id: 'anchor', motion: 'static', position: [0, -4] },
      {
        id: 'falling',
        motion: 'dynamic',
        position: [0, 3],
        linearVelocity: [2, 0],
        angularVelocity: 2,
        mass: 2,
        rotationalMass: 4,
      },
      { id: 'platform', motion: 'kinematic', position: [-3, 1], linearVelocity: [1, 0], angularVelocity: -1 },
    ],
    colliders: [
      { id: 'anchor-shape', bodyId: 'anchor', shape: { kind: 'box', halfSize: [2, 0.5] } },
      { id: 'falling-shape', bodyId: 'falling', shape: { kind: 'circle', radius: 0.4 } },
      { id: 'platform-shape', bodyId: 'platform', shape: { kind: 'box', halfSize: [1, 0.2] } },
    ],
  })
}

test('planar engine keeps body ownership separate and advances each motion type on fixed ticks', () => {
  const engine = buildMotionWorld()
  assert.equal(engine.readCollider('falling-shape')?.bodyId, 'falling')
  assert.equal(engine.advance(FIXED_STEP_SECONDS / 2).steps, 0)
  assert.deepEqual(engine.readBody('falling')?.position, [0, 3])

  const result = engine.advance(FIXED_STEP_SECONDS / 2)
  assert.deepEqual(result, { steps: 1, tick: 1, remainderSeconds: 0 })
  assert.deepEqual(engine.readBody('anchor')?.position, [0, -4])
  assert.deepEqual(engine.readBody('platform')?.position, [-2.75, 1])
  assert.equal(engine.readBody('platform')?.rotationRadians, -0.25)
  assert.deepEqual(engine.readBody('falling')?.linearVelocity, [2, -2])
  assert.deepEqual(engine.readBody('falling')?.position, [0.5, 2.5])
  assert.equal(engine.readBody('falling')?.rotationRadians, 0.5)
})

test('impulses update only dynamic linear and angular state', () => {
  const engine = buildMotionWorld()
  assert.equal(engine.applyImpulse('anchor', [4, 0]), false)
  assert.equal(engine.applyImpulse('platform', [4, 0]), false)
  assert.equal(engine.applyImpulse('falling', [4, 2], [0, 4]), true)
  assert.deepEqual(engine.readBody('falling')?.linearVelocity, [4, 1])
  assert.equal(engine.readBody('falling')?.angularVelocity, 1)
  assert.equal(engine.applyAngularImpulse('falling', 4), true)
  assert.equal(engine.readBody('falling')?.angularVelocity, 2)
  assert.equal(engine.setKinematicVelocity('platform', [0, 2], 3), true)
  assert.equal(engine.setKinematicVelocity('falling', [0, 2], 3), false)
})

test('box and circle contacts resolve predictably and emit buffered lifecycle events', () => {
  const engine = new PlanarPhysicsEngine({
    fixedStepSeconds: 0.5,
    maxSubSteps: 8,
    gravity: [0, 0],
    bodies: [
      { id: 'wall', motion: 'static', position: [0, 0], restitution: 1 },
      { id: 'ball', motion: 'dynamic', position: [-1.5, 0], linearVelocity: [2, 0], restitution: 1 },
    ],
    colliders: [
      { id: 'wall-box', bodyId: 'wall', shape: { kind: 'box', halfSize: [0.5, 1] } },
      { id: 'ball-circle', bodyId: 'ball', shape: { kind: 'circle', radius: 0.5 } },
    ],
  })
  engine.stepFixed()
  assert.equal(engine.readBody('ball')?.linearVelocity[0], -2)
  assert.deepEqual(engine.drainEvents().map(event => event.kind), ['collision-began'])
  assert.deepEqual(engine.drainEvents(), [])
  engine.stepFixed()
  assert.deepEqual(engine.drainEvents().map(event => event.kind), ['collision-ended'])
})

test('collision filters prevent responses while sensors report entry and exit without blocking motion', () => {
  const options: PlanarPhysicsOptions = {
    fixedStepSeconds: 0.5,
    maxSubSteps: 8,
    gravity: [0, 0],
    bodies: [
      { id: 'runner', motion: 'kinematic', position: [-2, 0], linearVelocity: [2, 0] },
      { id: 'sensor-owner', motion: 'static', position: [0, 0] },
      { id: 'filtered-owner', motion: 'static', position: [2, 0] },
    ],
    colliders: [
      { id: 'runner-circle', bodyId: 'runner', shape: { kind: 'circle', radius: 0.25 }, collisionLayer: 1, collisionMask: 1 },
      { id: 'zone', bodyId: 'sensor-owner', shape: { kind: 'box', halfSize: [0.75, 0.75] }, sensor: true, collisionLayer: 1, collisionMask: 1 },
      { id: 'ignored', bodyId: 'filtered-owner', shape: { kind: 'box', halfSize: [0.75, 0.75] }, collisionLayer: 2, collisionMask: 2 },
    ],
  }
  const engine = new PlanarPhysicsEngine(options)
  engine.stepFixed()
  assert.deepEqual(engine.drainEvents().map(event => event.kind), ['sensor-began'])
  engine.stepFixed()
  assert.deepEqual(engine.drainEvents(), [])
  engine.stepFixed()
  assert.deepEqual(engine.drainEvents(), [])
  engine.stepFixed()
  assert.deepEqual(engine.readBody('runner')?.position, [2, 0])
  assert.deepEqual(engine.drainEvents().map(event => event.kind), ['sensor-ended'])
})

test('point, overlap, and ray queries share stable shape projection and filtering', () => {
  const engine = new PlanarPhysicsEngine({
    fixedStepSeconds: 1 / 60,
    maxSubSteps: 8,
    gravity: [0, 0],
    bodies: [
      { id: 'circle-body', motion: 'static', position: [0, 0] },
      { id: 'box-body', motion: 'static', position: [4, 0], rotationRadians: Math.PI / 4 },
      { id: 'sensor-body', motion: 'static', position: [2, 2] },
    ],
    colliders: [
      { id: 'circle', bodyId: 'circle-body', shape: { kind: 'circle', radius: 1 }, collisionLayer: 1 },
      { id: 'rotated-box', bodyId: 'box-body', shape: { kind: 'box', halfSize: [1, 0.5] }, collisionLayer: 2 },
      { id: 'sensor', bodyId: 'sensor-body', shape: { kind: 'circle', radius: 0.5 }, sensor: true },
    ],
  })
  assert.deepEqual(engine.queryPoint([0.5, 0]), ['circle'])
  assert.deepEqual(engine.queryPoint([2, 2], { includeSensors: false }), [])
  assert.deepEqual(engine.queryOverlap({
    position: [3.1, 0],
    shape: { kind: 'circle', radius: 0.4 },
    filter: { collisionLayer: 2, collisionMask: 2 },
  }), ['rotated-box'])

  const hits = engine.castRay({ origin: [-3, 0], direction: [10, 0], maxDistance: 10, filter: { includeSensors: false } })
  assert.deepEqual(hits.map(hit => hit.colliderId), ['circle', 'rotated-box'])
  assert.equal(hits[0].distance, 2)
  assert.deepEqual(hits[0].point, [-1, 0])
  assert.deepEqual(engine.castRay({
    origin: [-3, 0],
    direction: [1, 0],
    maxDistance: 10,
    filter: { excludeColliderIds: ['circle', 'rotated-box'] },
  }), [])
})

test('dimension-tagged snapshots restore exact deterministic continuation including buffered events', () => {
  const engine = new PlanarPhysicsEngine({
    fixedStepSeconds: 0.25,
    maxSubSteps: 8,
    gravity: [0, 0],
    bodies: [
      { id: 'mover', motion: 'kinematic', position: [-1, 0], linearVelocity: [1, 0], angularVelocity: 0.5 },
      { id: 'zone-owner', motion: 'static', position: [0, 0] },
    ],
    colliders: [
      { id: 'mover-shape', bodyId: 'mover', shape: { kind: 'box', halfSize: [0.25, 0.25] } },
      { id: 'zone-shape', bodyId: 'zone-owner', shape: { kind: 'circle', radius: 0.6 }, sensor: true },
    ],
  })
  engine.advance(0.625)
  const snapshot = JSON.parse(JSON.stringify(engine.captureSnapshot()))
  assert.equal(snapshot.format, PLANAR_PHYSICS_SNAPSHOT_FORMAT)
  assert.equal(snapshot.version, PLANAR_PHYSICS_SNAPSHOT_VERSION)
  assert.equal(snapshot.dimension, '2d')
  assert.deepEqual(snapshot.bodies.map((body: { id: string }) => body.id), ['mover', 'zone-owner'])
  assert.deepEqual(snapshot.pendingEvents.map((event: { kind: string }) => event.kind), ['sensor-began'])

  const restored = PlanarPhysicsEngine.fromSnapshot(snapshot)
  assert.deepEqual(restored.captureSnapshot(), engine.captureSnapshot())
  engine.advance(0.625)
  restored.advance(0.625)
  assert.deepEqual(restored.captureSnapshot(), engine.captureSnapshot())
  assert.deepEqual(restored.drainEvents(), engine.drainEvents())

  assert.throws(() => PlanarPhysicsEngine.fromSnapshot({ ...snapshot, dimension: '3d' }), /unsupported/)
  assert.throws(() => PlanarPhysicsEngine.fromSnapshot({ ...snapshot, version: 2 }), /unsupported/)
  const wrongOwner = structuredClone(snapshot)
  wrongOwner.activeInteractions[0].bodyIds[0] = 'zone-owner'
  assert.throws(() => PlanarPhysicsEngine.fromSnapshot(wrongOwner), /body ownership/)
  const wrongSensor = structuredClone(snapshot)
  wrongSensor.activeInteractions[0].sensor = false
  assert.throws(() => PlanarPhysicsEngine.fromSnapshot(wrongSensor), /sensor ownership/)
})

test('read projections and snapshots cannot mutate collider geometry inside the world', () => {
  const engine = new PlanarPhysicsEngine({
    fixedStepSeconds: 0.1,
    maxSubSteps: 1,
    gravity: [0, 0],
    bodies: [{ id: 'body', motion: 'static', position: [0, 0] }],
    colliders: [{
      id: 'box',
      bodyId: 'body',
      shape: { kind: 'box', halfSize: [2, 1], offset: [3, 4] },
    }],
  })
  const readShape = engine.readCollider('box')!.shape as unknown as { halfSize: number[]; offset: number[] }
  readShape.halfSize[0] = 99
  readShape.offset[0] = 99
  const snapshotShape = engine.captureSnapshot().colliders[0].shape as unknown as { halfSize: number[]; offset: number[] }
  snapshotShape.halfSize[1] = 99
  snapshotShape.offset[1] = 99

  assert.deepEqual(engine.readCollider('box')!.shape, {
    kind: 'box',
    halfSize: [2, 1],
    offset: [3, 4],
    rotationRadians: 0,
  })
})

test('bounded stepping retains its complete backlog for lossless zero-time drains', () => {
  const engine = new PlanarPhysicsEngine({
    fixedStepSeconds: 0.1,
    maxSubSteps: 3,
    gravity: [0, 0],
  })
  const first = engine.advance(1)
  assert.equal(first.steps, 3)
  assert.equal(first.tick, 3)
  assert.ok(Math.abs(first.tick * 0.1 + first.remainderSeconds - 1) < 1e-12)
  assert.deepEqual([engine.advance(0).steps, engine.advance(0).steps, engine.advance(0).steps], [3, 3, 1])
  const drained = engine.captureSnapshot()
  assert.equal(drained.tick, 10)
  assert.equal(drained.remainderSeconds, 0)
  assert.equal(drained.settings.maxSubSteps, 3)
})

test('snapshots use explicit code-unit order for arbitrary case and non-ASCII identifiers', () => {
  const ids = ['é', 'a', 'Å', 'Z']
  const engine = new PlanarPhysicsEngine({
    fixedStepSeconds: 0.1,
    maxSubSteps: 1,
    gravity: [0, 0],
    bodies: ids.map(id => ({ id: `body-${id}`, motion: 'static' as const, position: [0, 0] })),
    colliders: ids.map(id => ({
      id,
      bodyId: `body-${id}`,
      shape: { kind: 'circle' as const, radius: 1 },
      sensor: true,
    })),
  })
  engine.stepFixed()
  const snapshot = engine.captureSnapshot()
  assert.deepEqual(snapshot.bodies.map(body => body.id), ['body-Z', 'body-a', 'body-Å', 'body-é'])
  const expectedPairs = ['Z/a', 'Z/Å', 'Z/é', 'a/Å', 'a/é', 'Å/é']
  assert.deepEqual(snapshot.activeInteractions.map(pair => pair.colliderIds.join('/')), expectedPairs)
  assert.deepEqual(snapshot.pendingEvents.map(event => event.colliderIds.join('/')), expectedPairs)
})

test('invalid ownership, shapes, bitfields, and time inputs fail before simulation', () => {
  assert.throws(() => new PlanarPhysicsEngine({
    fixedStepSeconds: 1 / 60,
    maxSubSteps: 8,
    gravity: [0, 0],
    bodies: [],
    colliders: [{ id: 'orphan', bodyId: 'missing', shape: { kind: 'circle', radius: 1 } }],
  }), /unknown body/)
  assert.throws(() => new PlanarPhysicsEngine({
    fixedStepSeconds: 1 / 60,
    maxSubSteps: 8,
    gravity: [0, 0],
    bodies: [{ id: 'body', motion: 'dynamic', position: [0, 0] }],
    colliders: [{ id: 'shape', bodyId: 'body', shape: { kind: 'box', halfSize: [0, 1] } }],
  }), /halfSize/)
  const engine = buildMotionWorld()
  assert.throws(() => new PlanarPhysicsEngine({ fixedStepSeconds: 1, maxSubSteps: 0, gravity: [0, 0] }), /positive safe integer/)
  assert.throws(() => engine.advance(-1), /negative/)
  assert.throws(() => engine.castRay({ origin: [0, 0], direction: [0, 0], maxDistance: 1 }), /cannot be zero/)
  assert.throws(() => engine.queryPoint([0, 0], { collisionLayer: 2 ** 32 }), /unsigned 32-bit/)
  const platformBefore = engine.readBody('platform')
  assert.throws(() => engine.setKinematicVelocity('platform', [9, 9], Number.NaN), /finite/)
  assert.deepEqual(engine.readBody('platform'), platformBefore)
})
