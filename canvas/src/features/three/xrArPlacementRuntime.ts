import {
  requestPreferredXrReferenceSpace,
  type XrSessionReferenceSpaceKind,
  type XrSessionMode,
} from '@/lib/three/ThreeGraphXrSessionPolicy'

export type XrArMatrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

export type XrArPlacementPhase =
  | 'idle'
  | 'initializing'
  | 'searching'
  | 'tracking'
  | 'placed'
  | 'error'

export type XrArReferenceSpaceKind = 'none' | XrSessionReferenceSpaceKind

export type XrArPlacementSnapshot = Readonly<{
  phase: XrArPlacementPhase
  immersiveSessionActive: boolean
  immersiveSessionMode: 'none' | XrSessionMode
  sessionActive: boolean
  reticleVisible: boolean
  hitMatrix: XrArMatrix4 | null
  placementMatrix: XrArMatrix4 | null
  referenceSpaceKind: XrArReferenceSpaceKind
  errorCode: '' | 'unsupported' | 'reference-space' | 'hit-test-source'
  revision: number
}>

export type XrArSpaceLike = object

export type XrArHitTestSourceLike = {
  cancel?: () => void
}

export type XrArPoseLike = {
  transform?: {
    matrix?: ArrayLike<number>
  }
}

export type XrArHitTestResultLike = {
  getPose?: (baseSpace: XrArSpaceLike) => XrArPoseLike | null | undefined
}

export type XrArFrameLike = {
  session?: XrArSessionLike
  getHitTestResults?: (source: XrArHitTestSourceLike) => readonly XrArHitTestResultLike[]
}

export type XrArSessionEventLike = {
  frame?: XrArFrameLike
}

type XrArSessionEventListener = (event?: XrArSessionEventLike) => void

export type XrArSessionLike = {
  requestReferenceSpace?: (kind: 'viewer' | 'local-floor' | 'local') => Promise<XrArSpaceLike>
  requestHitTestSource?: (options: { space: XrArSpaceLike }) => Promise<XrArHitTestSourceLike | null>
  addEventListener?: (type: 'end' | 'select', listener: XrArSessionEventListener) => void
  removeEventListener?: (type: 'end' | 'select', listener: XrArSessionEventListener) => void
}

export type XrArPlacementSessionReferenceSpace = Readonly<{
  kind: XrSessionReferenceSpaceKind
  space: XrArSpaceLike
}>

type RuntimeListener = () => void

export type XrArPlacementRuntime = Readonly<{
  read: () => XrArPlacementSnapshot
  subscribe: (listener: RuntimeListener) => () => void
  beginSession: (
    session: XrArSessionLike,
    referenceSpace?: XrArPlacementSessionReferenceSpace,
  ) => Promise<boolean>
  activateImmersiveSession: (session: XrArSessionLike, mode: XrSessionMode) => XrArPlacementSnapshot
  endSession: (expectedSession?: XrArSessionLike) => XrArPlacementSnapshot
  updateFrame: (frame: XrArFrameLike | null | undefined) => XrArPlacementSnapshot
  commitPlacement: () => boolean
  resetPlacement: () => boolean
  dispose: () => void
}>

function freezeMatrix(values: number[]): XrArMatrix4 {
  return Object.freeze(values.slice(0, 16)) as unknown as XrArMatrix4
}

export function copyXrArMatrix4(value: unknown): XrArMatrix4 | null {
  if (!value || (typeof value !== 'object' && !Array.isArray(value))) return null
  const candidate = value as ArrayLike<unknown>
  if (candidate.length !== 16) return null
  const values: number[] = []
  for (let index = 0; index < 16; index += 1) {
    const item = candidate[index]
    if (typeof item !== 'number' || !Number.isFinite(item)) return null
    values.push(item)
  }
  return freezeMatrix(values)
}

