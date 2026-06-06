import type { FeishuBaseSourceImportRequest } from '@/features/source-files/feishuBaseSourceImportContract'

export type LarkAppRemoteMutationAction =
  | 'import-source-document'
  | 'publish-approved-artifact'

export type LarkAppRemoteMutationArtifactKind =
  | 'source-document'
  | 'approved-artifact'

export type LarkAppRemoteMutationAuthContext = {
  actorId: string
  actorType: 'user' | 'service'
  sessionMode: 'backend-signed' | 'host-issued'
  auditReason: string
}

export type LarkAppRemoteMutationArtifactRef = {
  kind: LarkAppRemoteMutationArtifactKind
  sourceDocumentId: string | null
  sourceFileId: string | null
  targetResource: string
  checksum: string | null
}

export type LarkAppRemoteMutationRequest = {
  action: LarkAppRemoteMutationAction
  idempotencyKey: string
  authContext: LarkAppRemoteMutationAuthContext
  artifact: LarkAppRemoteMutationArtifactRef
  importRequest?: FeishuBaseSourceImportRequest | null
  dryRun: boolean
  conflictPolicy: 'reject-on-conflict' | 'allow-if-match'
  surface: 'webpage' | 'baseinfo' | 'backend'
}

export type LarkAppRemoteMutationResult =
  | {
      ok: true
      status: 'accepted'
      action: LarkAppRemoteMutationAction
      idempotencyKey: string
      auditRequired: true
      dryRun: boolean
    }
  | {
      ok: true
      status: 'previewed'
      action: 'publish-approved-artifact'
      idempotencyKey: string
      auditRequired: true
      dryRun: true
      targetResource: string
      artifactKind: 'approved-artifact'
      sourceDocumentId: string | null
      sourceFileId: string | null
      checksum: string | null
      conflictPolicy: 'reject-on-conflict' | 'allow-if-match'
      sessionMode: 'backend-signed' | 'host-issued'
      surface: 'webpage' | 'baseinfo' | 'backend'
      auditReason: string
      publishReadiness: 'blocked'
      blockingReason: 'remote-endpoint-deferred'
      previewSeverity: 'warning'
      remediationHint: 'wait-for-host-managed-remote-endpoint'
      retryDisposition: 'defer-until-host-managed-remote-endpoint'
      requiredHostCapability: 'host-managed-remote-publish-endpoint'
      requiredHostCapabilityStatus: 'unavailable'
      requiredHostCapabilityVerificationMethod: 'host-managed-capability-check'
      requiredHostCapabilityVerificationTarget: 'remote-publish-endpoint-readiness'
      requiredHostCapabilityVerificationEvidence: 'host-reported-endpoint-availability'
      requiredHostCapabilityOwner: 'host-runtime'
      previewSummary: string
      hostHandoffChecklist: readonly string[]
      hostHandoffManifest: {
        kind: 'lark-app-publish-preview'
        version: '1'
        action: 'publish-approved-artifact'
        idempotencyKey: string
        targetResource: string
        publishReadiness: 'blocked'
        blockingReason: 'remote-endpoint-deferred'
        severity: 'warning'
        remediationHint: 'wait-for-host-managed-remote-endpoint'
        retryDisposition: 'defer-until-host-managed-remote-endpoint'
        requiredHostCapability: 'host-managed-remote-publish-endpoint'
        requiredHostCapabilityStatus: 'unavailable'
        requiredHostCapabilityVerificationMethod: 'host-managed-capability-check'
        requiredHostCapabilityVerificationTarget: 'remote-publish-endpoint-readiness'
        requiredHostCapabilityVerificationEvidence: 'host-reported-endpoint-availability'
        requiredHostCapabilityOwner: 'host-runtime'
        nextStep: 'await-host-managed-remote-publish'
        summary: string
        checklist: readonly string[]
      }
      applyMode: 'preview-only'
      remoteEndpoint: 'deferred'
      nextStep: 'await-host-managed-remote-publish'
    }
  | {
      ok: true
      status: 'applied'
      action: 'import-source-document'
      idempotencyKey: string
      auditRequired: true
      dryRun: false
      fileId: string | null
      name: string | null
      warningCount: number
    }
  | {
      ok: false
      error: string
      retryable: boolean
    }

