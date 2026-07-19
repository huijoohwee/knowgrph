import {
  EXTERNAL_MCP_CALL_PATH,
  EXTERNAL_MCP_CATALOG_PATH,
  EXTERNAL_MCP_PREPARE_PATH,
} from '@/features/agent-ready/externalMcpBridgeContract'
import { invokeExternalMcpArtifactCreation } from '@/features/agent-ready/externalMcpClient'

const capability = {
  id: 'workspace.slides',
  revision: 'sha256:revision',
  label: 'Workspace Slides',
  artifactKind: 'slide-deck' as const,
  toolName: 'create_presentation',
  transport: 'stdio' as const,
  requiresApproval: true as const,
}

const artifact = {
  artifactKind: 'slide-deck' as const,
  title: 'Investment case',
  content: '# Slide 1\n\n---\n\n# Slide 2',
  contentType: 'text/markdown',
  fileName: 'investment-case.md',
}

export async function testExternalMcpBridgeRequiresExplicitApprovalAndReturnsSanitizedReceipt() {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = []
  const fetchImpl = (async (input, init) => {
    const path = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
    calls.push({ path, body })
    if (path === EXTERNAL_MCP_CATALOG_PATH) {
      return new Response(JSON.stringify({ ok: true, capabilities: [capability] }), { status: 200 })
    }
    if (path === EXTERNAL_MCP_PREPARE_PATH) {
      return new Response(JSON.stringify({
        ok: true,
        action: {
          approvalToken: 'opaque-approval-token',
          actionDigest: 'sha256:action',
          expiresAt: '2099-01-01T00:00:00.000Z',
          summary: 'Create Investment case with Workspace Slides.',
          capability,
        },
      }), { status: 200 })
    }
    if (path === EXTERNAL_MCP_CALL_PATH) {
      return new Response(JSON.stringify({
        ok: true,
        receipt: {
          capabilityId: capability.id,
          capabilityRevision: capability.revision,
          toolName: capability.toolName,
          artifactKind: capability.artifactKind,
          createdAt: '2026-07-19T00:00:00.000Z',
          externalId: 'deck-1',
          url: 'https://slides.example.test/deck-1',
          mimeType: 'application/vnd.example.presentation',
        },
      }), { status: 200 })
    }
    return new Response(null, { status: 404 })
  }) as typeof fetch
  let approvalMessage = ''
  const outcome = await invokeExternalMcpArtifactCreation({
    artifact,
    capabilityId: 'auto',
    fetchImpl,
    confirmImpl: message => {
      approvalMessage = message
      return true
    },
  })
  if (outcome.status !== 'created' || outcome.receipt.url !== 'https://slides.example.test/deck-1') {
    throw new Error(`expected a sanitized external artifact receipt, got ${JSON.stringify(outcome)}`)
  }
  if (!approvalMessage.includes(capability.toolName) || !approvalMessage.includes(capability.label)) {
    throw new Error(`expected the exact host-approved capability in the confirmation, got ${approvalMessage}`)
  }
  const prepare = calls.find(call => call.path === EXTERNAL_MCP_PREPARE_PATH)
  const invoked = calls.find(call => call.path === EXTERNAL_MCP_CALL_PATH)
  if (
    !prepare
    || Object.keys(prepare.body).sort().join(',') !== 'artifact,capabilityId'
    || !invoked
    || Object.keys(invoked.body).sort().join(',') !== 'actionDigest,approvalToken'
  ) {
    throw new Error(`expected canonical artifact prepare plus opaque approved call, got ${JSON.stringify(calls)}`)
  }
}

export async function testExternalMcpBridgeCancellationDoesNotInvokeTool() {
  const paths: string[] = []
  const fetchImpl = (async (input) => {
    const path = String(input)
    paths.push(path)
    if (path === EXTERNAL_MCP_CATALOG_PATH) {
      return new Response(JSON.stringify({ ok: true, capabilities: [capability] }), { status: 200 })
    }
    return new Response(JSON.stringify({
      ok: true,
      action: {
        approvalToken: 'opaque-approval-token',
        actionDigest: 'sha256:action',
        expiresAt: '2099-01-01T00:00:00.000Z',
        summary: 'Create Investment case with Workspace Slides.',
        capability,
      },
    }), { status: 200 })
  }) as typeof fetch
  const outcome = await invokeExternalMcpArtifactCreation({
    artifact,
    fetchImpl,
    confirmImpl: () => false,
  })
  if (outcome.status !== 'cancelled' || paths.includes(EXTERNAL_MCP_CALL_PATH)) {
    throw new Error(`expected cancellation before the external MCP call, got ${JSON.stringify({ outcome, paths })}`)
  }
}
