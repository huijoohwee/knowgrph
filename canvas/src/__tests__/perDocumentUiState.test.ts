import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LS_KEYS } from '@/lib/config'
import { createMemoryStorage } from '@/tests/lib/memoryStorage'
import { DOCS_SSOT_VALIDATION_WORKSPACE_PATH } from '@/tests/lib/docsSsotFixture'
import {
  buildDocumentKey,
  readPerDocumentUiState,
  shouldPersistPerDocumentUiStateDocumentRef,
  writePerDocumentUiState,
} from '@/lib/persistence/perDocumentUiState'

export function testPerDocumentUiStateReadWriteAndLruTrim() {
  const storage = createMemoryStorage()

  const keyA = buildDocumentKey({ name: 'A.md', sourceUrl: null })
  const keyB = buildDocumentKey({ name: 'B.md', sourceUrl: null })

  writePerDocumentUiState({
    storage,
    documentKey: keyA,
    documentRef: 'A.md',
    state: {
      canvasRenderMode: '2d',
      canvas2dRenderer: 'design',
      documentSemanticMode: 'document',
      multiDimTableModeEnabled: true,
      selectedNodeId: 'n1',
    },
  })

  writePerDocumentUiState({
    storage,
    documentKey: keyB,
    documentRef: 'B.md',
    state: { canvasRenderMode: '3d', canvas2dRenderer: 'd3', documentSemanticMode: 'keyword', selectedNodeId: null },
  })

  const a = readPerDocumentUiState({ storage, documentKey: keyA })
  const b = readPerDocumentUiState({ storage, documentKey: keyB })
  if (!a || a.canvas2dRenderer !== 'design' || a.selectedNodeId !== 'n1' || a.multiDimTableModeEnabled !== true) {
    throw new Error('Expected doc A state to roundtrip')
  }
  if (!b || b.canvasRenderMode !== '3d' || b.documentSemanticMode !== 'keyword') {
    throw new Error('Expected doc B state to roundtrip')
  }

  for (let i = 0; i < 40; i += 1) {
    const key = buildDocumentKey({ name: `Doc-${i}.md`, sourceUrl: null })
    writePerDocumentUiState({ storage, documentKey: key, documentRef: `Doc-${i}.md`, state: { canvas2dRenderer: 'd3', canvasRenderMode: '2d' } })
  }

  const orderRaw = storage.getItem(`${LS_KEYS.perDocumentUiStateMap}:order`)
  if (!orderRaw) throw new Error('Expected persisted per-document UI order key to exist')
  const order = JSON.parse(orderRaw) as unknown[]
  if (order.length > 24) {
    throw new Error(`Expected LRU-trimmed order length <= 24, got ${order.length}`)
  }
  if (storage.getItem(LS_KEYS.perDocumentUiStateMap) != null) {
    throw new Error('Expected legacy whole-map per-document UI payload to be removed after sharded persistence writes')
  }
  const latestKey = String(order[0] || '')
  if (!latestKey) {
    throw new Error('Expected sharded per-document UI order to retain the latest document key')
  }
  const latestRaw = storage.getItem(`${LS_KEYS.perDocumentUiStateMap}:${latestKey}`)
  if (!latestRaw) {
    throw new Error('Expected latest document UI state to persist under its own shard key')
  }
}

export function testPerDocumentUiStateSkipsInitializationWorkspaceDocs() {
  const storage = createMemoryStorage()
  if (shouldPersistPerDocumentUiStateDocumentRef('/README.md') !== false) {
    throw new Error('Expected README seed doc UI state persistence to be disabled')
  }
  if (shouldPersistPerDocumentUiStateDocumentRef(DOCS_SSOT_VALIDATION_WORKSPACE_PATH) !== false) {
    throw new Error('Expected video-demo seed doc UI state persistence to be disabled')
  }
  if (shouldPersistPerDocumentUiStateDocumentRef('/notes/custom.md') !== true) {
    throw new Error('Expected custom doc UI state persistence to remain enabled')
  }

  const key = buildDocumentKey({ name: '/README.md', sourceUrl: null })
  writePerDocumentUiState({
    storage,
    documentKey: key,
    documentRef: '/README.md',
    state: { canvasRenderMode: '2d', canvas2dRenderer: 'flowEditor', selectedNodeId: 'seed-node' },
  })

  const restored = readPerDocumentUiState({ storage, documentKey: key, documentRef: '/README.md' })
  if (restored != null) {
    throw new Error('Expected initialization workspace doc UI state restore to stay disabled')
  }
  if (storage.getItem(`${LS_KEYS.perDocumentUiStateMap}:order`) != null) {
    throw new Error('Expected initialization workspace doc UI state to avoid persistence writes entirely')
  }
}

export function testPerDocumentUiStateReusesSharedPlainObjectGuard() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'persistence', 'perDocumentUiState.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected per-document UI persistence to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected per-document UI persistence to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const record = readPlainObject(raw)')) {
    throw new Error('expected per-document UI persistence coercion to reuse the shared local plain-object helper')
  }
  if (!text.includes('const byKeyRaw = readPlainObject(record.byKey)')) {
    throw new Error('expected per-document UI persistence map parsing to reuse the shared local plain-object helper')
  }
  if (text.includes('function isRecord(v: unknown): v is Record<string, unknown> {')) {
    throw new Error('expected per-document UI persistence to stop defining a local record guard')
  }
}
