import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  readXrMotionReferencePlan,
  serializeXrMotionReferencePlan,
  type XrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import {
  dropXrMotionReferenceCastMark,
  hydrateXrMotionReferenceRuntime,
  readXrMotionReferenceRuntime,
  setXrMotionReferenceCastMarkArmed,
  setXrMotionReferenceCastTransition,
  setXrMotionReferencePlayhead,
  setXrMotionReferenceSubjectTransform,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  hydrateXrPhysicsRuntime,
  playXrPhysicsRuntime,
  readXrPhysicsRuntime,
  readXrPhysicsRuntimeFrame,
  stopXrPhysicsRuntime,
} from '@/features/three/xrPhysicsRuntime'
import { resolveXrSubjectFootprint } from '@/features/three/xrMotionReferenceSubjectPlacement'
import {
  isXrSubjectMotionPositionSafe,
  XR_SUBJECT_MOTION_COLLISION_GAP_METERS,
} from '@/features/three/xrSubjectMotionConstraints'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function legacyFixturePlan(): XrMotionReferencePlan {
  return readXrMotionReferencePlan({
    stageId: 'neutral-volume',
    durationSeconds: 5,
    subjects: [
      { id: 'moving-crate', assetId: 'prop-crate', label: 'Mover', position: [-3, 0, 0] },
      { id: 'peer-crate', assetId: 'prop-crate', label: 'Peer', position: [0, 0, 0] },
    ],
    cast: [{
      actorId: 'moving-crate',
      label: 'Mover',
      marks: [{ timeSeconds: 0, position: [-3, 0, 0], transition: 'linear', gait: 'walk' }],
    }],
  })
}

function hydrateLegacyFixture(sceneKey: string, physicsOwned = false): void {
  const plan = legacyFixturePlan()
  hydrateXrMotionReferenceRuntime({
    sceneKey,
    nodes: [],
    persistedValue: serializeXrMotionReferencePlan(plan),
  })
  hydrateXrPhysicsRuntime({
    sceneKey,
    subjects: plan.subjects.map(subject => ({
      subjectId: subject.id,
      position: subject.position,
      sizeMeters: resolveXrSubjectFootprint(subject).sizeMeters,
    })),
    persistedValue: physicsOwned
      ? { gravity: [0, 0, 0], floor: { enabled: false }, bodies: { 'moving-crate': { mode: 'dynamic' } } }
      : null,
  })
  if (physicsOwned) playXrPhysicsRuntime()
}

function hydrateCrossingFixture(sceneKey: string): void {
  const plan = readXrMotionReferencePlan({
    stageId: 'neutral-volume',
    durationSeconds: 4,
    subjects: [
      { id: 'moving-crate', assetId: 'prop-crate', label: 'Mover', position: [-3, 0, 3] },
      { id: 'peer-crate', assetId: 'prop-crate', label: 'Peer', position: [0, 0, 0] },
    ],
    cast: [{ actorId: 'moving-crate', label: 'Mover', marks: [
      { timeSeconds: 0, position: [-3, 0, 3], transition: 'linear', gait: 'walk' },
      { timeSeconds: 4, position: [3, 0, 3], transition: 'linear', gait: 'walk' },
    ] }],
  })
  hydrateXrMotionReferenceRuntime({
    sceneKey,
    nodes: [],
    persistedValue: serializeXrMotionReferencePlan(plan),
  })
  hydrateXrPhysicsRuntime({ sceneKey, subjects: [], persistedValue: null })
}

