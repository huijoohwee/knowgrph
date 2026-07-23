export const FLIGHT_SIM_DISALLOWED_AUTHORING_OPERATIONS = Object.freeze([
  'image-to-3d-model-call',
  'network-fetch',
  'cloudflare-resource-request',
])

const DISALLOWED_OPERATION_SET = new Set(
  FLIGHT_SIM_DISALLOWED_AUTHORING_OPERATIONS,
)

export class FlightSimOfflineAuthoringBlockedError extends Error {
  constructor(operation) {
    super(
      `Flight Sim offline asset authoring blocked disallowed operation before commit: ${operation}`,
    )
    this.name = 'FlightSimOfflineAuthoringBlockedError'
    this.code = 'FLIGHT_SIM_OFFLINE_AUTHORING_OPERATION_BLOCKED'
    this.operation = operation
    this.beforeCommit = true
  }
}

function assertAuthoringOperations(attemptedOperations) {
  for (const value of attemptedOperations) {
    const operation = String(value || '').trim()
    if (!operation) {
      throw new Error('Flight Sim offline authoring operation must be a non-empty string')
    }
    if (!DISALLOWED_OPERATION_SET.has(operation)) {
      throw new Error(
        `Flight Sim offline authoring received an unknown operation declaration: ${operation}`,
      )
    }
    throw new FlightSimOfflineAuthoringBlockedError(operation)
  }
}

export async function runFlightSimOfflineAuthoringTransaction({
  attemptedOperations = [],
  author,
  commit,
}) {
  if (typeof author !== 'function' || typeof commit !== 'function') {
    throw new Error('Flight Sim offline authoring requires author and commit functions')
  }
  assertAuthoringOperations(attemptedOperations)
  const outputs = await author()
  await commit(outputs)
  return outputs
}
