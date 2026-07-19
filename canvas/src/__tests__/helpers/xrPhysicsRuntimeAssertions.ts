import {
  XR_PHYSICS_COLLISION_BITFIELD_MAX,
  readXrPhysicsStaticColliders,
  readXrPhysicsWorld,
} from '@/features/three/xrPhysicsModel'
import { normalizeXrPhysicsControl } from '@/features/three/xrSceneInteractiveInvocation'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function assertCollisionBitfieldDomainMatchesUiAndMcp(): void {
  const defaults = readXrPhysicsWorld({
    bodies: {
      'default-body': { mode: 'dynamic' },
      'bounded-body': {
        mode: 'dynamic',
        collisionGroup: XR_PHYSICS_COLLISION_BITFIELD_MAX + 1,
        collisionMask: 0xffffffff,
      },
    },
  })
  const defaultBody = defaults.bodies.find(body => body.subjectId === 'default-body')!
  const boundedBody = defaults.bodies.find(body => body.subjectId === 'bounded-body')!
  assert(defaultBody.collisionGroup === 1, 'default physics body must remain in collision group 1')
  assert(defaultBody.collisionMask === XR_PHYSICS_COLLISION_BITFIELD_MAX, 'default physics body mask must fit the editable UI and MCP domain')
  assert(defaults.floor.collisionMask === XR_PHYSICS_COLLISION_BITFIELD_MAX, 'default floor mask must share the body collision domain')
  assert(boundedBody.collisionGroup === XR_PHYSICS_COLLISION_BITFIELD_MAX, 'body groups above the shared domain must normalize to its maximum')
  assert(boundedBody.collisionMask === XR_PHYSICS_COLLISION_BITFIELD_MAX, 'body masks above the shared domain must normalize to its maximum')
  const [collider] = readXrPhysicsStaticColliders([{ id: 'default-collider' }])
  assert(collider?.collisionMask === XR_PHYSICS_COLLISION_BITFIELD_MAX, 'default static collider mask must share the body collision domain')
  assert(normalizeXrPhysicsControl({
    scope: 'body',
    operation: 'configure',
    subjectId: 'default-body',
    collisionMask: XR_PHYSICS_COLLISION_BITFIELD_MAX,
  })?.collisionMask === XR_PHYSICS_COLLISION_BITFIELD_MAX, 'MCP control must accept the editable collision maximum')
  assert(normalizeXrPhysicsControl({
    scope: 'body',
    operation: 'configure',
    subjectId: 'default-body',
    collisionMask: XR_PHYSICS_COLLISION_BITFIELD_MAX + 1,
  }) === null, 'MCP control must reject collision masks outside the shared domain')
}