function assertMovingCrateSafe(label: string, expectedMarkTime?: number): void {
  const runtime = readXrMotionReferenceRuntime()
  const physics = readXrPhysicsRuntime()
  const subject = runtime.plan.subjects.find(candidate => candidate.id === 'moving-crate')!
  const peer = runtime.plan.subjects.find(candidate => candidate.id === 'peer-crate')!
  const movingFootprint = resolveXrSubjectFootprint(subject)
  const peerFootprint = resolveXrSubjectFootprint(peer)
  const track = runtime.plan.cast.find(candidate => candidate.actorId === subject.id)!
  const mark = expectedMarkTime === undefined
    ? track.marks[0]!
    : track.marks.find(candidate => candidate.timeSeconds === expectedMarkTime)!
  assert(mark, `${label}: expected a persisted cast mark at ${expectedMarkTime}`)
  assert(isXrSubjectMotionPositionSafe({
    actorId: subject.id,
    physics,
    physicsFrame: physics.phase === 'stopped' ? undefined : readXrPhysicsRuntimeFrame(),
    plan: runtime.plan,
    position: mark.position,
    timeSeconds: mark.timeSeconds,
  }), `${label}: expected the persisted mark to satisfy the shared subject-motion owner`)
  const overlapX = Math.abs(mark.position[0] - peer.position[0])
    < movingFootprint.halfX + peerFootprint.halfX + XR_SUBJECT_MOTION_COLLISION_GAP_METERS
  const overlapY = Math.abs((mark.position[1] + movingFootprint.halfY) - (peer.position[1] + peerFootprint.halfY))
    < movingFootprint.halfY + peerFootprint.halfY + XR_SUBJECT_MOTION_COLLISION_GAP_METERS
  const overlapZ = Math.abs(mark.position[2] - peer.position[2])
    < movingFootprint.halfZ + peerFootprint.halfZ + XR_SUBJECT_MOTION_COLLISION_GAP_METERS
  assert(!(overlapX && overlapY && overlapZ), `${label}: persisted mover and peer bounds must not overlap`)
  assert(mark.position.join('|') !== '0|0|0', `${label}: forbidden requested overlap must not persist`)
}

function assertOneSafePublish(run: () => void, label: string, expectedMarkTime?: number): void {
  let notifications = 0
  const unsubscribe = subscribeXrMotionReferenceRuntime(() => {
    notifications += 1
    assertMovingCrateSafe(`${label} notification`, expectedMarkTime)
  })
  try {
    run()
  } finally {
    unsubscribe()
  }
  assert(notifications === 1, `${label}: expected one atomic safe runtime publish, got ${notifications}`)
}

function testSubjectTransformMovesSubjectAndMarksWithoutOverlap(): void {
  hydrateLegacyFixture('legacy-writer:subject-transform')
  assertOneSafePublish(() => {
    setXrMotionReferenceSubjectTransform({
      subjectId: 'moving-crate',
      position: [0, 0, 0],
      rotationYDegrees: 12,
    })
  }, 'subject transform')
  const runtime = readXrMotionReferenceRuntime()
  const subject = runtime.plan.subjects.find(candidate => candidate.id === 'moving-crate')!
  const mark = runtime.plan.cast.find(candidate => candidate.actorId === subject.id)!.marks[0]!
  assert(subject.position.join('|') === mark.position.join('|'), 'subject transform must retain one constrained delta for the subject and every authored mark')
  assert(subject.position[0] > -3 && subject.position[0] < 0, `subject transform should make constrained partial progress, got ${subject.position}`)
}

function testStageDropDoesNotPersistRequestedOverlap(): void {
  hydrateLegacyFixture('legacy-writer:stage-drop')
  setXrMotionReferencePlayhead(2)
  setXrMotionReferenceCastMarkArmed(true)
  assertOneSafePublish(() => dropXrMotionReferenceCastMark([0, 0, 0]), 'stage mark drop', 2)
  const track = readXrMotionReferenceRuntime().plan.cast.find(candidate => candidate.actorId === 'moving-crate')!
  assert(track.marks.length === 2, `stage mark drop should persist one constrained mark, got ${track.marks.length}`)
  const dropped = track.marks.find(mark => mark.timeSeconds === 2)!
  assert(dropped.position[0] > -3 && dropped.position[0] < 0, `stage mark drop should make constrained partial progress, got ${dropped.position}`)
}

function testTransitionSynthesizesOnlyAConstrainedEndpoint(): void {
  hydrateLegacyFixture('legacy-writer:transition')
  assertOneSafePublish(() => setXrMotionReferenceCastTransition('moving-crate', 'linear'), 'transition endpoint', 5)
  const track = readXrMotionReferenceRuntime().plan.cast.find(candidate => candidate.actorId === 'moving-crate')!
  assert(track.marks.length === 2, `linear transition should retain its synthesized endpoint, got ${track.marks.length}`)
  const endpoint = track.marks[1]!
  assert(endpoint.position[0] > -3 && endpoint.position[0] < -1, `transition endpoint should stop before the peer instead of persisting raw -1, got ${endpoint.position}`)
}

function testTranslatedTrackRejectsSafeEndpointsWithCrossingSegment(): void {
  hydrateCrossingFixture('legacy-writer:transform-crossing')
  const before = JSON.stringify(readXrMotionReferenceRuntime().plan)
  let notifications = 0
  const unsubscribe = subscribeXrMotionReferenceRuntime(() => { notifications += 1 })
  try {
    setXrMotionReferenceSubjectTransform({ subjectId: 'moving-crate', position: [-3, 0, 0] })
  } finally {
    unsubscribe()
  }
  assert(notifications === 0, 'translated track whose safe endpoints cross a peer must fail atomically without publishing')
  assert(JSON.stringify(readXrMotionReferenceRuntime().plan) === before, 'rejected translated crossing must retain the complete previous subject and mark plan')
}

