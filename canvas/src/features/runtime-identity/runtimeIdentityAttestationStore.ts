import { useSyncExternalStore } from 'react'
import type { KnowgrphRuntimeIdentityVerificationStatus } from './runtimeIdentityAttestation'

export type KnowgrphRuntimeIdentityAttestationTransportStatus =
  | 'unavailable'
  | 'connecting'
  | 'connected'
  | 'error'

export type KnowgrphRuntimeIdentityGateStatus =
  | 'unavailable'
  | 'connecting'
  | KnowgrphRuntimeIdentityVerificationStatus

export type KnowgrphRuntimeIdentityGateSnapshot = {
  schema: 'knowgrph-runtime-identity-gate/v1'
  status: KnowgrphRuntimeIdentityGateStatus
  transportStatus: KnowgrphRuntimeIdentityAttestationTransportStatus
  requiredDeviceCount: number
  observedDeviceCount: number
  expiresAtMs: number | null
  verificationDigest: string | null
  message: string
  differences: string[]
}

const initialSnapshot: KnowgrphRuntimeIdentityGateSnapshot = {
  schema: 'knowgrph-runtime-identity-gate/v1',
  status: 'unavailable',
  transportStatus: 'unavailable',
  requiredDeviceCount: 2,
  observedDeviceCount: 0,
  expiresAtMs: null,
  verificationDigest: null,
  message: 'Authenticated automatic attestation transport is not configured.',
  differences: [],
}

let gateSnapshot = initialSnapshot
const gateListeners = new Set<() => void>()

export const getKnowgrphRuntimeIdentityGateSnapshot = (): KnowgrphRuntimeIdentityGateSnapshot => gateSnapshot

export function publishKnowgrphRuntimeIdentityGateSnapshot(next: KnowgrphRuntimeIdentityGateSnapshot): void {
  gateSnapshot = next
  gateListeners.forEach(listener => listener())
}

const subscribeKnowgrphRuntimeIdentityGate = (listener: () => void): (() => void) => {
  gateListeners.add(listener)
  return () => gateListeners.delete(listener)
}

export function useKnowgrphRuntimeIdentityGate(): KnowgrphRuntimeIdentityGateSnapshot {
  return useSyncExternalStore(
    subscribeKnowgrphRuntimeIdentityGate,
    getKnowgrphRuntimeIdentityGateSnapshot,
    getKnowgrphRuntimeIdentityGateSnapshot,
  )
}

export function resetKnowgrphRuntimeIdentityGateForTests(): void {
  publishKnowgrphRuntimeIdentityGateSnapshot(initialSnapshot)
}
