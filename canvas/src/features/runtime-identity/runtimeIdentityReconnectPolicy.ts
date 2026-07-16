export const KNOWGRPH_RUNTIME_IDENTITY_MAX_RECONNECT_ATTEMPTS = 2

export type KnowgrphRuntimeIdentityReconnectAttempt = {
  attemptIndex: number
  nextFailureCount: number
}

export const consumeKnowgrphRuntimeIdentityReconnectAttempt = (
  failureCount: number,
  maximumAttempts = KNOWGRPH_RUNTIME_IDENTITY_MAX_RECONNECT_ATTEMPTS,
): KnowgrphRuntimeIdentityReconnectAttempt | null => {
  const normalizedFailureCount = Number.isInteger(failureCount) && failureCount > 0
    ? failureCount
    : 0
  if (normalizedFailureCount >= maximumAttempts) return null
  return {
    attemptIndex: normalizedFailureCount,
    nextFailureCount: normalizedFailureCount + 1,
  }
}