function testInsertedMarkRejectsAChangedNeighborSegmentCrossing(): void {
  hydrateCrossingFixture('legacy-writer:drop-crossing')
  setXrMotionReferencePlayhead(3.9)
  setXrMotionReferenceCastMarkArmed(true)
  const before = JSON.stringify(readXrMotionReferenceRuntime().plan)
  let notifications = 0
  const unsubscribe = subscribeXrMotionReferenceRuntime(() => { notifications += 1 })
  try {
    dropXrMotionReferenceCastMark([3, 0, 0])
  } finally {
    unsubscribe()
  }
  assert(notifications === 0, 'inserted safe endpoint whose preceding segment crosses a peer must fail without publishing')
  assert(JSON.stringify(readXrMotionReferenceRuntime().plan) === before, 'rejected inserted crossing must not retain a partial mark edit')
}

function testPhysicsOwnershipBlocksAllLegacyPositionWrites(): void {
  hydrateLegacyFixture('legacy-writer:physics-owned', true)
  setXrMotionReferencePlayhead(2)
  setXrMotionReferenceCastMarkArmed(true)
  const before = JSON.stringify(readXrMotionReferenceRuntime().plan)
  let notifications = 0
  const unsubscribe = subscribeXrMotionReferenceRuntime(() => { notifications += 1 })
  try {
    setXrMotionReferenceSubjectTransform({ subjectId: 'moving-crate', position: [0, 0, 0] })
    dropXrMotionReferenceCastMark([0, 0, 0])
    setXrMotionReferenceCastTransition('moving-crate', 'linear')
  } finally {
    unsubscribe()
    stopXrPhysicsRuntime()
  }
  assert(notifications === 0, `physics-owned authored writes must fail closed without publishing, got ${notifications}`)
  assert(JSON.stringify(readXrMotionReferenceRuntime().plan) === before, 'physics-owned authored writes must preserve the complete previous plan')
}

function testLegacyCallChainUsesSharedConstrainedComposition(): void {
  const runtimeSource = readFileSync(resolve(process.cwd(), 'src/features/three/xrMotionReferenceRuntime.ts'), 'utf8')
  const constrainedSource = readFileSync(resolve(process.cwd(), 'src/features/three/xrConstrainedMotionEdits.ts'), 'utf8')
  const stageSource = readFileSync(resolve(process.cwd(), 'src/features/three/XrMotionReferenceStage.tsx'), 'utf8')
  const sceneSource = readFileSync(resolve(process.cwd(), 'src/features/three/xrSceneMcpRuntime.ts'), 'utf8')
  for (const marker of [
    'resolveXrConstrainedCastMarkDrop',
    'buildXrConstrainedSubjectTransformEdit',
    'buildXrConstrainedCastTransitionPlan',
  ]) {
    assert(runtimeSource.includes(marker), `legacy runtime writer must compose ${marker}`)
  }
  assert(constrainedSource.includes('resolveXrSubjectMotion({'), 'legacy composition must reuse the shared constrained motion resolver')
  assert(constrainedSource.includes('startTimeSeconds: start.timeSeconds'), 'final authored-track validation must sweep each segment across its explicit time interval')
  assert(stageSource.includes('dropXrMotionReferenceCastMark(['), 'stage floor placement must retain the canonical runtime drop path')
  assert(sceneSource.includes('setXrMotionReferenceSubjectTransform({')
    && sceneSource.includes('setXrMotionReferenceCastTransition('), 'XR scene control must retain canonical runtime transform and transition persistence paths')
}

export function testXrLegacyPositionWritersAreConstrainedAndAtomic(): void {
  testSubjectTransformMovesSubjectAndMarksWithoutOverlap()
  testStageDropDoesNotPersistRequestedOverlap()
  testTransitionSynthesizesOnlyAConstrainedEndpoint()
  testTranslatedTrackRejectsSafeEndpointsWithCrossingSegment()
  testInsertedMarkRejectsAChangedNeighborSegmentCrossing()
  testPhysicsOwnershipBlocksAllLegacyPositionWrites()
  testLegacyCallChainUsesSharedConstrainedComposition()
}