function matrixEquals(left: XrArMatrix4 | null, right: XrArMatrix4 | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  for (let index = 0; index < 16; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function freezeSnapshot(value: XrArPlacementSnapshot): XrArPlacementSnapshot {
  return Object.freeze(value)
}

function safeCancel(source: XrArHitTestSourceLike | null): void {
  try {
    source?.cancel?.()
  } catch {
    void 0
  }
}

export function shouldShowXrArPlacementContent(
  snapshot: XrArPlacementSnapshot,
  hideUntilPlaced = true,
): boolean {
  return !hideUntilPlaced
    || !snapshot.sessionActive
    || snapshot.phase === 'error'
    || Boolean(snapshot.placementMatrix)
}

export function resolveXrRendererClearAlpha(
  defaultAlpha: number,
  immersiveSessionMode: XrArPlacementSnapshot['immersiveSessionMode'],
): number {
  if (immersiveSessionMode === 'immersive-ar') return 0
  if (!Number.isFinite(defaultAlpha)) return 0
  return Math.min(1, Math.max(0, defaultAlpha))
}

export function createXrArPlacementRuntime(): XrArPlacementRuntime {
  const listeners = new Set<RuntimeListener>()
  let generation = 0
  let activeImmersiveSession: XrArSessionLike | null = null
  let activeSession: XrArSessionLike | null = null
  let activeHitSource: XrArHitTestSourceLike | null = null
  let activeReferenceSpace: XrArSpaceLike | null = null
  let endListener: XrArSessionEventListener | null = null
  let selectListener: XrArSessionEventListener | null = null
  let snapshot = freezeSnapshot({
    phase: 'idle',
    immersiveSessionActive: false,
    immersiveSessionMode: 'none',
    sessionActive: false,
    reticleVisible: false,
    hitMatrix: null,
    placementMatrix: null,
    referenceSpaceKind: 'none',
    errorCode: '',
    revision: 0,
  })

  const publish = (patch: Partial<Omit<XrArPlacementSnapshot, 'revision'>>): XrArPlacementSnapshot => {
    snapshot = freezeSnapshot({ ...snapshot, ...patch, revision: snapshot.revision + 1 })
    for (const listener of [...listeners]) listener()
    return snapshot
  }

  const releaseResources = (): void => {
    const session = activeSession
    const source = activeHitSource
    const onEnd = endListener
    const onSelect = selectListener
    activeSession = null
    activeHitSource = null
    activeReferenceSpace = null
    endListener = null
    selectListener = null
    if (session && onEnd) {
      try {
        session.removeEventListener?.('end', onEnd)
      } catch {
        void 0
      }
    }
    if (session && onSelect) {
      try {
        session.removeEventListener?.('select', onSelect)
      } catch {
        void 0
      }
    }
    safeCancel(source)
  }

  const read = (): XrArPlacementSnapshot => snapshot

  const subscribe = (listener: RuntimeListener): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const endSession = (expectedSession?: XrArSessionLike): XrArPlacementSnapshot => {
    if (expectedSession && activeImmersiveSession && expectedSession !== activeImmersiveSession) return snapshot
    generation += 1
    releaseResources()
    activeImmersiveSession = null
    if (
      snapshot.phase === 'idle'
      && !snapshot.immersiveSessionActive
      && !snapshot.sessionActive
      && !snapshot.hitMatrix
      && !snapshot.placementMatrix
    ) return snapshot
    return publish({
      phase: 'idle',
      immersiveSessionActive: false,
      immersiveSessionMode: 'none',
      sessionActive: false,
      reticleVisible: false,
      hitMatrix: null,
      placementMatrix: null,
      referenceSpaceKind: 'none',
      errorCode: '',
    })
  }

  const updateFrame = (frame: XrArFrameLike | null | undefined): XrArPlacementSnapshot => {
    const session = activeSession
    const source = activeHitSource
    const referenceSpace = activeReferenceSpace
    if (!session || !source || !referenceSpace || !frame?.getHitTestResults) return snapshot
    if (frame.session && frame.session !== session) return snapshot

    let matrix: XrArMatrix4 | null = null
    try {
      const results = frame.getHitTestResults(source) || []
      for (const result of results) {
        const pose = result?.getPose?.(referenceSpace)
        matrix = copyXrArMatrix4(pose?.transform?.matrix)
        if (matrix) break
      }
    } catch {
      matrix = null
    }

    const phase: XrArPlacementPhase = snapshot.placementMatrix
      ? 'placed'
      : matrix
        ? 'tracking'
        : 'searching'
    if (
      snapshot.reticleVisible === Boolean(matrix)
      && matrixEquals(snapshot.hitMatrix, matrix)
      && snapshot.phase === phase
    ) return snapshot
    return publish({
      phase,
      reticleVisible: Boolean(matrix),
      hitMatrix: matrix,
      errorCode: '',
    })
  }

  const commitPlacement = (): boolean => {
    if (!activeSession || snapshot.placementMatrix || !snapshot.hitMatrix) return false
    const placementMatrix = copyXrArMatrix4(snapshot.hitMatrix)
    if (!placementMatrix) return false
    publish({ phase: 'placed', placementMatrix })
    return true
  }

  const resetPlacement = (): boolean => {
    if (!activeSession || !snapshot.placementMatrix) return false
    publish({
      phase: snapshot.hitMatrix ? 'tracking' : 'searching',
      placementMatrix: null,
    })
    return true
  }

  const beginSession = async (
    session: XrArSessionLike,
    suppliedReferenceSpace?: XrArPlacementSessionReferenceSpace,
  ): Promise<boolean> => {
    generation += 1
    const token = generation
    releaseResources()
    activeImmersiveSession = session
    activeSession = session
    endListener = () => {
      if (generation === token && activeSession === session) endSession(session)
    }
    selectListener = event => {
      if (generation !== token || activeSession !== session) return
      if (snapshot.placementMatrix) return
      if (event?.frame) updateFrame(event.frame)
      commitPlacement()
    }
    try {
      session.addEventListener?.('end', endListener)
      session.addEventListener?.('select', selectListener)
    } catch {
      void 0
    }
    publish({
      phase: 'initializing',
      immersiveSessionActive: true,
      immersiveSessionMode: 'immersive-ar',
      sessionActive: true,
      reticleVisible: false,
      hitMatrix: null,
      placementMatrix: null,
      referenceSpaceKind: 'none',
      errorCode: '',
    })

    if (!session?.requestReferenceSpace || !session.requestHitTestSource) {
      if (generation === token && activeSession === session) {
        publish({ phase: 'error', errorCode: 'unsupported' })
      }
      return false
    }

    let viewerSpace: XrArSpaceLike
    let placementSpace: XrArSpaceLike
    let referenceSpaceKind: XrSessionReferenceSpaceKind
    try {
      viewerSpace = await session.requestReferenceSpace('viewer')
      if (generation !== token || activeSession !== session) return false
      const resolvedReferenceSpace = suppliedReferenceSpace
        || await requestPreferredXrReferenceSpace<XrArSpaceLike>(session)
      referenceSpaceKind = resolvedReferenceSpace.kind
      placementSpace = resolvedReferenceSpace.space
      if (generation !== token || activeSession !== session) return false
    } catch {
      if (generation === token && activeSession === session) {
        publish({ phase: 'error', errorCode: 'reference-space' })
      }
      return false
    }

    let hitSource: XrArHitTestSourceLike | null = null
    try {
      hitSource = await session.requestHitTestSource({ space: viewerSpace })
    } catch {
      if (generation === token && activeSession === session) {
        publish({ phase: 'error', errorCode: 'hit-test-source' })
      }
      return false
    }
    if (generation !== token || activeSession !== session) {
      safeCancel(hitSource)
      return false
    }
    if (!hitSource) {
      publish({ phase: 'error', errorCode: 'hit-test-source' })
      return false
    }

    activeHitSource = hitSource
    activeReferenceSpace = placementSpace
    publish({
      phase: 'searching',
      referenceSpaceKind,
      errorCode: '',
    })
    return true
  }

  const activateImmersiveSession = (session: XrArSessionLike, mode: XrSessionMode): XrArPlacementSnapshot => {
    generation += 1
    releaseResources()
    activeImmersiveSession = session
    return publish({
      phase: 'idle',
      immersiveSessionActive: true,
      immersiveSessionMode: mode,
      sessionActive: false,
      reticleVisible: false,
      hitMatrix: null,
      placementMatrix: null,
      referenceSpaceKind: 'none',
      errorCode: '',
    })
  }

  const dispose = (): void => {
    endSession()
    listeners.clear()
  }

  return Object.freeze({
    read,
    subscribe,
    beginSession,
    activateImmersiveSession,
    endSession,
    updateFrame,
    commitPlacement,
    resetPlacement,
    dispose,
  })
}

export const xrArPlacementRuntime = createXrArPlacementRuntime()

export const readXrArPlacementRuntime = () => xrArPlacementRuntime.read()
export const readXrImmersiveSessionMode = () => xrArPlacementRuntime.read().immersiveSessionMode
export const subscribeXrArPlacementRuntime = (listener: RuntimeListener) => xrArPlacementRuntime.subscribe(listener)
export const beginXrArPlacementSession = (
  session: XrArSessionLike,
  referenceSpace?: XrArPlacementSessionReferenceSpace,
) => xrArPlacementRuntime.beginSession(session, referenceSpace)
export const activateXrImmersiveSession = (session: XrArSessionLike, mode: XrSessionMode) => (
  xrArPlacementRuntime.activateImmersiveSession(session, mode)
)
export const endXrArPlacementSession = (session?: XrArSessionLike) => xrArPlacementRuntime.endSession(session)
export const updateXrArPlacementFrame = (frame: XrArFrameLike | null | undefined) => xrArPlacementRuntime.updateFrame(frame)
export const commitXrArPlacement = () => xrArPlacementRuntime.commitPlacement()
export const resetXrArPlacement = () => xrArPlacementRuntime.resetPlacement()
