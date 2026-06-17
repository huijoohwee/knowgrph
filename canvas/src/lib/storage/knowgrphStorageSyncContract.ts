export const KNOWGRPH_STORAGE_API_VERSION = '2026-05-04'

export const KNOWGRPH_STORAGE_ROUTE_PATHS = {
  push: '/api/storage/push',
  pull: '/api/storage/pull',
  collabSave: '/api/storage/collab/save',
  chatSession: '/api/storage/chat/session',
  chatRelay: '/api/storage/chat/relay',
  chatPoliciesPrefix: '/api/storage/chat/policies/',
  chatAuditPrefix: '/api/storage/chat/audit/',
  exportPrefix: '/api/storage/export/',
  docPrefix: '/api/storage/doc/',
  defaultDocPrefix: '/api/storage/doc-default/',
  blobPrefix: '/api/storage/blob/',
  mediaAssetPersist: '/api/storage/media/assets',
  mediaAssetPrefix: '/api/storage/media/assets/',
  mediaPrefix: '/api/storage/media/',
  sourceFilesIndex: '/api/storage/source-files',
  sourceFilesIndexPrefix: '/api/storage/source-files/',
  sourceFilesLlms: '/api/storage/llms.txt',
} as const

export const KNOWGRPH_STORAGE_D1_BINDING_NAME = 'DB'
export const KNOWGRPH_STORAGE_R2_BLOB_BINDING_NAME = 'KNOWGRPH_STORAGE_BLOB_BUCKET'
export const KNOWGRPH_STORAGE_R2_MEDIA_BINDING_NAME = KNOWGRPH_STORAGE_R2_BLOB_BINDING_NAME
export const KNOWGRPH_STORAGE_R2_MEDIA_OBJECT_PREFIX = 'airvio'
export const KNOWGRPH_STORAGE_MEDIA_ACCESS_KV_BINDING_NAME = 'KNOWGRPH_MEDIA_ACCESS_KV'
export const KNOWGRPH_STORAGE_CANVAS_ROOM_BINDING_NAME = 'KNOWGRPH_CANVAS_ROOM'
export const KNOWGRPH_STORAGE_DEFAULT_WORKSPACE_ID = 'kgws:canonical-docs'
export const CLOUDFLARE_PAY_PER_CRAWL_DOC_URL =
  'https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/what-is-pay-per-crawl/index.md'
export const CLOUDFLARE_PAY_PER_CRAWL_REQUEST_HEADERS = {
  exactPrice: 'crawler-exact-price',
  maxPrice: 'crawler-max-price',
} as const
export const CLOUDFLARE_PAY_PER_CRAWL_RESPONSE_HEADERS = {
  price: 'crawler-price',
  charged: 'crawler-charged',
  error: 'crawler-error',
} as const
export const KNOWGRPH_STORAGE_CRAWLER_ACCESS_HEADERS = {
  source: 'x-knowgrph-crawler-source',
  payPerCrawlPolicy: 'x-knowgrph-pay-per-crawl-policy',
} as const

export const KNOWGRPH_STORAGE_COLLECTION_NAMES = [
  'documents',
  'documentChunks',
  'graphSnapshots',
  'syncOutbox',
  'syncCursor',
] as const

export const KNOWGRPH_STORAGE_D1_TABLE_NAMES = [
  'workspaces',
  'documents',
  'document_chunks',
  'graph_snapshots',
  'sync_devices',
  'sync_events',
] as const

export type KnowgrphStorageCollectionName = (typeof KNOWGRPH_STORAGE_COLLECTION_NAMES)[number]
export type KnowgrphStorageD1TableName = (typeof KNOWGRPH_STORAGE_D1_TABLE_NAMES)[number]

export type KnowgrphStorageEntityKind = 'document' | 'documentChunk' | 'graphSnapshot'
export type KnowgrphStorageMutationOp = 'upsert' | 'delete'

export type KgDocumentRecord = {
  id: string
  workspaceId: string
  canonicalPath: string
  title: string | null
  docType: string | null
  lang: string | null
  graphId: string | null
  sourceKind: 'markdown'
  contentMd: string
  contentHash: string
  parserVersion: string
  revision: number
  updatedAtMs: number
  deleted: boolean
}

export type KgDocumentChunkRecord = {
  id: string
  documentId: string
  workspaceId: string
  chunkKey: string
  chunkOrder: number
  heading: string | null
  markdown: string
  tokenEstimate: number
  contentHash: string
  updatedAtMs: number
}

export type KgGraphSnapshotRecord = {
  id: string
  documentId: string
  workspaceId: string
  graphRevision: number
  graphHash: string
  graphJson: Record<string, unknown>
  layoutJson: Record<string, unknown> | null
  derivedFromDocumentRevision: number
  updatedAtMs: number
}