const SECRET_LIKE_KEY_PATTERN =
  /(tenant[_-]?access[_-]?token|app[_-]?secret|password|credential|authorization|cookie)/i

const FORBIDDEN_ENDPOINT_OVERRIDE_KEY_PATTERN = /^(remoteUrl|mcpUrl|endpointUrl|serverUrl)$/i

const readRequiredString = (value: unknown, label: string): string => {
  const text = String(value || '').trim()
  if (!text) throw new Error(`Lark App remote mutation contract requires ${label}.`)
  return text
}

const containsForbiddenMaterial = (value: unknown, pattern: RegExp): boolean => {
  if (value == null) return false
  if (Array.isArray(value)) return value.some(item => containsForbiddenMaterial(item, pattern))
  if (typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (pattern.test(key)) return true
    return containsForbiddenMaterial(child, pattern)
  })
}

const normalizeImportRequest = (
  action: LarkAppRemoteMutationAction,
  value: unknown,
): FeishuBaseSourceImportRequest | null => {
  if (action !== 'import-source-document') return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Lark App remote mutation contract requires importRequest for import-source-document.')
  }
  const record = value as Record<string, unknown>
  if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) {
    throw new Error('Lark App remote mutation contract requires importRequest.snapshot for import-source-document.')
  }
  return {
    fileId: record.fileId == null ? null : String(record.fileId),
    snapshot: record.snapshot as FeishuBaseSourceImportRequest['snapshot'],
  }
}

export function buildLarkAppRemoteMutationRequest(
  input: LarkAppRemoteMutationRequest,
): LarkAppRemoteMutationRequest {
  if (containsForbiddenMaterial(input, SECRET_LIKE_KEY_PATTERN)) {
    throw new Error('Lark App remote mutation contract must not contain secret material.')
  }
  if (containsForbiddenMaterial(input, FORBIDDEN_ENDPOINT_OVERRIDE_KEY_PATTERN)) {
    throw new Error('Lark App remote mutation contract must not override endpoint ownership.')
  }

  const action = readRequiredString(input.action, 'action') as LarkAppRemoteMutationAction
  if (!['import-source-document', 'publish-approved-artifact'].includes(action)) {
    throw new Error('Lark App remote mutation contract requires a supported action.')
  }

  const idempotencyKey = readRequiredString(input.idempotencyKey, 'idempotencyKey')
  const actorId = readRequiredString(input.authContext?.actorId, 'authContext.actorId')
  const auditReason = readRequiredString(input.authContext?.auditReason, 'authContext.auditReason')
  const actorType = readRequiredString(input.authContext?.actorType, 'authContext.actorType')
  const sessionMode = readRequiredString(input.authContext?.sessionMode, 'authContext.sessionMode')
  const artifactKind = readRequiredString(input.artifact?.kind, 'artifact.kind') as LarkAppRemoteMutationArtifactKind
  const targetResource = readRequiredString(input.artifact?.targetResource, 'artifact.targetResource')
  const surface = readRequiredString(input.surface, 'surface')

  if (!['user', 'service'].includes(actorType)) {
    throw new Error('Lark App remote mutation contract requires a supported authContext.actorType.')
  }
  if (!['backend-signed', 'host-issued'].includes(sessionMode)) {
    throw new Error('Lark App remote mutation contract requires a supported authContext.sessionMode.')
  }
  if (!['source-document', 'approved-artifact'].includes(artifactKind)) {
    throw new Error('Lark App remote mutation contract requires a supported artifact.kind.')
  }
  if (!['webpage', 'baseinfo', 'backend'].includes(surface)) {
    throw new Error('Lark App remote mutation contract requires a supported surface.')
  }
  if (!['reject-on-conflict', 'allow-if-match'].includes(String(input.conflictPolicy || ''))) {
    throw new Error('Lark App remote mutation contract requires an explicit conflictPolicy.')
  }
  if (action === 'import-source-document' && artifactKind !== 'source-document') {
    throw new Error('Lark App remote mutation import action requires artifact.kind = source-document.')
  }
  if (action === 'publish-approved-artifact' && artifactKind !== 'approved-artifact') {
    throw new Error('Lark App remote mutation publish action requires artifact.kind = approved-artifact.')
  }

  return {
    action,
    idempotencyKey,
    authContext: {
      actorId,
      actorType: actorType as 'user' | 'service',
      sessionMode: sessionMode as 'backend-signed' | 'host-issued',
      auditReason,
    },
    artifact: {
      kind: artifactKind,
      sourceDocumentId: input.artifact?.sourceDocumentId ? String(input.artifact.sourceDocumentId) : null,
      sourceFileId: input.artifact?.sourceFileId ? String(input.artifact.sourceFileId) : null,
      targetResource,
      checksum: input.artifact?.checksum ? String(input.artifact.checksum) : null,
    },
    importRequest: normalizeImportRequest(action, input.importRequest),
    dryRun: input.dryRun === true,
    conflictPolicy: input.conflictPolicy,
    surface: surface as 'webpage' | 'baseinfo' | 'backend',
  }
}

