import worker from '../../../cloudflare/workers/knowgrph-storage/index.ts'
import { createFakeKnowgrphStorageWorkerEnv } from '@/__tests__/helpers/fakeKnowgrphStorageD1'
import {
  __resetKnowgrphStorageDbForTests,
  getKnowgrphStorageDb,
} from '@/lib/storage/knowgrphStorageRxdb'
import {
  exportKnowgrphStorageWorkspace,
  getKnowgrphStorageDeviceId,
  queueKnowgrphStorageMutation,
  syncKnowgrphStorageNow,
} from '@/lib/storage/knowgrphStorageClientSync'
import { applyPulledKnowgrphStorageChangesToSourceFiles } from '@/features/source-files/sourceFilesInboundStorageApply'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KNOWGRPH_STORAGE_API_VERSION } from '@/lib/storage/knowgrphStorageSyncContract'

const createWorkerFetch = (env: ReturnType<typeof createFakeKnowgrphStorageWorkerEnv>) => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(String(input), init)
    return worker.fetch(request, env as never)
  }
}

export async function testKnowgrphStorageClientSyncPushesOutboxAndUpdatesCursor() {
  await __resetKnowgrphStorageDbForTests()
  const env = createFakeKnowgrphStorageWorkerEnv()
  const fetchImpl = createWorkerFetch(env)
  const dbState = await getKnowgrphStorageDb()
  const deviceId = getKnowgrphStorageDeviceId({
    getItem: () => null,
    setItem: () => void 0,
  } as unknown as Storage)

  await queueKnowgrphStorageMutation({
    workspaceId: 'wk_client_push',
    deviceId,
    entity: 'document',
    op: 'upsert',
    record: {
      id: 'doc_client_push',
      workspaceId: 'wk_client_push',
      canonicalPath: 'docs/client-push.md',
      title: 'Client Push',
      docType: 'note',
      lang: 'en-US',
      graphId: 'graph_client_push',
      sourceKind: 'markdown',
      contentMd: '# Client Push',
      contentHash: 'sha256:client-push',
      parserVersion: '1.0.0',
      revision: 1,
      updatedAtMs: 1_777_100_000_000,
      deleted: false,
    },
    dbState,
  })

  const before = await dbState.collections.syncOutbox.find().exec()
  if (before.length !== 1) throw new Error('expected one queued outbox mutation before sync')

  const result = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_push',
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
  })

  if (result.pushedCount !== 1 || result.appliedCount !== 1) {
    throw new Error(`expected one pushed/applied mutation, received pushed=${result.pushedCount} applied=${result.appliedCount}`)
  }

  const afterOutbox = await dbState.collections.syncOutbox.find().exec()
  if (afterOutbox.length !== 0) throw new Error('expected sync to clear applied outbox mutations')

  const cursor = await dbState.collections.syncCursor.findOne(`wk_client_push:${deviceId}`).exec()
  if (!cursor) throw new Error('expected sync cursor row to be written after a successful sync')
  if (!String(cursor.get('lastPushCursor') || '')) throw new Error('expected lastPushCursor to be set after push')
  if (!String(cursor.get('lastPullCursor') || '')) throw new Error('expected lastPullCursor to be set after pull')

  const exported = await exportKnowgrphStorageWorkspace({
    workspaceId: 'wk_client_push',
    baseUrl: 'https://example.com',
    fetchImpl,
  })
  if (exported.documents.length !== 1) throw new Error('expected workspace export to include the pushed document')

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncPullsRemoteChangesIntoRxdb() {
  await __resetKnowgrphStorageDbForTests()
  const env = createFakeKnowgrphStorageWorkerEnv()
  const fetchImpl = createWorkerFetch(env)
  const dbState = await getKnowgrphStorageDb()
  const deviceId = 'dev_pull_local'

  const remoteSeedResponse = await worker.fetch(
    new Request('https://example.com/api/storage/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_client_pull',
        deviceId: 'dev_remote_writer',
        mutations: [
          {
            mutationId: 'mut_remote_doc',
            workspaceId: 'wk_client_pull',
            entity: 'document',
            op: 'upsert',
            recordId: 'doc_remote_pull',
            baseRevision: null,
            record: {
              id: 'doc_remote_pull',
              workspaceId: 'wk_client_pull',
              canonicalPath: 'docs/remote-pull.md',
              title: 'Remote Pull',
              docType: 'note',
              lang: 'en-US',
              graphId: null,
              sourceKind: 'markdown',
              contentMd: '# Remote Pull',
              contentHash: 'sha256:remote-pull',
              parserVersion: '1.0.0',
              revision: 1,
              updatedAtMs: 1_777_100_000_500,
              deleted: false,
            },
          },
          {
            mutationId: 'mut_remote_chunk',
            workspaceId: 'wk_client_pull',
            entity: 'documentChunk',
            op: 'upsert',
            recordId: 'chunk_remote_pull',
            baseRevision: null,
            record: {
              id: 'chunk_remote_pull',
              documentId: 'doc_remote_pull',
              workspaceId: 'wk_client_pull',
              chunkKey: 'frontmatter',
              chunkOrder: 0,
              heading: null,
              markdown: 'title: Remote Pull',
              tokenEstimate: 8,
              contentHash: 'sha256:remote-chunk',
              updatedAtMs: 1_777_100_000_550,
            },
          },
        ],
      }),
    }),
    env as never,
  )
  if (!remoteSeedResponse.ok) throw new Error('expected remote seed push to succeed before client pull')

  const result = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_pull',
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
  })

  if (result.pulledDocumentCount !== 1 || result.pulledChunkCount !== 1) {
    throw new Error(`expected one pulled document and one pulled chunk, received docs=${result.pulledDocumentCount} chunks=${result.pulledChunkCount}`)
  }

  const documentRow = await dbState.collections.documents.findOne('doc_remote_pull').exec()
  if (!documentRow) throw new Error('expected remote document to be materialized into local RxDB after pull')
  const chunkRow = await dbState.collections.documentChunks.findOne('chunk_remote_pull').exec()
  if (!chunkRow) throw new Error('expected remote chunk to be materialized into local RxDB after pull')

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncSanitizesNullNumericFieldsFromPullPayloads() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  const workspaceId = 'wk_client_pull_null_numeric'
  const deviceId = 'dev_pull_null_numeric'
  const fetchImpl: typeof fetch = async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('/api/storage/push')) {
      return new Response(
        JSON.stringify({
          ok: true,
          apiVersion: KNOWGRPH_STORAGE_API_VERSION,
          workspaceId,
          ackCursor: 'ack:null-numeric',
          serverTimeMs: 1_777_300_000_000,
          acknowledgements: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    if (url.endsWith('/api/storage/pull')) {
      return new Response(
        JSON.stringify({
          ok: true,
          apiVersion: KNOWGRPH_STORAGE_API_VERSION,
          workspaceId,
          nextCursor: 'pull:null-numeric',
          serverTimeMs: 1_777_300_000_100,
          changes: {
            documents: [
              {
                id: 'doc_null_numeric',
                workspaceId,
                canonicalPath: 'docs/null-numeric.md',
                title: 'Null Numeric',
                docType: 'note',
                lang: 'en-US',
                graphId: 'graph_null_numeric',
                sourceKind: 'markdown',
                contentMd: '# Null Numeric',
                contentHash: 'sha256:null-numeric',
                parserVersion: '1.0.0',
                revision: null,
                updatedAtMs: null,
                deleted: false,
              },
            ],
            documentChunks: [
              {
                id: 'chunk_null_numeric',
                documentId: 'doc_null_numeric',
                workspaceId,
                chunkKey: 'body',
                chunkOrder: null,
                heading: null,
                markdown: 'Body',
                tokenEstimate: null,
                contentHash: 'sha256:null-chunk',
                updatedAtMs: null,
              },
            ],
            graphSnapshots: [
              {
                id: 'graph_null_numeric',
                documentId: 'doc_null_numeric',
                workspaceId,
                graphRevision: null,
                graphHash: 'sha256:null-graph',
                graphJson: null,
                layoutJson: [],
                derivedFromDocumentRevision: null,
                updatedAtMs: null,
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response('not found', { status: 404 })
  }

  const result = await syncKnowgrphStorageNow({
    workspaceId,
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
  })
  if (result.pulledDocumentCount !== 1 || result.pulledChunkCount !== 1 || result.pulledGraphSnapshotCount !== 1) {
    throw new Error('expected one pulled document/chunk/graph snapshot in null-numeric sanitization regression test')
  }
  const docRow = await dbState.collections.documents.findOne('doc_null_numeric').exec()
  if (!docRow) throw new Error('expected sanitized pulled document row')
  if (Number(docRow.get('documentRevision')) !== 0) throw new Error('expected null document revision to sanitize to 0')
  if (Number(docRow.get('updatedAtMs')) !== 0) throw new Error('expected null document updatedAtMs to sanitize to 0')

  const chunkRow = await dbState.collections.documentChunks.findOne('chunk_null_numeric').exec()
  if (!chunkRow) throw new Error('expected sanitized pulled document chunk row')
  if (Number(chunkRow.get('chunkOrder')) !== 0) throw new Error('expected null chunkOrder to sanitize to deterministic index fallback')
  if (Number(chunkRow.get('tokenEstimate')) !== 0) throw new Error('expected null tokenEstimate to sanitize to 0')
  if (Number(chunkRow.get('updatedAtMs')) !== 0) throw new Error('expected null chunk updatedAtMs to sanitize to 0')

  const graphRow = await dbState.collections.graphSnapshots.findOne('graph_null_numeric').exec()
  if (!graphRow) throw new Error('expected sanitized pulled graph snapshot row')
  if (Number(graphRow.get('graphRevision')) !== 0) throw new Error('expected null graphRevision to sanitize to 0')
  if (Number(graphRow.get('derivedFromDocumentRevision')) !== 0) throw new Error('expected null derivedFromDocumentRevision to sanitize to 0')
  if (Number(graphRow.get('updatedAtMs')) !== 0) throw new Error('expected null graph updatedAtMs to sanitize to 0')
  const graphJson = graphRow.get('graphJson') as unknown
  if (!graphJson || typeof graphJson !== 'object' || Array.isArray(graphJson)) {
    throw new Error('expected invalid non-object graphJson to sanitize to object')
  }
  if (graphRow.get('layoutJson') !== null) throw new Error('expected invalid array layoutJson to sanitize to null')

  await __resetKnowgrphStorageDbForTests()
}

export async function testQueueKnowgrphStorageMutationSanitizesNullNumericFieldsInOutboundRecords() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  const badGraphJson: Record<string, unknown> = { label: 'bad' }
  badGraphJson.fn = () => void 0
  badGraphJson.self = badGraphJson
  const mutationId = await queueKnowgrphStorageMutation({
    workspaceId: 'wk_outbound_null_numeric',
    deviceId: 'dev_outbound_null_numeric',
    entity: 'graphSnapshot',
    op: 'upsert',
    record: {
      id: 'graph_outbound_null_numeric',
      documentId: 'doc_outbound_null_numeric',
      workspaceId: 'wk_outbound_null_numeric',
      graphRevision: null as unknown as number,
      graphHash: 'sha256:outbound-null-graph',
      graphJson: badGraphJson as unknown as Record<string, unknown>,
      layoutJson: [] as unknown as Record<string, unknown>,
      derivedFromDocumentRevision: null as unknown as number,
      updatedAtMs: null as unknown as number,
    },
    dbState,
  })
  const row = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (!row) throw new Error('expected queued outbox mutation for outbound null-numeric sanitization test')
  const payload = row.get('payload') as unknown as { record?: Record<string, unknown> }
  const record = (payload?.record || {}) as Record<string, unknown>
  if (Number(record.graphRevision) !== 0) throw new Error('expected outbound graphRevision to sanitize to 0')
  if (Number(record.derivedFromDocumentRevision) !== 0) throw new Error('expected outbound derivedFromDocumentRevision to sanitize to 0')
  if (Number(record.updatedAtMs) !== 0) throw new Error('expected outbound updatedAtMs to sanitize to 0')
  if (!record.graphJson || typeof record.graphJson !== 'object' || Array.isArray(record.graphJson)) {
    throw new Error('expected outbound invalid graphJson to sanitize to object')
  }
  const graphJson = record.graphJson as Record<string, unknown>
  if (typeof graphJson.fn !== 'undefined') throw new Error('expected outbound graphJson function field to be removed for clone safety')
  if (graphJson.self !== null) throw new Error('expected outbound circular graphJson reference to sanitize to null')
  if (record.layoutJson !== null) throw new Error('expected outbound invalid array layoutJson to sanitize to null')
  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncSanitizesLegacyOutboxPayloadsBeforePush() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  const workspaceId = 'wk_legacy_outbox_sanitize'
  const deviceId = 'dev_legacy_outbox_sanitize'
  const mutationId = 'mut_legacy_outbox_sanitize'
  const legacyMutation = {
    mutationId,
    workspaceId,
    entity: 'graphSnapshot',
    op: 'upsert',
    recordId: 'graph_legacy_null_numeric',
    baseRevision: null,
    record: {
      id: 'graph_legacy_null_numeric',
      documentId: 'doc_legacy_null_numeric',
      workspaceId,
      graphRevision: null,
      graphHash: 'sha256:legacy-null-graph',
      graphJson: null,
      layoutJson: [],
      derivedFromDocumentRevision: null,
      updatedAtMs: null,
    },
  } as const
  await dbState.collections.syncOutbox.incrementalUpsert({
    id: mutationId,
    workspaceId,
    deviceId,
    entity: 'graphSnapshot',
    op: 'upsert',
    recordId: legacyMutation.recordId,
    baseRevision: null,
    payload: legacyMutation as unknown as Record<string, unknown>,
    payloadHash: 'legacy',
    attemptCount: 0,
    lastAckStatus: '',
    lastAckMessage: null,
    createdAtMs: 1,
    updatedAtMs: 1,
  })

  let pushedMutation: Record<string, unknown> | null = null
  const fetchImpl: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('/api/storage/push')) {
      const bodyText = String(init?.body || '')
      const body = JSON.parse(bodyText) as { mutations?: Array<Record<string, unknown>> }
      pushedMutation = (body.mutations || [])[0] || null
      return new Response(
        JSON.stringify({
          ok: true,
          apiVersion: KNOWGRPH_STORAGE_API_VERSION,
          workspaceId,
          ackCursor: 'ack:legacy-outbox',
          serverTimeMs: 1_777_310_000_000,
          acknowledgements: [
            {
              mutationId,
              recordId: legacyMutation.recordId,
              entity: 'graphSnapshot',
              status: 'applied',
              serverRevision: 1,
              message: null,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    if (url.endsWith('/api/storage/pull')) {
      return new Response(
        JSON.stringify({
          ok: true,
          apiVersion: KNOWGRPH_STORAGE_API_VERSION,
          workspaceId,
          nextCursor: 'pull:legacy-outbox',
          serverTimeMs: 1_777_310_000_100,
          changes: { documents: [], documentChunks: [], graphSnapshots: [] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response('not found', { status: 404 })
  }

  const result = await syncKnowgrphStorageNow({
    workspaceId,
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
  })
  if (result.pushedCount !== 1 || result.appliedCount !== 1) {
    throw new Error('expected legacy outbox payload sync to push and apply one mutation')
  }
  const pushedRecord = ((pushedMutation?.record || {}) as Record<string, unknown>)
  if (Number(pushedRecord.graphRevision) !== 0) throw new Error('expected legacy pushed graphRevision to sanitize to 0')
  if (Number(pushedRecord.derivedFromDocumentRevision) !== 0) throw new Error('expected legacy pushed derivedFromDocumentRevision to sanitize to 0')
  if (Number(pushedRecord.updatedAtMs) !== 0) throw new Error('expected legacy pushed updatedAtMs to sanitize to 0')
  if (!pushedRecord.graphJson || typeof pushedRecord.graphJson !== 'object' || Array.isArray(pushedRecord.graphJson)) {
    throw new Error('expected legacy pushed invalid graphJson to sanitize to object')
  }
  if (pushedRecord.layoutJson !== null) throw new Error('expected legacy pushed invalid array layoutJson to sanitize to null')

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncRepairsLegacyTopLevelNullNumericOutboxFieldsBeforeSync() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  const workspaceId = 'wk_legacy_top_level_numeric_null'
  const deviceId = 'dev_legacy_top_level_numeric_null'
  const mutationId = 'mut_legacy_top_level_numeric_null'
  const legacyMutation = {
    mutationId,
    workspaceId,
    entity: 'document',
    op: 'upsert',
    recordId: 'doc_legacy_top_level_numeric_null',
    baseRevision: null,
    record: {
      id: 'doc_legacy_top_level_numeric_null',
      workspaceId,
      canonicalPath: 'docs/legacy-top-level-null.md',
      title: null,
      docType: 'note',
      lang: 'en-US',
      graphId: null,
      sourceKind: 'markdown',
      contentMd: '# Legacy',
      contentHash: 'sha256:legacy-top-level-null',
      parserVersion: '1.0.0',
      revision: 1,
      updatedAtMs: 1,
      deleted: false,
    },
  } as const
  await dbState.collections.syncOutbox.incrementalUpsert({
    id: mutationId,
    workspaceId,
    deviceId,
    entity: 'document',
    op: 'upsert',
    recordId: legacyMutation.recordId,
    baseRevision: null,
    payload: legacyMutation as unknown as Record<string, unknown>,
    payloadHash: 'legacy-top-level-null',
    attemptCount: null as unknown as number,
    lastAckStatus: '',
    lastAckMessage: null,
    createdAtMs: null as unknown as number,
    updatedAtMs: null as unknown as number,
  })

  await syncKnowgrphStorageNow({
    workspaceId,
    deviceId,
    baseUrl: 'http://127.0.0.1:5174',
    fetchImpl: async () => {
      throw new TypeError('Load failed')
    },
    dbState,
  })

  const repairedRow = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (!repairedRow) throw new Error('expected legacy outbox row to remain after route-unavailable sync skip')
  if (Number(repairedRow.get('attemptCount')) !== 0) throw new Error('expected top-level attemptCount null to repair to 0')
  if (Number(repairedRow.get('createdAtMs')) !== 0) throw new Error('expected top-level createdAtMs null to repair to 0')
  if (Number(repairedRow.get('updatedAtMs')) !== 0) throw new Error('expected top-level updatedAtMs null to repair to 0')

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncRetainsConflictingOutboxMutationsForResolution() {
  await __resetKnowgrphStorageDbForTests()
  const env = createFakeKnowgrphStorageWorkerEnv()
  const fetchImpl = createWorkerFetch(env)
  const dbState = await getKnowgrphStorageDb()
  const deviceId = 'dev_conflict_local'

  await worker.fetch(
    new Request('https://example.com/api/storage/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_client_conflict',
        deviceId: 'dev_remote_seed',
        mutations: [
          {
            mutationId: 'mut_seed_conflict',
            workspaceId: 'wk_client_conflict',
            entity: 'document',
            op: 'upsert',
            recordId: 'doc_conflict',
            baseRevision: null,
            record: {
              id: 'doc_conflict',
              workspaceId: 'wk_client_conflict',
              canonicalPath: 'docs/conflict.md',
              title: 'Conflict',
              docType: 'note',
              lang: 'en-US',
              graphId: null,
              sourceKind: 'markdown',
              contentMd: '# Server',
              contentHash: 'sha256:server',
              parserVersion: '1.0.0',
              revision: 2,
              updatedAtMs: 1_777_100_001_000,
              deleted: false,
            },
          },
        ],
      }),
    }),
    env as never,
  )

  const mutationId = await queueKnowgrphStorageMutation({
    workspaceId: 'wk_client_conflict',
    deviceId,
    entity: 'document',
    op: 'upsert',
    baseRevision: 1,
    record: {
      id: 'doc_conflict',
      workspaceId: 'wk_client_conflict',
      canonicalPath: 'docs/conflict.md',
      title: 'Conflict',
      docType: 'note',
      lang: 'en-US',
      graphId: null,
      sourceKind: 'markdown',
      contentMd: '# Local stale',
      contentHash: 'sha256:local-stale',
      parserVersion: '1.0.0',
      revision: 1,
      updatedAtMs: 1_777_100_001_100,
      deleted: false,
    },
    dbState,
  })

  const result = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_conflict',
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
  })
  if (result.conflictCount !== 0) throw new Error('expected stale outbox conflict to be auto-rebased and retried within sync cycle')
  if (result.unresolvedConflictCount !== 0) throw new Error('expected stale outbox conflict to be auto-rebased instead of staying unresolved')
  if (result.conflictEntries.length !== 0) {
    throw new Error('expected auto-rebased conflict to avoid surfacing retained conflict entries for manual UX flow')
  }

  const conflictRow = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (!conflictRow) throw new Error('expected auto-rebased mutation to stay queued for immediate retry cycle')
  if (Number(conflictRow.get('attemptCount') || 0) !== 0) {
    throw new Error('expected auto-rebased outbox row attemptCount to reset before retry')
  }
  if (String(conflictRow.get('lastAckStatus') || '').trim() !== '') {
    throw new Error('expected auto-rebased outbox row to clear conflict status so UX stays auto-sync')
  }
  if (!Number.isFinite(Number(conflictRow.get('baseRevision')))) {
    throw new Error('expected auto-rebased outbox row baseRevision to stay a finite number before retry')
  }

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncAutoRebasesRetainedConflictsBeforePush() {
  await __resetKnowgrphStorageDbForTests()
  const env = createFakeKnowgrphStorageWorkerEnv()
  const fetchImpl = createWorkerFetch(env)
  const dbState = await getKnowgrphStorageDb()
  const deviceId = 'dev_conflict_retained'

  await worker.fetch(
    new Request('https://example.com/api/storage/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_client_conflict_retained',
        deviceId: 'dev_remote_seed_retained',
        mutations: [
          {
            mutationId: 'mut_seed_conflict_retained',
            workspaceId: 'wk_client_conflict_retained',
            entity: 'document',
            op: 'upsert',
            recordId: 'doc_conflict_retained',
            baseRevision: null,
            record: {
              id: 'doc_conflict_retained',
              workspaceId: 'wk_client_conflict_retained',
              canonicalPath: 'docs/conflict-retained.md',
              title: 'Conflict Retained',
              docType: 'note',
              lang: 'en-US',
              graphId: null,
              sourceKind: 'markdown',
              contentMd: '# Server Retained',
              contentHash: 'sha256:server-retained',
              parserVersion: '1.0.0',
              revision: 3,
              updatedAtMs: 1_777_100_003_000,
              deleted: false,
            },
          },
        ],
      }),
    }),
    env as never,
  )

  const mutationId = await queueKnowgrphStorageMutation({
    workspaceId: 'wk_client_conflict_retained',
    deviceId,
    entity: 'document',
    op: 'upsert',
    baseRevision: 1,
    record: {
      id: 'doc_conflict_retained',
      workspaceId: 'wk_client_conflict_retained',
      canonicalPath: 'docs/conflict-retained.md',
      title: 'Conflict Retained',
      docType: 'note',
      lang: 'en-US',
      graphId: null,
      sourceKind: 'markdown',
      contentMd: '# Local Retained',
      contentHash: 'sha256:local-retained',
      parserVersion: '1.0.0',
      revision: 1,
      updatedAtMs: 1_777_100_003_100,
      deleted: false,
    },
    dbState,
  })

  await dbState.collections.documents.incrementalUpsert({
    id: 'doc_conflict_retained',
    workspaceId: 'wk_client_conflict_retained',
    canonicalPath: 'docs/conflict-retained.md',
    title: 'Conflict Retained',
    docType: 'note',
    lang: 'en-US',
    graphId: null,
    sourceKind: 'markdown',
    contentMd: '# Server Retained',
    contentHash: 'sha256:server-retained',
    parserVersion: '1.0.0',
    documentRevision: 3,
    updatedAtMs: 1_777_100_003_000,
    isDeleted: false,
  })

  const outboxRow = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (!outboxRow) throw new Error('expected retained conflict test to enqueue local mutation')
  await outboxRow.incrementalPatch({
    attemptCount: 23,
    lastAckStatus: 'conflict',
    lastAckMessage: 'retained conflict seed',
    updatedAtMs: Date.now(),
  })

  const result = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_conflict_retained',
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
  })

  if (result.unresolvedConflictCount !== 0) {
    throw new Error(`expected retained conflict auto-rebase to clear unresolved conflicts, received ${result.unresolvedConflictCount}`)
  }
  const retainedRow = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (retainedRow) {
    throw new Error('expected retained conflicted outbox row to be retried/applied and cleared from outbox')
  }

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncCanApplyPulledRemoteChangesIntoVisibleSourceFiles() {
  await __resetKnowgrphStorageDbForTests()
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setSourceFiles([])
  const env = createFakeKnowgrphStorageWorkerEnv()
  const fetchImpl = createWorkerFetch(env)
  const dbState = await getKnowgrphStorageDb()
  const deviceId = 'dev_pull_visible'

  await worker.fetch(
    new Request('https://example.com/api/storage/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_client_visible',
        deviceId: 'dev_remote_visible',
        mutations: [
          {
            mutationId: 'mut_visible_doc',
            workspaceId: 'wk_client_visible',
            entity: 'document',
            op: 'upsert',
            recordId: 'sf:visible_remote',
            baseRevision: null,
            record: {
              id: 'sf:visible_remote',
              workspaceId: 'wk_client_visible',
              canonicalPath: 'workspace:/visible-remote.md',
              title: 'visible-remote.md',
              docType: 'markdown',
              lang: null,
              graphId: 'sf-graph:visible_remote',
              sourceKind: 'markdown',
              contentMd: '# Visible Remote',
              contentHash: 'sha256:visible-remote',
              parserVersion: 'markdown-frontmatter',
              revision: 1,
              updatedAtMs: 1_777_100_002_000,
              deleted: false,
            },
          },
          {
            mutationId: 'mut_visible_graph',
            workspaceId: 'wk_client_visible',
            entity: 'graphSnapshot',
            op: 'upsert',
            recordId: 'sf-graph:visible_remote',
            baseRevision: null,
            record: {
              id: 'sf-graph:visible_remote',
              documentId: 'sf:visible_remote',
              workspaceId: 'wk_client_visible',
              graphRevision: 1,
              graphHash: 'sha256:visible-graph',
              graphJson: { type: 'Graph', nodes: [{ id: 'visible-node', label: 'Visible Node' }], edges: [], metadata: {} },
              layoutJson: null,
              derivedFromDocumentRevision: 1,
              updatedAtMs: 1_777_100_002_050,
            },
          },
        ],
      }),
    }),
    env as never,
  )

  await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_visible',
    deviceId,
    baseUrl: 'https://example.com',
    fetchImpl,
    dbState,
    onPulledChangesApplied: ({ workspaceId, changes }) => {
      applyPulledKnowgrphStorageChangesToSourceFiles({ workspaceId, changes })
    },
  })

  const file = useGraphStore.getState().sourceFiles.find(entry => entry.id === 'visible_remote') || null
  if (!file) throw new Error('expected client sync to make pulled remote document visible in sourceFiles')
  if (String(file.text || '') !== '# Visible Remote') throw new Error('expected visible source file text to match pulled remote document')
  if (!Array.isArray(useGraphStore.getState().graphData?.nodes) || useGraphStore.getState().graphData.nodes.length < 1) {
    throw new Error('expected pulled remote source file to become visible in a non-empty composed canvas graph')
  }

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncSkipsUnavailableRoutesWithoutThrowing() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  let requestCount = 0
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    requestCount += 1
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('/api/storage/pull')) {
      return new Response('<!doctype html><html><body>vite fallback</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }
    return new Response('', { status: 404 })
  }

  const first = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_unavailable',
    deviceId: 'dev_unavailable',
    baseUrl: 'http://127.0.0.1:5173',
    fetchImpl,
    dbState,
  })
  const second = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_unavailable',
    deviceId: 'dev_unavailable',
    baseUrl: 'http://127.0.0.1:5173',
    fetchImpl,
    dbState,
  })

  if (first.pushedCount !== 0 || first.pulledDocumentCount !== 0 || first.pulledChunkCount !== 0 || first.pulledGraphSnapshotCount !== 0) {
    throw new Error('expected unavailable storage routes to skip sync cleanly without reporting pushed or pulled records')
  }
  if (second.pushedCount !== 0 || second.pulledDocumentCount !== 0 || second.pulledChunkCount !== 0 || second.pulledGraphSnapshotCount !== 0) {
    throw new Error('expected repeated sync attempts against unavailable storage routes to stay in the shared skipped state')
  }
  if (requestCount !== 1) {
    throw new Error(`expected unavailable route backoff to suppress repeated fetch attempts, got ${requestCount}`)
  }

  await __resetKnowgrphStorageDbForTests()
}

export async function testKnowgrphStorageClientSyncSkipsNetworkLoadFailuresWithoutThrowing() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  let requestCount = 0
  const fetchImpl = async (): Promise<Response> => {
    requestCount += 1
    const error = new TypeError('Load failed')
    throw error
  }

  const first = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_load_failed',
    deviceId: 'dev_load_failed',
    baseUrl: 'http://127.0.0.1:5174',
    fetchImpl,
    dbState,
  })
  const second = await syncKnowgrphStorageNow({
    workspaceId: 'wk_client_load_failed',
    deviceId: 'dev_load_failed',
    baseUrl: 'http://127.0.0.1:5174',
    fetchImpl,
    dbState,
  })

  if (first.pushedCount !== 0 || first.pulledDocumentCount !== 0 || first.pulledChunkCount !== 0 || first.pulledGraphSnapshotCount !== 0) {
    throw new Error('expected network load failure to skip sync cleanly without reporting pushed or pulled records')
  }
  if (second.pushedCount !== 0 || second.pulledDocumentCount !== 0 || second.pulledChunkCount !== 0 || second.pulledGraphSnapshotCount !== 0) {
    throw new Error('expected repeated sync attempts during load failure backoff to remain skipped')
  }
  if (requestCount !== 1) {
    throw new Error(`expected network load failure backoff to suppress repeated fetch attempts, got ${requestCount}`)
  }

  await __resetKnowgrphStorageDbForTests()
}
