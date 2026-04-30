import { LS_KEYS } from '@/lib/config'
import { createMemoryStorage } from '@/tests/lib/memoryStorage'
import { buildDocumentKey, readPerDocumentUiState, writePerDocumentUiState } from '@/lib/persistence/perDocumentUiState'

export function testPerDocumentUiStateReadWriteAndLruTrim() {
  const storage = createMemoryStorage()

  const keyA = buildDocumentKey({ name: 'A.md', sourceUrl: null })
  const keyB = buildDocumentKey({ name: 'B.md', sourceUrl: null })

  writePerDocumentUiState({
    storage,
    documentKey: keyA,
    documentRef: 'A.md',
    state: { canvasRenderMode: '2d', canvas2dRenderer: 'design', documentSemanticMode: 'document', selectedNodeId: 'n1' },
  })

  writePerDocumentUiState({
    storage,
    documentKey: keyB,
    documentRef: 'B.md',
    state: { canvasRenderMode: '3d', canvas2dRenderer: 'd3', documentSemanticMode: 'keyword', selectedNodeId: null },
  })

  const a = readPerDocumentUiState({ storage, documentKey: keyA })
  const b = readPerDocumentUiState({ storage, documentKey: keyB })
  if (!a || a.canvas2dRenderer !== 'design' || a.selectedNodeId !== 'n1') {
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