export function buildLarkAppRemoteMutationRequestExample(): string {
  return JSON.stringify(
    buildLarkAppRemoteMutationRequest({
      action: 'import-source-document',
      idempotencyKey: 'lark-import-20260606-001',
      authContext: {
        actorId: 'open_id:user123',
        actorType: 'user',
        sessionMode: 'backend-signed',
        auditReason: 'Import approved source document from reviewed Canvas workflow',
      },
      artifact: {
        kind: 'source-document',
        sourceDocumentId: 'kg-doc-123',
        sourceFileId: 'kg-source-123',
        targetResource: 'lark:base:table:review-imports',
        checksum: 'sha256:example',
      },
      importRequest: {
        fileId: 'kg-source-123',
        snapshot: {
          selection: {
            baseToken: 'bascn_example',
            tableId: 'tbl_example',
            viewId: 'vew_example',
            baseTitle: 'Example Base',
            tableName: 'Approved Imports',
            viewName: 'Default',
          },
        },
      },
      dryRun: true,
      conflictPolicy: 'reject-on-conflict',
      surface: 'webpage',
    }),
    null,
    2,
  )
}

export function createLarkAppRemoteMutationAcceptedResult(
  request: LarkAppRemoteMutationRequest,
): LarkAppRemoteMutationResult {
  const normalized = buildLarkAppRemoteMutationRequest(request)
  return {
    ok: true,
    status: 'accepted',
    action: normalized.action,
    idempotencyKey: normalized.idempotencyKey,
    auditRequired: true,
    dryRun: normalized.dryRun,
  }
}

