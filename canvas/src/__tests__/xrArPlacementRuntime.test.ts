import {
  createXrArPlacementRuntime,
  resolveXrRendererClearAlpha,
  shouldShowXrArPlacementContent,
  type XrArFrameLike,
  type XrArHitTestSourceLike,
  type XrArSessionEventLike,
  type XrArSessionLike,
  type XrArSpaceLike,
} from '@/features/three/xrArPlacementRuntime'

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function identityAt(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ])
}

type FakeSessionHarness = {
  session: XrArSessionLike
  dispatch: (type: 'select' | 'end', event?: XrArSessionEventLike) => void
  referenceSpaceRequests: string[]
  hitTestSourceRequests: number
  removedListeners: string[]
}

function createSessionHarness(args: {
  hitSource: Promise<XrArHitTestSourceLike | null>
  rejectLocalFloor?: boolean
}): FakeSessionHarness {
  const listeners = new Map<string, Set<(event?: XrArSessionEventLike) => void>>()
  const referenceSpaceRequests: string[] = []
  let hitTestSourceRequests = 0
  const removedListeners: string[] = []
  const session: XrArSessionLike = {
    requestReferenceSpace: async kind => {
      referenceSpaceRequests.push(kind)
      if (kind === 'local-floor' && args.rejectLocalFloor) throw new Error('floor unavailable')
      return { kind } as XrArSpaceLike
    },
    requestHitTestSource: async () => {
      hitTestSourceRequests += 1
      return args.hitSource
    },
    addEventListener: (type, listener) => {
      const bucket = listeners.get(type) || new Set()
      bucket.add(listener)
      listeners.set(type, bucket)
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener)
      removedListeners.push(type)
    },
  }
  return {
    session,
    referenceSpaceRequests,
    get hitTestSourceRequests() {
      return hitTestSourceRequests
    },
    removedListeners,
    dispatch: (type, event) => {
      for (const listener of [...(listeners.get(type) || [])]) listener(event)
    },
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) return
    await Promise.resolve()
  }
  throw new Error('Expected asynchronous operation to reach the requested state')
}

export async function testXrArPlacementRuntimeIsSessionScopedAndRaceSafe() {
  const runtime = createXrArPlacementRuntime()
  const staleSourceDeferred = deferred<XrArHitTestSourceLike | null>()
  let staleSourceCancelled = 0
  const staleHarness = createSessionHarness({ hitSource: staleSourceDeferred.promise })
  const staleBegin = runtime.beginSession(staleHarness.session)
  await waitFor(() => staleHarness.hitTestSourceRequests === 1)
  runtime.endSession(staleHarness.session)
  staleSourceDeferred.resolve({ cancel: () => { staleSourceCancelled += 1 } })
  expect(await staleBegin === false, 'A session ending during asynchronous hit-test creation must not become active')
  expect(staleSourceCancelled === 1, 'A stale asynchronously-created hit-test source must be cancelled exactly once')
  expect(runtime.read().phase === 'idle', 'Ending a session must restore the idle placement state')

  let liveSourceCancelled = 0
  const liveSource = { cancel: () => { liveSourceCancelled += 1 } }
  const liveHarness = createSessionHarness({
    hitSource: Promise.resolve(liveSource),
    rejectLocalFloor: true,
  })
  let notifications = 0
  const unsubscribe = runtime.subscribe(() => { notifications += 1 })
  expect(await runtime.beginSession(liveHarness.session), 'A standards-shaped session must initialize native hit testing')
  expect(runtime.read().immersiveSessionActive && runtime.read().immersiveSessionMode === 'immersive-ar', 'AR placement must mark the generic immersive presentation active')
  expect(
    liveHarness.referenceSpaceRequests.join('|') === 'viewer|local-floor|local',
    'Placement must prefer local-floor and fall back to local reference space',
  )
  expect(runtime.read().referenceSpaceKind === 'local', 'The chosen reference-space fallback must be inspectable')

  const mutableHitMatrix = identityAt(1.25, 0.4, -2.5)
  const hitFrame: XrArFrameLike = {
    session: liveHarness.session,
    getHitTestResults: source => {
      expect(source === liveSource, 'Frame updates must use the source created for their active session')
      return [{ getPose: () => ({ transform: { matrix: mutableHitMatrix } }) }]
    },
  }
  runtime.updateFrame(hitFrame)
  const tracked = runtime.read()
  expect(tracked.phase === 'tracking' && tracked.reticleVisible, 'A valid hit pose must reveal the reticle')
  expect(tracked.hitMatrix?.[12] === 1.25, 'The hit transform must preserve its translation')
  expect(Object.isFrozen(tracked.hitMatrix), 'Published hit transforms must be immutable copies')
  mutableHitMatrix[12] = 99
  expect(tracked.hitMatrix?.[12] === 1.25, 'Published hit transforms must not alias the platform matrix')

  expect(runtime.commitPlacement(), 'A visible hit must be committable')
  const committed = runtime.read()
  expect(committed.phase === 'placed', 'Committing a hit must enter the placed phase')
  expect(committed.placementMatrix?.[12] === 1.25, 'The placement transform must copy the current hit')
  expect(committed.placementMatrix !== committed.hitMatrix, 'Hit and placement transforms must be independent copies')

  const ignoredSelectMatrix = identityAt(8, 0.2, 9)
  liveHarness.dispatch('select', {
    frame: {
      session: liveHarness.session,
      getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: ignoredSelectMatrix } }) }],
    },
  })
  expect(runtime.read().placementMatrix?.[12] === 1.25, 'Native select must not move a committed placement until reset')
  expect(!runtime.commitPlacement(), 'Direct commits must remain locked while a placement exists')

  const emptyFrame: XrArFrameLike = {
    session: liveHarness.session,
    getHitTestResults: () => [],
  }
  runtime.updateFrame(emptyFrame)
  expect(!runtime.read().reticleVisible, 'Losing the real-world hit must hide the reticle')
  expect(runtime.read().placementMatrix?.[12] === 1.25, 'Transient tracking loss must preserve the committed placement')
  expect(runtime.resetPlacement(), 'A committed session-local placement must be resettable')
  expect(runtime.read().placementMatrix === null, 'Reset must clear only the current session placement')

  const selectMatrix = identityAt(-0.5, 0.1, 3)
  liveHarness.dispatch('select', {
    frame: {
      session: liveHarness.session,
      getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: selectMatrix } }) }],
    },
  })
  expect(runtime.read().placementMatrix?.[12] === -0.5, 'A native select event must commit its current real-world hit')
  expect(runtime.read().placementMatrix?.[14] === 3, 'Select placement must preserve all matrix axes')

  liveHarness.dispatch('end')
  const ended = runtime.read()
  expect(ended.phase === 'idle' && !ended.sessionActive && !ended.immersiveSessionActive, 'A native session end must deactivate placement and immersive presentation')
  expect(ended.hitMatrix === null && ended.placementMatrix === null, 'Placements must never leak across XR sessions')
  expect(liveSourceCancelled === 1, 'Ending a live session must cancel its hit-test source')
  expect(
    liveHarness.removedListeners.includes('end') && liveHarness.removedListeners.includes('select'),
    'Session cleanup must remove native end and select listeners',
  )
  expect(notifications > 0, 'The external store must notify subscribers of placement state transitions')
  unsubscribe()
  runtime.dispose()
}

