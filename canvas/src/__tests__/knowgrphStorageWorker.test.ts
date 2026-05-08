import worker from '../../../cloudflare/workers/knowgrph-storage/index.ts'
import { KNOWGRPH_STORAGE_API_VERSION } from '@/lib/storage/knowgrphStorageSyncContract'
import { createFakeKnowgrphStorageWorkerEnv } from '@/__tests__/helpers/fakeKnowgrphStorageD1'

export async function testKnowgrphStorageWorkerPushPullAndExportFlow() {
  const env = createFakeKnowgrphStorageWorkerEnv()
  const pushResponse = await worker.fetch(
    new Request('https://example.com/api/storage/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_1',
        deviceId: 'dev_1',
        mutations: [
          {
            mutationId: 'mut_doc_1',
            workspaceId: 'wk_1',
            entity: 'document',
            op: 'upsert',
            recordId: 'doc_1',
            baseRevision: null,
            record: {
              id: 'doc_1',
              workspaceId: 'wk_1',
              canonicalPath: 'docs/example.md',
              title: 'Example',
              docType: 'note',
              lang: 'en-US',
              graphId: 'graph_1',
              sourceKind: 'markdown',
              contentMd: '# Example',
              contentHash: 'sha256:doc1',
              parserVersion: '1.0.0',
              revision: 1,
              updatedAtMs: 1_777_000_000_000,
              deleted: false,
            },
          },
          {
            mutationId: 'mut_chunk_1',
            workspaceId: 'wk_1',
            entity: 'documentChunk',
            op: 'upsert',
            recordId: 'chunk_1',
            baseRevision: null,
            record: {
              id: 'chunk_1',
              documentId: 'doc_1',
              workspaceId: 'wk_1',
              chunkKey: 'frontmatter',
              chunkOrder: 0,
              heading: null,
              markdown: 'title: Example',
              tokenEstimate: 12,
              contentHash: 'sha256:chunk1',
              updatedAtMs: 1_777_000_000_100,
            },
          },
          {
            mutationId: 'mut_graph_1',
            workspaceId: 'wk_1',
            entity: 'graphSnapshot',
            op: 'upsert',
            recordId: 'graphsnap_1',
            baseRevision: null,
            record: {
              id: 'graphsnap_1',
              documentId: 'doc_1',
              workspaceId: 'wk_1',
              graphRevision: 1,
              graphHash: 'sha256:graph1',
              graphJson: { type: 'Graph', nodes: [], edges: [] },
              layoutJson: { mode: '2d' },
              derivedFromDocumentRevision: 1,
              updatedAtMs: 1_777_000_000_200,
            },
          },
        ],
      }),
    }),
    env as never,
  )
  if (!pushResponse.ok) throw new Error(`expected push response ok, received ${pushResponse.status}`)
  const pushJson = await pushResponse.json() as { acknowledgements?: Array<{ status?: string }> }
  if (!Array.isArray(pushJson.acknowledgements) || pushJson.acknowledgements.length !== 3) {
    throw new Error('expected push response to acknowledge all submitted mutations')
  }
  if (pushJson.acknowledgements.some(ack => ack.status !== 'applied')) {
    throw new Error('expected all initial storage mutations to apply cleanly')
  }

  const pullResponse = await worker.fetch(
    new Request('https://example.com/api/storage/pull', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_1',
        deviceId: 'dev_1',
        since: null,
      }),
    }),
    env as never,
  )
  if (!pullResponse.ok) throw new Error(`expected pull response ok, received ${pullResponse.status}`)
  const pullJson = await pullResponse.json() as {
    changes?: { documents?: unknown[]; documentChunks?: unknown[]; graphSnapshots?: unknown[] }
  }
  if (pullJson.changes?.documents?.length !== 1) throw new Error('expected pull to return one document')
  if (pullJson.changes?.documentChunks?.length !== 1) throw new Error('expected pull to return one chunk')
  if (pullJson.changes?.graphSnapshots?.length !== 1) throw new Error('expected pull to return one graph snapshot')

  const exportResponse = await worker.fetch(
    new Request('https://example.com/api/storage/export/wk_1'),
    env as never,
  )
  if (!exportResponse.ok) throw new Error(`expected export response ok, received ${exportResponse.status}`)
  const exportJson = await exportResponse.json() as { documents?: unknown[]; documentChunks?: unknown[]; graphSnapshots?: unknown[] }
  if (exportJson.documents?.length !== 1 || exportJson.documentChunks?.length !== 1 || exportJson.graphSnapshots?.length !== 1) {
    throw new Error('expected export to return the full workspace storage bundle')
  }
}

export async function testKnowgrphStorageWorkerReturnsConflictForStaleDocumentRevision() {
  const env = createFakeKnowgrphStorageWorkerEnv()
  const initialRequest = new Request('https://example.com/api/storage/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiVersion: KNOWGRPH_STORAGE_API_VERSION,
      workspaceId: 'wk_conflict',
      deviceId: 'dev_a',
      mutations: [
        {
          mutationId: 'mut_initial',
          workspaceId: 'wk_conflict',
          entity: 'document',
          op: 'upsert',
          recordId: 'doc_conflict',
          baseRevision: null,
          record: {
            id: 'doc_conflict',
            workspaceId: 'wk_conflict',
            canonicalPath: 'docs/conflict.md',
            title: 'Conflict',
            docType: 'note',
            lang: 'en-US',
            graphId: null,
            sourceKind: 'markdown',
            contentMd: '# Conflict',
            contentHash: 'sha256:v1',
            parserVersion: '1.0.0',
            revision: 2,
            updatedAtMs: 1_777_000_001_000,
            deleted: false,
          },
        },
      ],
    }),
  })
  await worker.fetch(initialRequest, env as never)

  const staleResponse = await worker.fetch(
    new Request('https://example.com/api/storage/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiVersion: KNOWGRPH_STORAGE_API_VERSION,
        workspaceId: 'wk_conflict',
        deviceId: 'dev_b',
        mutations: [
          {
            mutationId: 'mut_stale',
            workspaceId: 'wk_conflict',
            entity: 'document',
            op: 'upsert',
            recordId: 'doc_conflict',
            baseRevision: 1,
            record: {
              id: 'doc_conflict',
              workspaceId: 'wk_conflict',
              canonicalPath: 'docs/conflict.md',
              title: 'Conflict',
              docType: 'note',
              lang: 'en-US',
              graphId: null,
              sourceKind: 'markdown',
              contentMd: '# Conflict stale',
              contentHash: 'sha256:v_stale',
              parserVersion: '1.0.0',
              revision: 1,
              updatedAtMs: 1_777_000_001_100,
              deleted: false,
            },
          },
        ],
      }),
    }),
    env as never,
  )
  const staleJson = await staleResponse.json() as { acknowledgements?: Array<{ status?: string }> }
  if (staleJson.acknowledgements?.[0]?.status !== 'conflict') {
    throw new Error('expected stale document push to return a conflict acknowledgement')
  }
}