export type KnowgrphStorageOutboxRecord = {
  id: string
  workspaceId: string
  deviceId: string
  entity: KnowgrphStorageEntityKind
  op: KnowgrphStorageMutationOp
  recordId: string
  baseRevision: number | null
  payload: Record<string, unknown>
  payloadHash: string
  attemptCount: number
  lastAckStatus: 'applied' | 'conflict' | 'rejected' | 'deferred' | ''
  lastAckMessage: string | null
  createdAtMs: number
  updatedAtMs: number
}

export type KnowgrphStorageCursorRecord = {
  id: string
  workspaceId: string
  deviceId: string
  lastPullCursor: string | null
  lastPushCursor: string | null
  serverClockMs: number | null
  updatedAtMs: number
}

export type KnowgrphStorageMutationRecord =
  | KgDocumentRecord
  | KgDocumentChunkRecord
  | KgGraphSnapshotRecord

export type KnowgrphStorageMutation =
  | {
      mutationId: string
      workspaceId: string
      entity: 'document'
      op: KnowgrphStorageMutationOp
      recordId: string
      baseRevision: number | null
      record: KgDocumentRecord
    }
  | {
      mutationId: string
      workspaceId: string
      entity: 'documentChunk'
      op: KnowgrphStorageMutationOp
      recordId: string
      baseRevision: number | null
      record: KgDocumentChunkRecord
    }
  | {
      mutationId: string
      workspaceId: string
      entity: 'graphSnapshot'
      op: KnowgrphStorageMutationOp
      recordId: string
      baseRevision: number | null
      record: KgGraphSnapshotRecord
    }

export type KnowgrphStoragePushRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  deviceId: string
  mutations: KnowgrphStorageMutation[]
}

export type KnowgrphStorageMutationAck = {
  mutationId: string
  recordId: string
  entity: KnowgrphStorageEntityKind
  status: 'applied' | 'conflict' | 'rejected'
  serverRevision: number | null
  message: string | null
}

export type KnowgrphStoragePushResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  ackCursor: string
  serverTimeMs: number
  acknowledgements: KnowgrphStorageMutationAck[]
}

export type KnowgrphStorageErrorResponse = {
  ok: false
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  error: string
  code: 'bad_request' | 'conflict' | 'forbidden' | 'not_found' | 'server_error'
}

export type KnowgrphStorageChatRole =
  | 'viewer'
  | 'editor'
  | 'owner'
  | 'provider-admin'

export type KnowgrphStorageChatProviderId =
  | 'openai'
  | 'miromind'
  | 'agnes-ai'
  | 'byteplus-modelark'
  | 'qwen'
  | 'google-cloud'

export type KnowgrphStorageChatAuthMode = 'serverManaged' | 'byok'

export type KnowgrphStorageChatPolicyRecord = {
  workspaceId: string
  providerId: KnowgrphStorageChatProviderId
  allowServerManaged: boolean
  allowByok: boolean
  monthlyRequestLimit: number | null
  monthlyTokenLimit: number | null
  monthlySpendLimitCents: number | null
  defaultModel: string | null
  updatedAtMs: number | null
}

export type KnowgrphStorageChatSessionMembership = {
  workspaceId: string
  role: KnowgrphStorageChatRole
  status: string
}

export type KnowgrphStorageChatSessionResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  user: {
    id: string
    email: string
    displayName: string
    status: string
  }
  session: {
    id: string
    expiresAt: string
  }
  memberships: KnowgrphStorageChatSessionMembership[]
}

export type KnowgrphStorageChatPoliciesResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  membership: {
    userId: string
    role: KnowgrphStorageChatRole
    status: string
  }
  policies: KnowgrphStorageChatPolicyRecord[]
}

export type KnowgrphStorageChatAuditEntry = {
  id: string
  workspaceId: string
  userId: string
  membershipId: string
  providerId: string
  authMode: KnowgrphStorageChatAuthMode
  requestId: string | null
  upstreamStatus: number | null
  relayStatus: string
  modelId: string | null
  requestBytes: number | null
  responseBytes: number | null
  latencyMs: number | null
  errorCode: string | null
  errorMessage: string | null
  createdAtMs: number | null
}

export type KnowgrphStorageChatAuditResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  entries: KnowgrphStorageChatAuditEntry[]
}

export type KnowgrphStorageChatRelayMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export type KnowgrphStorageChatRelayRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  providerId: KnowgrphStorageChatProviderId
  authMode: KnowgrphStorageChatAuthMode
  endpointUrl?: string | null
  model: string
  messages: KnowgrphStorageChatRelayMessage[]
  stream?: boolean
  byokApiKey?: string | null
  providerOptions?: Record<string, unknown> | null
}

export type KnowgrphStorageChatRelayResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  providerId: KnowgrphStorageChatProviderId
  authMode: KnowgrphStorageChatAuthMode
  upstreamStatus: number
  relayStatus: 'allowed'
  body: unknown
}

export type KnowgrphStoragePullRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  deviceId: string
  since: string | null
}

export type KnowgrphStoragePullChanges = {
  documents: KgDocumentRecord[]
  documentChunks: KgDocumentChunkRecord[]
  graphSnapshots: KgGraphSnapshotRecord[]
}

export type KnowgrphStoragePullResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  nextCursor: string
  serverTimeMs: number
  changes: KnowgrphStoragePullChanges
}

export type KnowgrphStorageExportResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  exportedAtMs: number
  documents: KgDocumentRecord[]
  documentChunks: KgDocumentChunkRecord[]
  graphSnapshots: KgGraphSnapshotRecord[]
}

export type KnowgrphStorageBlobUploadResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  canonicalPath: string
  objectKey: string
  contentType: string
  contentHash: string | null
  sizeBytes: number | null
  etag: string | null
  uploadedAtMs: number
  publicPath: string
}

export type KnowgrphMediaArtifactKind = 'text' | 'image' | 'audio' | 'video' | 'binary'

export type KnowgrphMediaAssetPersistRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  objectKey: string
  runId: string
  stageId: string
  shotId: string
  kind: KnowgrphMediaArtifactKind
  durableR2Url: string
  contentHash: string
  mediaType: string | null
  provenance: Record<string, unknown>
  layout?: Record<string, unknown> | null
  version: number
  presignedUrl?: string | null
  accessTtlSeconds?: number | null
  collaborationRoomId?: string | null
}

export type KnowgrphMediaAssetPersistResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  artifactId: string
  objectKey: string
  publicPath: string
  durableR2Url: string
  contentHash: string
  storage: {
    r2: 'confirmed'
    d1: 'persisted' | 'reused'
    kv: 'cached' | 'binding_missing' | 'skipped'
    durableObject: 'broadcasted' | 'binding_missing' | 'skipped'
  }
  access: {
    cacheKey: string | null
    expiresAtMs: number | null
    url: string | null
  }
}

export type KnowgrphCollaborationDocumentKind = 'markdown' | 'json'

export type KnowgrphCollaborationSaveRequest = {
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  documentKey: string
  documentKind: KnowgrphCollaborationDocumentKind
  serializedText: string
  yjsStateBase64: string
  activePeerCount: number
  pocketBaseRoomId: string | null
  savedByPeerId: string | null
  saveBoundary: 'explicit' | 'autosave'
}

export type KnowgrphCollaborationSaveResponse = {
  ok: true
  apiVersion: typeof KNOWGRPH_STORAGE_API_VERSION
  workspaceId: string
  documentKey: string
  githubPath: string
  commitSha: string | null
  contentSha: string | null
  committedAtMs: number
}

export type KnowgrphStorageR2ObjectLike = {
  body?: ReadableStream<Uint8Array> | null
  httpEtag?: string
  etag?: string
  size?: number
  writeHttpMetadata?: (headers: Headers) => void
}

export type KnowgrphStorageR2BucketLike = {
  put: (
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | Blob | string | null,
    options?: {
      httpMetadata?: Record<string, string>
      customMetadata?: Record<string, string>
    },
  ) => Promise<KnowgrphStorageR2ObjectLike | null | undefined>
  get: (key: string) => Promise<KnowgrphStorageR2ObjectLike | null | undefined>
  head?: (key: string) => Promise<KnowgrphStorageR2ObjectLike | null | undefined>
  delete?: (key: string) => Promise<void>
}

export type KnowgrphStorageKvNamespaceLike = {
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
  ) => Promise<void>
  get?: (key: string, type?: 'text' | 'json') => Promise<unknown>
  delete?: (key: string) => Promise<void>
}

export type KnowgrphStorageDurableObjectStubLike = {
  fetch: (request: Request | string, init?: RequestInit) => Promise<Response>
}

export type KnowgrphStorageDurableObjectNamespaceLike = {
  idFromName: (name: string) => unknown
  get: (id: unknown) => KnowgrphStorageDurableObjectStubLike
}

