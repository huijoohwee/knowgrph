import type { GraphData, JSONValue } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { controlLocalAnimation } from '@/features/three/xrAnimationMcpRuntime'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  readXrMotionReferencePlan,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import { XR_PHYSICS_GRAPH_METADATA_KEY } from '@/features/three/xrPhysicsModel'
import {
  readXrMotionReferenceRuntime,
  setXrMotionReferencePlayhead,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  attachXrPhysicsBody,
  hydrateXrPhysicsRuntime,
  pauseXrPhysicsRuntime,
  playXrPhysicsRuntime,
  readXrPhysicsRuntime,
} from '@/features/three/xrPhysicsRuntime'
import {
  hydrateCanonicalXrMotionReferenceRuntime,
  hydrateCanonicalXrPhysicsRuntime,
} from '@/features/three/XrMotionReferenceRuntimeBridge'

function physicsOwnershipFixture(nodeId: string, persistedPhysicsValue?: JSONValue): GraphData {
  const plan = readXrMotionReferencePlan({
    stageId: 'neutral-volume',
    durationSeconds: 2,
    subjects: [
      { id: 'playhead-mover', assetId: 'prop-crate', position: [0, 0, 0] },
      { id: 'playhead-performer', assetId: 'person-adult', position: [0, 0, -3] },
    ],
    cast: [
      {
        actorId: 'playhead-mover',
        label: 'Playhead Mover',
        marks: [
          { timeSeconds: 0, position: [0, 0, 0] },
          { timeSeconds: 2, position: [2, 0, 0] },
        ],
      },
      {
        actorId: 'playhead-performer',
        label: 'Playhead Performer',
        marks: [{ timeSeconds: 0, position: [0, 0, -3] }],
      },
    ],
  })
  return {
    type: 'Graph',
    nodes: [{ id: nodeId, label: 'Physics owner source', type: 'Concept', properties: {} }],
    edges: [],
    metadata: {
      [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serializeXrMotionReferencePlan(plan),
      ...(persistedPhysicsValue === undefined
        ? {}
        : { [XR_PHYSICS_GRAPH_METADATA_KEY]: persistedPhysicsValue }),
    },
  }
}

export function testXrPhysicsPlayheadHydrationPreservesActiveOwnership(): void {
  const previous = useGraphStore.getState()
  const previousSurface = {
    markdownDocumentName: previous.markdownDocumentName,
    markdownDocumentText: previous.markdownDocumentText,
    graphData: previous.graphData,
    selectedNodeId: previous.selectedNodeId,
  }
  const installSource = (nodeId: string, persistedPhysicsValue?: JSONValue) => {
    useGraphStore.setState({
      markdownDocumentName: 'Physics playhead ownership.md',
      markdownDocumentText: '# Physics playhead ownership',
      graphData: physicsOwnershipFixture(nodeId, persistedPhysicsValue),
      selectedNodeId: null,
    } as never)
    hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
  }

  try {
    installSource('owner-source-a')
    const markId = readXrMotionReferenceRuntime().plan.cast
      .find(track => track.actorId === 'playhead-mover')!
      .marks[0]!.id
    attachXrPhysicsBody({ subjectId: 'playhead-mover', patch: { mode: 'dynamic' } })
    playXrPhysicsRuntime()
    const activeOwner = readXrPhysicsRuntime()

    setXrMotionReferencePlayhead(1)
    const playingMove = controlLocalAnimation({
      operation: 'move-object',
      targetId: 'playhead-mover',
      markId,
      keys: ['d'],
      distanceMeters: 1,
    })
    const playing = readXrPhysicsRuntime()
    if (playingMove.ok
      || playingMove.motion?.status !== 'physics-owned'
      || playing.phase !== 'playing'
      || playing.ownerSourceSignature !== activeOwner.ownerSourceSignature
      || playing.sourceSignature !== activeOwner.sourceSignature) {
      throw new Error(`expected playhead hydration to preserve playing physics ownership, got ${JSON.stringify({ activeOwner, playing, playingMove })}`)
    }

    pauseXrPhysicsRuntime()
    setXrMotionReferencePlayhead(1.5)
    hydrateCanonicalXrPhysicsRuntime()
    const paused = readXrPhysicsRuntime()
    if (paused.phase !== 'paused'
      || paused.ownerSourceSignature !== activeOwner.ownerSourceSignature
      || paused.sourceSignature !== activeOwner.sourceSignature) {
      throw new Error(`expected playhead hydration to preserve paused physics ownership, got ${JSON.stringify({ activeOwner, paused })}`)
    }

    const characterMotion = controlLocalAnimation({
      operation: 'apply',
      presetId: 'dance',
      targetId: 'playhead-performer',
    })
    const afterAssignmentMove = controlLocalAnimation({
      operation: 'move-object',
      targetId: 'playhead-mover',
      markId,
      keys: ['d'],
      distanceMeters: 1,
    })
    const afterAssignment = readXrPhysicsRuntime()
    if (!characterMotion.ok
      || afterAssignmentMove.ok
      || afterAssignmentMove.motion?.status !== 'physics-owned'
      || afterAssignment.phase !== 'paused'
      || afterAssignment.ownerSourceSignature !== activeOwner.ownerSourceSignature) {
      throw new Error(`expected mark-preserving character motion metadata to retain paused physics ownership for the next control, got ${JSON.stringify({ afterAssignment, afterAssignmentMove, characterMotion })}`)
    }

    const motionSourceSignature = readXrMotionReferenceRuntime().sourceSignature
    const persistedPhysicsValue = {
      gravity: [0, -3, 0],
      bodies: { 'playhead-mover': { mode: 'dynamic' } },
    }
    const state = useGraphStore.getState()
    useGraphStore.setState({
      graphData: {
        ...state.graphData!,
        metadata: {
          ...state.graphData!.metadata,
          [XR_PHYSICS_GRAPH_METADATA_KEY]: persistedPhysicsValue,
        },
      },
    } as never)
    hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
    const persistedChanged = readXrPhysicsRuntime()
    if (readXrMotionReferenceRuntime().sourceSignature !== motionSourceSignature
      || persistedChanged.phase !== 'stopped'
      || persistedChanged.ownerSourceSignature === activeOwner.ownerSourceSignature
      || persistedChanged.world.gravity.join(',') !== '0,-3,0') {
      throw new Error(`expected same-motion-source persisted physics changes to stop and rehydrate transport, got ${JSON.stringify({ activeOwner, persistedChanged })}`)
    }

    playXrPhysicsRuntime()
    const persistedOwner = readXrPhysicsRuntime()
    const motion = readXrMotionReferenceRuntime()
    hydrateXrPhysicsRuntime({
      sceneKey: motion.sceneKey,
      sourceSignature: motion.sourceSignature,
      persistedValue: persistedPhysicsValue,
      subjects: [{ subjectId: 'playhead-mover', position: [1.5, 0, 0], sizeMeters: [1, 1, 1] }],
      staticColliders: [{
        id: 'source-collider',
        center: [0, 0, 0],
        sizeMeters: [2, 1, 2],
        friction: 0.4,
        restitution: 0.2,
        collisionGroup: 1,
        collisionMask: 0xffff,
        trigger: false,
      }],
    })
    const colliderChanged = readXrPhysicsRuntime()
    if (colliderChanged.phase !== 'stopped'
      || colliderChanged.ownerSourceSignature === persistedOwner.ownerSourceSignature
      || colliderChanged.staticColliderCount !== 1) {
      throw new Error(`expected same-motion-source collider changes to stop and rehydrate transport, got ${JSON.stringify({ colliderChanged, persistedOwner })}`)
    }

    playXrPhysicsRuntime()

    installSource('owner-source-b')
    const replaced = readXrPhysicsRuntime()
    if (replaced.phase !== 'stopped'
      || replaced.ownerSourceSignature === activeOwner.ownerSourceSignature
      || replaced.sourceSignature === activeOwner.sourceSignature
      || replaced.world.bodies.length !== 0) {
      throw new Error(`expected a distinct source identity to stop and rehydrate physics, got ${JSON.stringify({ activeOwner, replaced })}`)
    }
  } finally {
    useGraphStore.setState(previousSurface as never)
    hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
  }
}
