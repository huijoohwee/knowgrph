import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SourceFile } from '@/hooks/store/types'
import {
  __resetKnowgrphStorageDbForTests,
  getKnowgrphStorageDb,
} from '@/lib/storage/knowgrphStorageRxdb'
import {
  buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState,
  buildSourceFilesStorageSyncSignature,
  syncSourceFilesToKnowgrphStorage,
} from '@/features/source-files/sourceFilesStorageSync'
import { getSourceFileTextHash } from '@/features/source-files/sourceFilesSignatures'

const sourceFileFixture: SourceFile = {
  id: 'file_a',
  name: 'demo.md',
  text: '# Demo',
  enabled: true,
  status: 'parsed',
  parsedParserId: 'markdown',
  parsedTextHash: 'sha256:text',
  parsedGraphRevision: 3,
  parsedGraphData: {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'Demo', type: 'Thing', properties: {} }],
    edges: [],
    metadata: {},
  },
  source: {
    kind: 'local',
    path: '/imports/demo.md',
  },
}

export function testKnowgrphWorkspaceIdBuildsStableScopedIdentity() {
  const previousWorkspaceId = process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID
  delete process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID
  const a = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
    folderName: 'notes',
    accessMode: 'opfs',
    folderCacheId: 'cache_a',
    selectedFolderPath: 'notes/demo',
  })
  const b = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
    folderName: 'notes',
    accessMode: 'opfs',
    folderCacheId: 'cache_a',
    selectedFolderPath: 'notes/demo',
  })
  const c = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
    folderName: 'notes',
    accessMode: 'opfs',
    folderCacheId: 'cache_b',
    selectedFolderPath: 'notes/demo',
  })
  if (a !== b) throw new Error('expected workspace identity builder to be deterministic for the same workspace state')
  if (a === c) throw new Error('expected workspace identity builder to change when the workspace cache id changes')
  if (typeof previousWorkspaceId === 'string') process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID = previousWorkspaceId
}

export function testKnowgrphWorkspaceIdUsesStorageWorkspaceIdOverrideWhenConfigured() {
  const previousWorkspaceId = process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID
  process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID = 'kgws:canonical-docs'
  try {
    const workspaceId = buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
      folderName: 'notes',
      accessMode: 'opfs',
      folderCacheId: 'cache_a',
      selectedFolderPath: 'notes/demo',
    })
    if (workspaceId !== 'kgws:canonical-docs') {
      throw new Error(`expected storage workspace id override to win, got ${workspaceId}`)
    }
  } finally {
    if (typeof previousWorkspaceId === 'string') process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID = previousWorkspaceId
    else delete process.env.VITE_KNOWGRPH_STORAGE_WORKSPACE_ID
  }
}

export async function testSourceFilesStorageSyncQueuesDocumentAndGraphMutationsFromRealSourceFiles() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  const result = await syncSourceFilesToKnowgrphStorage({
    workspaceId: 'kgws:test-source-files',
    sourceFiles: [sourceFileFixture],
    previousSourceFiles: [],
    dbState,
  })
  if (result.queuedMutationCount !== 2) {
    throw new Error(`expected document and graph snapshot mutations to be queued, received ${result.queuedMutationCount}`)
  }
  const documentRow = await dbState.collections.documents.findOne('sf:file_a').exec()
  if (!documentRow) throw new Error('expected source-file sync to create a local document mirror row')
  if (Number(documentRow.get('documentRevision') || 0) !== 1) {
    throw new Error('expected first mirrored document revision to start at 1')
  }
  const graphRow = await dbState.collections.graphSnapshots.findOne('sf-graph:file_a').exec()
  if (!graphRow) throw new Error('expected source-file sync to create a graph snapshot mirror row')
  const outboxRows = await dbState.collections.syncOutbox.find().exec()
  if (outboxRows.length !== 2) throw new Error('expected queued storage mutations to be written into the outbox')

  const repeat = await syncSourceFilesToKnowgrphStorage({
    workspaceId: 'kgws:test-source-files',
    sourceFiles: [sourceFileFixture],
    previousSourceFiles: [sourceFileFixture],
    dbState,
  })
  if (repeat.queuedMutationCount !== 0) {
    throw new Error('expected unchanged source files to avoid queuing duplicate storage mutations')
  }
  await __resetKnowgrphStorageDbForTests()
}

