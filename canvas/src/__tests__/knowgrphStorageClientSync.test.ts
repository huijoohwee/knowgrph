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
  if (result.conflictCount !== 1) throw new Error('expected one conflict acknowledgement for the stale outbox mutation')

  const conflictRow = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (!conflictRow) throw new Error('expected conflicting outbox row to be retained for later resolution')
  if (Number(conflictRow.get('attemptCount') || 0) !== 1) {
    throw new Error('expected conflicting outbox row attemptCount to increment after failed push')
  }

  await __resetKnowgrphStorageDbForTests()
}
