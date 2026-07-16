import type { KnowgrphRuntimeIdentity } from '@/features/runtime-identity/knowgrphRuntimeIdentity'
import {
  createKnowgrphRuntimeIdentityAttestation,
  verifyKnowgrphRuntimeIdentityAttestations,
  type AuthenticatedKnowgrphRuntimeIdentityAttestation,
} from '@/features/runtime-identity/runtimeIdentityAttestation'

const NOW_MS = 1_750_000_000_000
const SESSION_ID = 'runtime-identity:knowgrph:main'
const CHALLENGE = 'challenge-current'

const buildIdentity = (
  device: string,
  overrides: Partial<KnowgrphRuntimeIdentity> = {},
): KnowgrphRuntimeIdentity => ({
  schema: 'knowgrph-runtime-identity/v1',
  device,
  branch: 'main',
  knowgrphRevision: 'b'.repeat(40),
  agenticCanvasOsRevision: 'a'.repeat(40),
  catalogRevision: 'a'.repeat(40),
  catalogHydration: { status: 'fresh', attempts: 1 },
  catalogCounts: { slash: 78, hash: 94, at: 95 },
  ...overrides,
})

const buildEnvelope = async (args: {
  device: string
  runtimeInstanceId: string
  challenge?: string
  identity?: KnowgrphRuntimeIdentity
  capturedAtMs?: number
}): Promise<AuthenticatedKnowgrphRuntimeIdentityAttestation> => ({
  authenticatedPeerId: `peer-${args.device}`,
  authenticatedSessionId: `session-${args.device}`,
  attestation: await createKnowgrphRuntimeIdentityAttestation({
    identity: args.identity || buildIdentity(args.device),
    sessionId: SESSION_ID,
    challenge: args.challenge || CHALLENGE,
    runtimeInstanceId: args.runtimeInstanceId,
    nowMs: args.capturedAtMs ?? NOW_MS,
  }),
})

export async function testRuntimeIdentityAttestationPassesExactParity(): Promise<void> {
  const mutableIdentity = buildIdentity('device-a')
  const attestations = await Promise.all([
    buildEnvelope({ device: 'device-a', runtimeInstanceId: 'runtime-a', identity: mutableIdentity }),
    buildEnvelope({ device: 'device-b', runtimeInstanceId: 'runtime-b' }),
  ])
  mutableIdentity.catalogCounts.slash = 0
  if (attestations[0]?.attestation.identity.catalogCounts.slash !== 78) {
    throw new Error('Attestation must own an immutable point-in-time identity snapshot')
  }
  const result = await verifyKnowgrphRuntimeIdentityAttestations({
    sessionId: SESSION_ID,
    challenge: CHALLENGE,
    attestations,
    nowMs: NOW_MS + 1_000,
  })
  if (result.status !== 'pass' || result.observedDeviceCount !== 2 || !result.verificationDigest) {
    throw new Error(`Expected exact automatic runtime identity parity, got ${JSON.stringify(result)}`)
  }
}

export async function testRuntimeIdentityAttestationBlocksMismatchReplayAndDuplicates(): Promise<void> {
  const matching = await buildEnvelope({ device: 'device-a', runtimeInstanceId: 'runtime-a' })
  const mismatched = await buildEnvelope({
    device: 'device-b',
    runtimeInstanceId: 'runtime-b',
    identity: buildIdentity('device-b', { knowgrphRevision: 'c'.repeat(40) }),
  })
  const mismatchResult = await verifyKnowgrphRuntimeIdentityAttestations({
    sessionId: SESSION_ID,
    challenge: CHALLENGE,
    attestations: [matching, mismatched],
    nowMs: NOW_MS + 1_000,
  })
  if (mismatchResult.status !== 'mismatch' || !mismatchResult.differences.includes('knowgrphRevision')) {
    throw new Error(`Expected exact SHA mismatch to fail closed, got ${JSON.stringify(mismatchResult)}`)
  }

  const replayed = await buildEnvelope({
    device: 'device-b',
    runtimeInstanceId: 'runtime-b',
    challenge: 'challenge-old',
  })
  const replayResult = await verifyKnowgrphRuntimeIdentityAttestations({
    sessionId: SESSION_ID,
    challenge: CHALLENGE,
    attestations: [matching, replayed],
    nowMs: NOW_MS + 1_000,
  })
  if (replayResult.status !== 'blocked' || !replayResult.differences.includes('attestation challenge replay')) {
    throw new Error(`Expected replayed challenge evidence to be blocked, got ${JSON.stringify(replayResult)}`)
  }

  const duplicateDevice = await buildEnvelope({ device: 'device-a', runtimeInstanceId: 'runtime-b' })
  const duplicateResult = await verifyKnowgrphRuntimeIdentityAttestations({
    sessionId: SESSION_ID,
    challenge: CHALLENGE,
    attestations: [matching, duplicateDevice],
    nowMs: NOW_MS + 1_000,
  })
  if (duplicateResult.status !== 'blocked' || !duplicateResult.differences.includes('duplicate runtime device')) {
    throw new Error(`Expected duplicate device evidence to be blocked, got ${JSON.stringify(duplicateResult)}`)
  }

  const duplicateSession = await buildEnvelope({ device: 'device-b', runtimeInstanceId: 'runtime-b' })
  duplicateSession.authenticatedSessionId = matching.authenticatedSessionId
  const duplicateSessionResult = await verifyKnowgrphRuntimeIdentityAttestations({
    sessionId: SESSION_ID,
    challenge: CHALLENGE,
    attestations: [matching, duplicateSession],
    nowMs: NOW_MS + 1_000,
  })
  if (
    duplicateSessionResult.status !== 'blocked'
    || !duplicateSessionResult.differences.includes('duplicate authenticated session')
  ) {
    throw new Error(`Expected duplicate authenticated session evidence to be blocked, got ${JSON.stringify(duplicateSessionResult)}`)
  }
}

export async function testRuntimeIdentityAttestationExpiresFailClosed(): Promise<void> {
  const attestations = await Promise.all([
    buildEnvelope({ device: 'device-a', runtimeInstanceId: 'runtime-a' }),
    buildEnvelope({ device: 'device-b', runtimeInstanceId: 'runtime-b' }),
  ])
  const result = await verifyKnowgrphRuntimeIdentityAttestations({
    sessionId: SESSION_ID,
    challenge: CHALLENGE,
    attestations,
    nowMs: NOW_MS + 60_001,
  })
  if (result.status !== 'stale' || !result.differences.includes('attestation expired')) {
    throw new Error(`Expected expired automatic evidence to be stale, got ${JSON.stringify(result)}`)
  }
}
