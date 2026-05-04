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
  if (result.unresolvedConflictCount !== 1) throw new Error('expected one unresolved conflict to remain tracked in the local outbox state')
  if (result.conflictEntries.length !== 1 || result.conflictEntries[0]?.mutationId !== mutationId) {
    throw new Error('expected sync result to expose the retained conflicting mutation for shared UX reuse')
  }

  const conflictRow = await dbState.collections.syncOutbox.findOne(mutationId).exec()
  if (!conflictRow) throw new Error('expected conflicting outbox row to be retained for later resolution')
  if (Number(conflictRow.get('attemptCount') || 0) !== 1) {
    throw new Error('expected conflicting outbox row attemptCount to increment after failed push')
  }
  if (conflictRow.get('lastAckStatus') !== 'conflict') {
    throw new Error('expected conflicting outbox row to retain local conflict state for shared UX reuse')
  }
  if (!String(conflictRow.get('lastAckMessage') || '')) {
    throw new Error('expected conflicting outbox row to retain the latest conflict message')
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