export async function testSourceFilesStorageSyncQueuesDeletesFromPreviousLocalSnapshotOnly() {
  await __resetKnowgrphStorageDbForTests()
  const dbState = await getKnowgrphStorageDb()
  await syncSourceFilesToKnowgrphStorage({
    workspaceId: 'kgws:test-source-files-delete',
    sourceFiles: [sourceFileFixture],
    previousSourceFiles: [],
    dbState,
  })
  const result = await syncSourceFilesToKnowgrphStorage({
    workspaceId: 'kgws:test-source-files-delete',
    sourceFiles: [],
    previousSourceFiles: [sourceFileFixture],
    dbState,
  })
  if (result.queuedMutationCount !== 2) {
    throw new Error(`expected delete document and graph snapshot mutations, received ${result.queuedMutationCount}`)
  }
  const documentRow = await dbState.collections.documents.findOne('sf:file_a').exec()
  if (!documentRow || documentRow.get('isDeleted') !== true) {
    throw new Error('expected deleted source-file document mirror row to remain as a tombstone')
  }
  await __resetKnowgrphStorageDbForTests()
}

export function testSourceFilesStorageSyncSignatureIgnoresUiOnlySelectionState() {
  const base: SourceFile = {
    ...sourceFileFixture,
    parsedGraphData: {
      type: 'Graph',
      nodes: [{ id: 'n1', label: 'Demo', type: 'Thing', properties: {} }],
      edges: [],
      metadata: {},
    },
  }
  const signatureA = buildSourceFilesStorageSyncSignature([base])
  const signatureB = buildSourceFilesStorageSyncSignature([{
    ...base,
    enabled: !base.enabled,
    status: 'loading',
    parsedTextHash: 'different-ui-owned-hash',
  }])
  if (signatureA !== signatureB) {
    throw new Error('expected storage sync signature to ignore UI-only source-file selection/churn fields')
  }
}

export function testSourceFilesStorageSyncTextHashCacheTracksMutableText() {
  const mutable: SourceFile = {
    ...sourceFileFixture,
    id: 'mutable-text',
    text: '# Mutable A',
  }
  const firstTextHash = getSourceFileTextHash(mutable)
  const firstSignature = buildSourceFilesStorageSyncSignature([mutable])
  mutable.text = '# Mutable B'
  const secondTextHash = getSourceFileTextHash(mutable)
  const secondSignature = buildSourceFilesStorageSyncSignature([mutable])
  if (secondTextHash === firstTextHash) {
    throw new Error('expected shared source-file text hash cache to invalidate when text changes in place')
  }
  if (secondSignature === firstSignature) {
    throw new Error('expected storage sync signature to track changed markdown text through the shared text hash helper')
  }
}

export function testSourceFilesStorageSyncSkipsWorkspaceBackedSourceFiles() {
  const workspaceOnly: SourceFile = {
    ...sourceFileFixture,
    id: 'workspace-only',
    source: {
      kind: 'local',
      path: 'workspace:/docs/knowgrph-video-demo.md',
    },
  }
  const signature = buildSourceFilesStorageSyncSignature([workspaceOnly])
  if (signature !== '[]') {
    throw new Error('expected storage sync signature to skip workspace-backed source files and avoid switch-time churn')
  }
}

export function testSourceFilesPersistenceBootstrapOwnsKnowgrphStorageLoopAndQueueIntegration() {
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const text = readFileSync(bootstrapPath, 'utf8')
  if (!text.includes("startKnowgrphStorageSyncLoop")) {
    throw new Error('expected source-files bootstrap to start the knowgrph storage sync loop for the active workspace')
  }
  if (!text.includes("syncSourceFilesToKnowgrphStorage")) {
    throw new Error('expected source-files bootstrap to integrate source-file edits with storage outbox enqueueing')
  }
  if (!text.includes("scheduleKnowgrphStorageQueueSync(next as never)")) {
    throw new Error('expected source-files persistence subscription to enqueue storage sync from live source-file edits')
  }
  if (!text.includes("onPulledChangesApplied")) {
    throw new Error('expected source-files bootstrap to register an inbound pulled-changes apply hook for visible sourceFiles updates')
  }
  if (!text.includes("applyPulledKnowgrphStorageChangesToSourceFiles")) {
    throw new Error('expected source-files bootstrap to materialize pulled remote storage records into the visible sourceFiles workspace')
  }
  if (!text.includes("notifyKnowgrphStorageConflictUx")) {
    throw new Error('expected source-files bootstrap to route storage conflicts through the shared conflict UX notifier')
  }
}