export function createLarkAppRemoteMutationPreviewResult(
  request: LarkAppRemoteMutationRequest,
): LarkAppRemoteMutationResult {
  const normalized = buildLarkAppRemoteMutationRequest(request)
  if (normalized.action !== 'publish-approved-artifact' || normalized.dryRun !== true) {
    throw new Error(
      'Lark App remote mutation preview result requires publish-approved-artifact with dryRun = true.',
    )
  }
  const previewSummary =
    `Previewed publish-approved-artifact for ${normalized.artifact.targetResource}; ` +
    'publish remains blocked until the host-managed remote endpoint is shipped.'
  const hostHandoffChecklist = [
    'Verify host-managed remote publish endpoint availability.',
    'Reuse the preview idempotency key for the remote publish attempt.',
    'Preserve the explicit conflict policy during host-managed publish.',
  ] as const
  return {
    ok: true,
    status: 'previewed',
    action: 'publish-approved-artifact',
    idempotencyKey: normalized.idempotencyKey,
    auditRequired: true,
    dryRun: true,
    targetResource: normalized.artifact.targetResource,
    artifactKind: 'approved-artifact',
    sourceDocumentId: normalized.artifact.sourceDocumentId,
    sourceFileId: normalized.artifact.sourceFileId,
    checksum: normalized.artifact.checksum,
    conflictPolicy: normalized.conflictPolicy,
    sessionMode: normalized.authContext.sessionMode,
    surface: normalized.surface,
    auditReason: normalized.authContext.auditReason,
    publishReadiness: 'blocked',
    blockingReason: 'remote-endpoint-deferred',
    previewSeverity: 'warning',
    remediationHint: 'wait-for-host-managed-remote-endpoint',
    retryDisposition: 'defer-until-host-managed-remote-endpoint',
    requiredHostCapability: 'host-managed-remote-publish-endpoint',
    requiredHostCapabilityStatus: 'unavailable',
    requiredHostCapabilityVerificationMethod: 'host-managed-capability-check',
    requiredHostCapabilityVerificationTarget: 'remote-publish-endpoint-readiness',
    requiredHostCapabilityVerificationEvidence: 'host-reported-endpoint-availability',
    requiredHostCapabilityOwner: 'host-runtime',
    previewSummary,
    hostHandoffChecklist,
    hostHandoffManifest: {
      kind: 'lark-app-publish-preview',
      version: '1',
      action: 'publish-approved-artifact',
      idempotencyKey: normalized.idempotencyKey,
      targetResource: normalized.artifact.targetResource,
      publishReadiness: 'blocked',
      blockingReason: 'remote-endpoint-deferred',
      severity: 'warning',
      remediationHint: 'wait-for-host-managed-remote-endpoint',
      retryDisposition: 'defer-until-host-managed-remote-endpoint',
      requiredHostCapability: 'host-managed-remote-publish-endpoint',
      requiredHostCapabilityStatus: 'unavailable',
      requiredHostCapabilityVerificationMethod: 'host-managed-capability-check',
      requiredHostCapabilityVerificationTarget: 'remote-publish-endpoint-readiness',
      requiredHostCapabilityVerificationEvidence: 'host-reported-endpoint-availability',
      requiredHostCapabilityOwner: 'host-runtime',
      nextStep: 'await-host-managed-remote-publish',
      summary: previewSummary,
      checklist: hostHandoffChecklist,
    },
    applyMode: 'preview-only',
    remoteEndpoint: 'deferred',
    nextStep: 'await-host-managed-remote-publish',
  }
}

export function createLarkAppRemoteMutationAppliedResult(
  request: LarkAppRemoteMutationRequest,
  result: { fileId?: unknown; name?: unknown; warnings?: unknown[] },
): LarkAppRemoteMutationResult {
  const normalized = buildLarkAppRemoteMutationRequest(request)
  return {
    ok: true,
    status: 'applied',
    action: 'import-source-document',
    idempotencyKey: normalized.idempotencyKey,
    auditRequired: true,
    dryRun: false,
    fileId: typeof result.fileId === 'string' ? result.fileId : null,
    name: typeof result.name === 'string' ? result.name : null,
    warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
  }
}

export function buildLarkAppRemoteMutationPreviewResultExample(): string {
  return JSON.stringify(
    createLarkAppRemoteMutationPreviewResult({
      action: 'publish-approved-artifact',
      idempotencyKey: 'lark-publish-preview-20260606-001',
      authContext: {
        actorId: 'open_id:user123',
        actorType: 'user',
        sessionMode: 'backend-signed',
        auditReason: 'Preview approved artifact publish before remote endpoint rollout',
      },
      artifact: {
        kind: 'approved-artifact',
        sourceDocumentId: 'kg-doc-456',
        sourceFileId: 'kg-source-456',
        targetResource: 'lark:base:table:approved-artifacts',
        checksum: 'sha256:approved-example',
      },
      dryRun: true,
      conflictPolicy: 'reject-on-conflict',
      surface: 'webpage',
    }),
    null,
    2,
  )
}
