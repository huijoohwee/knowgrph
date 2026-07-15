import type { AgenticOsRemoteGrammarSnapshot } from './agenticOsRemoteGrammarClient'

declare const __KNOWGRPH_SOURCE_REVISION__: string | undefined
declare const __KNOWGRPH_RUNTIME_DEVICE__: string | undefined
declare const __KNOWGRPH_SOURCE_BRANCH__: string | undefined

const SHA_PATTERN = /^[0-9a-f]{40}$/

const readBuildConstant = (value: unknown): string => String(value || '').trim()

export type KnowgrphRuntimeIdentity = {
  schema: 'knowgrph-runtime-identity/v1'
  device: string
  branch: string
  knowgrphRevision: string
  agenticCanvasOsRevision: string
  catalogRevision: string
  catalogHydration: {
    status: AgenticOsRemoteGrammarSnapshot['hydration']['status']
    attempts: number
  }
  catalogCounts: AgenticOsRemoteGrammarSnapshot['counts']
}

export const readKnowgrphSourceRevision = (): string => readBuildConstant(
  typeof __KNOWGRPH_SOURCE_REVISION__ === 'string' ? __KNOWGRPH_SOURCE_REVISION__ : '',
)

export const readKnowgrphRuntimeDevice = (): string => readBuildConstant(
  typeof __KNOWGRPH_RUNTIME_DEVICE__ === 'string' ? __KNOWGRPH_RUNTIME_DEVICE__ : 'unknown-device',
) || 'unknown-device'

export const readKnowgrphSourceBranch = (): string => readBuildConstant(
  typeof __KNOWGRPH_SOURCE_BRANCH__ === 'string' ? __KNOWGRPH_SOURCE_BRANCH__ : 'unknown',
) || 'unknown'

export function buildKnowgrphRuntimeIdentity(snapshot: AgenticOsRemoteGrammarSnapshot): KnowgrphRuntimeIdentity {
  return {
    schema: 'knowgrph-runtime-identity/v1',
    device: readKnowgrphRuntimeDevice(),
    branch: readKnowgrphSourceBranch(),
    knowgrphRevision: readKnowgrphSourceRevision(),
    agenticCanvasOsRevision: snapshot.sourceRevision,
    catalogRevision: snapshot.sourceRevision,
    catalogHydration: {
      status: snapshot.hydration.status,
      attempts: snapshot.hydration.attempts,
    },
    catalogCounts: snapshot.counts,
  }
}

export function isKnowgrphRuntimeIdentityFresh(identity: KnowgrphRuntimeIdentity): boolean {
  return SHA_PATTERN.test(identity.knowgrphRevision)
    && SHA_PATTERN.test(identity.agenticCanvasOsRevision)
    && identity.catalogRevision === identity.agenticCanvasOsRevision
    && identity.catalogHydration.status === 'fresh'
    && identity.catalogHydration.attempts >= 0
    && identity.catalogHydration.attempts <= 2
}

export const serializeKnowgrphRuntimeIdentity = (identity: KnowgrphRuntimeIdentity): string => `${JSON.stringify(identity, null, 2)}\n`