export async function testXrArPlacementRuntimeRejectsInvalidAndForeignFrames() {
  const runtime = createXrArPlacementRuntime()
  const source = { cancel: () => {} }
  const harness = createSessionHarness({ hitSource: Promise.resolve(source) })
  expect(await runtime.beginSession(harness.session), 'Expected test session to initialize')
  const revision = runtime.read().revision
  runtime.updateFrame({
    session: {} as XrArSessionLike,
    getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: identityAt(4, 5, 6) } }) }],
  })
  expect(runtime.read().revision === revision, 'A frame from another session must not mutate placement state')
  runtime.updateFrame({
    session: harness.session,
    getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: new Float32Array(15) } }) }],
  })
  expect(!runtime.read().reticleVisible, 'A malformed transform must fail closed without a synthetic hit')
  expect(!runtime.commitPlacement(), 'A malformed or missing hit must not be committable')
  runtime.dispose()

  const suppliedRuntime = createXrArPlacementRuntime()
  const suppliedHarness = createSessionHarness({ hitSource: Promise.resolve(source) })
  const suppliedSpace = { kind: 'supplied-local' } as XrArSpaceLike
  expect(
    await suppliedRuntime.beginSession(suppliedHarness.session, { kind: 'local', space: suppliedSpace }),
    'A renderer-selected reference space must be reusable by AR placement',
  )
  expect(
    suppliedHarness.referenceSpaceRequests.join('|') === 'viewer',
    'AR placement must not independently renegotiate a supplied renderer reference space',
  )
  expect(suppliedRuntime.read().referenceSpaceKind === 'local', 'The supplied reference-space kind must be inspectable')
  suppliedRuntime.dispose()

  const vrRuntime = createXrArPlacementRuntime()
  const vrSession = {} as XrArSessionLike
  const vrSnapshot = vrRuntime.activateImmersiveSession(vrSession, 'immersive-vr')
  expect(vrSnapshot.immersiveSessionActive && vrSnapshot.immersiveSessionMode === 'immersive-vr', 'VR must activate physical immersive presentation transforms')
  expect(!vrSnapshot.sessionActive && shouldShowXrArPlacementContent(vrSnapshot), 'VR must remain visible without enabling AR reticle placement')
  vrRuntime.endSession(vrSession)
  expect(!vrRuntime.read().immersiveSessionActive && vrRuntime.read().immersiveSessionMode === 'none', 'VR teardown must restore non-immersive presentation state')
  vrRuntime.dispose()

  expect(resolveXrRendererClearAlpha(1, 'immersive-ar') === 0, 'Immersive AR must preserve camera passthrough for opaque editor worlds')
  expect(resolveXrRendererClearAlpha(1, 'immersive-vr') === 1, 'Immersive VR must retain the configured opaque world clear')
  expect(resolveXrRendererClearAlpha(0, 'none') === 0, 'Desktop transparent canvases must retain their configured clear alpha')

  const failedRuntime = createXrArPlacementRuntime()
  const failedSource = deferred<XrArHitTestSourceLike | null>()
  const failedHarness = createSessionHarness({ hitSource: failedSource.promise })
  const failedBegin = failedRuntime.beginSession(failedHarness.session)
  await waitFor(() => failedHarness.hitTestSourceRequests === 1)
  failedSource.reject(new Error('optional hit testing unavailable'))
  expect(await failedBegin === false, 'Unavailable optional hit testing must fail placement initialization cleanly')
  const failedSnapshot = failedRuntime.read()
  expect(failedSnapshot.phase === 'error' && failedSnapshot.sessionActive, 'Placement failure must retain the live XR session state')
  expect(
    shouldShowXrArPlacementContent(failedSnapshot),
    'Placement failure must reveal fallback world content instead of leaving XR blank',
  )
  failedRuntime.dispose()
}
