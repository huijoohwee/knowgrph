import { LS_KEYS } from '@/lib/config.ls.keys'
import { applyGraphViewPinnedSemanticsMigration, createGraphViewSlice } from '@/hooks/store/graphViewSlice'
import type { GraphState } from '@/hooks/store/types'

const ensureLocalStorage = () => {
  const globalWindow = globalThis as any

  if (globalWindow.localStorage) return globalWindow.localStorage

  const store = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }

  globalWindow.localStorage = storage
  if (!globalWindow.window) globalWindow.window = globalWindow
  globalWindow.window.localStorage = storage
  return storage
}

const bootGraphViewSlice = () =>
  createGraphViewSlice(
    () => {},
    () => ({} as unknown as GraphState),
  )

export function testGraphViewPinnedSemanticsMigrationDefersStorageWritesUntilApply() {
  const storage = ensureLocalStorage()
  storage.clear()

  storage.setItem(LS_KEYS.flowNodeQuickEditorPinnedByNodeId, JSON.stringify({
    nodeA: true,
    nodeB: true,
    nodeC: true,
    nodeD: false,
  }))
  storage.setItem(LS_KEYS.flowNodeQuickEditorPosByNodeId, JSON.stringify({
    nodeA: { top: 10, left: 20 },
    nodeB: { top: 15, left: 25 },
    nodeC: { top: 30, left: 40 },
  }))

  const slice = bootGraphViewSlice()

  if (slice.flowNodeQuickEditorPinnedByNodeId.nodeA !== false) {
    throw new Error('expected slice init to expose migrated in-memory pinned semantics for nodeA')
  }
  if (slice.flowNodeQuickEditorPinnedByNodeId.nodeB !== false) {
    throw new Error('expected slice init to expose migrated in-memory pinned semantics for nodeB')
  }
  if (slice.flowNodeQuickEditorPinnedByNodeId.nodeC !== false) {
    throw new Error('expected slice init to expose migrated in-memory pinned semantics for nodeC')
  }
  if (slice.flowNodeQuickEditorPinnedByNodeId.nodeD !== true) {
    throw new Error('expected slice init to flip all legacy pinned semantics when inversion evidence is strong')
  }

  const rawBeforeApply = JSON.parse(storage.getItem(LS_KEYS.flowNodeQuickEditorPinnedByNodeId) || '{}') as Record<string, boolean>
  if (rawBeforeApply.nodeA !== true || rawBeforeApply.nodeD !== false) {
    throw new Error('expected import-time slice construction to avoid persisting flipped pinned semantics')
  }
  if (storage.getItem(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion) != null) {
    throw new Error('expected version marker to remain unset before explicit migration apply')
  }

  applyGraphViewPinnedSemanticsMigration()

  const rawAfterApply = JSON.parse(storage.getItem(LS_KEYS.flowNodeQuickEditorPinnedByNodeId) || '{}') as Record<string, boolean>
  if (rawAfterApply.nodeA !== false || rawAfterApply.nodeD !== true) {
    throw new Error('expected explicit migration apply to persist flipped pinned semantics')
  }
  const version = parseInt(storage.getItem(LS_KEYS.flowNodeQuickEditorPinnedSemanticsVersion) || '', 10)
  if (version !== 2) {
    throw new Error('expected explicit migration apply to stamp pinned semantics version 2')
  }
}