export type KnowgrphStorageWorkerEnv = {
  DB: unknown
  KNOWGRPH_STORAGE_SIGNING_SECRET?: string
  KNOWGRPH_STORAGE_CHAT_PROXY_BASE_URL?: string
  KNOWGRPH_STORAGE_BLOB_BUCKET?: KnowgrphStorageR2BucketLike
  KNOWGRPH_MEDIA_ACCESS_KV?: KnowgrphStorageKvNamespaceLike
  KNOWGRPH_CANVAS_ROOM?: KnowgrphStorageDurableObjectNamespaceLike
  KNOWGRPH_STORAGE_BLOB_MAX_BYTES?: string
  KNOWGRPH_STORAGE_GITHUB_TOKEN?: string
  KNOWGRPH_STORAGE_GITHUB_OWNER?: string
  KNOWGRPH_STORAGE_GITHUB_REPO?: string
  KNOWGRPH_STORAGE_GITHUB_BRANCH?: string
  KNOWGRPH_STORAGE_GITHUB_COMMITTER_NAME?: string
  KNOWGRPH_STORAGE_GITHUB_COMMITTER_EMAIL?: string
  KNOWGRPH_STORAGE_POCKETBASE_URL?: string
  KNOWGRPH_STORAGE_POCKETBASE_TOKEN?: string
}

export const isKnowgrphStorageEntityKind = (value: unknown): value is KnowgrphStorageEntityKind =>
  value === 'document' || value === 'documentChunk' || value === 'graphSnapshot'

export const buildKnowgrphStoragePullRequest = (args: {
  workspaceId: string
  deviceId: string
  since?: string | null
}): KnowgrphStoragePullRequest => ({
  apiVersion: KNOWGRPH_STORAGE_API_VERSION,
  workspaceId: String(args.workspaceId || '').trim(),
  deviceId: String(args.deviceId || '').trim(),
  since: typeof args.since === 'string' && args.since.trim() ? args.since.trim() : null,
})

export const buildKnowgrphCollaborationSavePath = (): string =>
  KNOWGRPH_STORAGE_ROUTE_PATHS.collabSave

export const buildKnowgrphStorageChatSessionPath = (): string =>
  KNOWGRPH_STORAGE_ROUTE_PATHS.chatSession

export const buildKnowgrphStorageChatRelayPath = (): string =>
  KNOWGRPH_STORAGE_ROUTE_PATHS.chatRelay

export const buildKnowgrphStorageChatPoliciesPath = (workspaceId: string): string =>
  `${KNOWGRPH_STORAGE_ROUTE_PATHS.chatPoliciesPrefix}${encodeURIComponent(String(workspaceId || '').trim())}`

export const buildKnowgrphStorageChatAuditPath = (workspaceId: string): string =>
  `${KNOWGRPH_STORAGE_ROUTE_PATHS.chatAuditPrefix}${encodeURIComponent(String(workspaceId || '').trim())}`

export const buildKnowgrphStorageExportPath = (workspaceId: string): string =>
  `/api/storage/export/${encodeURIComponent(String(workspaceId || '').trim())}`

export const buildKnowgrphStorageDocPath = (workspaceId: string, canonicalPath: string): string =>
  `${KNOWGRPH_STORAGE_ROUTE_PATHS.docPrefix}${encodeURIComponent(String(workspaceId || '').trim())}/${encodeURIComponent(String(canonicalPath || '').trim())}`

export const buildKnowgrphStorageDefaultDocPath = (canonicalPath: string): string =>
  `${KNOWGRPH_STORAGE_ROUTE_PATHS.defaultDocPrefix}${encodeURIComponent(String(canonicalPath || '').trim())}`

export const buildKnowgrphStorageBlobPath = (workspaceId: string, canonicalPath: string): string =>
  `${KNOWGRPH_STORAGE_ROUTE_PATHS.blobPrefix}${encodeURIComponent(String(workspaceId || '').trim())}/${encodeURIComponent(String(canonicalPath || '').trim())}`

export const buildKnowgrphStorageMediaPath = (objectKey: string): string =>
  `${KNOWGRPH_STORAGE_ROUTE_PATHS.mediaPrefix}${String(objectKey || '').trim().split('/').map(encodeURIComponent).join('/')}`

export const buildKnowgrphStorageMediaAssetPersistPath = (): string =>
  KNOWGRPH_STORAGE_ROUTE_PATHS.mediaAssetPersist

export const buildKnowgrphStorageSourceFilesIndexPath = (workspaceId?: string | null): string => {
  const normalizedWorkspaceId = String(workspaceId || '').trim()
  return normalizedWorkspaceId
    ? `${KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndexPrefix}${encodeURIComponent(normalizedWorkspaceId)}`
    : KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesIndex
}

export const buildKnowgrphStorageLlmsPath = (workspaceId?: string | null): string => {
  const normalizedWorkspaceId = String(workspaceId || '').trim()
  return normalizedWorkspaceId
    ? `${buildKnowgrphStorageSourceFilesIndexPath(normalizedWorkspaceId)}/llms.txt`
    : KNOWGRPH_STORAGE_ROUTE_PATHS.sourceFilesLlms
}

export const buildKnowgrphStorageCursorId = (workspaceId: string, deviceId: string): string =>
  `${String(workspaceId || '').trim()}:${String(deviceId || '').trim()}`

export const buildKnowgrphStorageOutboxId = (prefix = 'mut'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`
}
