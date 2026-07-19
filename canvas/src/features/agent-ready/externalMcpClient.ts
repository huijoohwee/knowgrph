import {
  EXTERNAL_MCP_CALL_PATH,
  EXTERNAL_MCP_CATALOG_PATH,
  EXTERNAL_MCP_PREPARE_PATH,
  isExternalMcpArtifactReceipt,
  isExternalMcpCapability,
  isExternalMcpPreparedAction,
  normalizeExternalMcpArtifactInput,
  normalizeExternalMcpCapabilityId,
  type ExternalMcpArtifactInput,
  type ExternalMcpArtifactReceipt,
  type ExternalMcpCapability,
} from './externalMcpBridgeContract'

export type ExternalMcpInvocationOutcome =
  | { status: 'created'; receipt: ExternalMcpArtifactReceipt }
  | { status: 'cancelled'; capability: ExternalMcpCapability }
  | { status: 'unavailable'; reason: string }

const readError = async (response: Response): Promise<string> => {
  try {
    const value = await response.json() as { error?: unknown }
    return String(value.error || '').trim().slice(0, 640)
  } catch {
    return ''
  }
}

const postJson = async (path: string, body: unknown, fetchImpl: typeof fetch): Promise<unknown> => {
  const response = await fetchImpl(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response) || `External MCP bridge failed (${response.status}).`)
  return await response.json() as unknown
}

export const listExternalMcpCapabilities = async (
  fetchImpl: typeof fetch = fetch,
): Promise<ExternalMcpCapability[]> => {
  const response = await fetchImpl(EXTERNAL_MCP_CATALOG_PATH, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(await readError(response) || `External MCP catalog failed (${response.status}).`)
  const payload = await response.json() as { capabilities?: unknown }
  return Array.isArray(payload.capabilities) ? payload.capabilities.filter(isExternalMcpCapability) : []
}

export async function invokeExternalMcpArtifactCreation(args: {
  artifact: ExternalMcpArtifactInput
  capabilityId?: string | null
  fetchImpl?: typeof fetch
  confirmImpl?: (message: string) => boolean | Promise<boolean>
}): Promise<ExternalMcpInvocationOutcome> {
  const artifact = normalizeExternalMcpArtifactInput(args.artifact)
  if (!artifact) throw new Error('External MCP artifact input is incomplete or exceeds its bounds.')
  const fetchImpl = args.fetchImpl || fetch
  const capabilities = await listExternalMcpCapabilities(fetchImpl)
  const normalizedRequestedId = normalizeExternalMcpCapabilityId(args.capabilityId)
  const requestedId = normalizedRequestedId.toLowerCase() === 'auto' ? '' : normalizedRequestedId
  const capability = requestedId
    ? capabilities.find(candidate => candidate.id === requestedId && candidate.artifactKind === artifact.artifactKind)
    : capabilities.find(candidate => candidate.artifactKind === artifact.artifactKind)
  if (!capability) {
    return {
      status: 'unavailable',
      reason: requestedId
        ? `Configured capability ${requestedId} is unavailable for ${artifact.artifactKind}.`
        : `No host-approved ${artifact.artifactKind} MCP capability is configured.`,
    }
  }
  const preparedPayload = await postJson(EXTERNAL_MCP_PREPARE_PATH, {
    capabilityId: capability.id,
    artifact,
  }, fetchImpl)
  const prepared = preparedPayload && typeof preparedPayload === 'object' && !Array.isArray(preparedPayload)
    ? (preparedPayload as { action?: unknown }).action
    : null
  if (!isExternalMcpPreparedAction(prepared) || prepared.capability.id !== capability.id) {
    throw new Error('External MCP bridge returned an invalid approval action.')
  }
  const confirmImpl = args.confirmImpl || ((message: string) => window.confirm(message))
  const approved = await confirmImpl([
    'Allow this external MCP write?',
    '',
    prepared.summary,
    ...(prepared.capability.toolName ? [`Tool: ${prepared.capability.toolName}`] : []),
    `Capability: ${prepared.capability.label} (${prepared.capability.id})`,
  ].join('\n'))
  if (!approved) return { status: 'cancelled', capability }

  const calledPayload = await postJson(EXTERNAL_MCP_CALL_PATH, {
    approvalToken: prepared.approvalToken,
    actionDigest: prepared.actionDigest,
  }, fetchImpl)
  const receipt = calledPayload && typeof calledPayload === 'object' && !Array.isArray(calledPayload)
    ? (calledPayload as { receipt?: unknown }).receipt
    : null
  if (!isExternalMcpArtifactReceipt(receipt) || receipt.capabilityId !== capability.id) {
    throw new Error('External MCP bridge returned an invalid artifact receipt.')
  }
  return { status: 'created', receipt }
}
