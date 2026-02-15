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

  const raw = storage.getItem(LS_KEYS.perDocumentUiStateMap)
  if (!raw) throw new Error('Expected persisted map to exist')
  const parsed = JSON.parse(raw) as { order?: unknown; byKey?: unknown }
  const order = Array.isArray(parsed.order) ? parsed.order : []
  if (order.length > 24) {
    throw new Error(`Expected LRU-trimmed order length <= 24, got ${order.length}`)
  }
}

