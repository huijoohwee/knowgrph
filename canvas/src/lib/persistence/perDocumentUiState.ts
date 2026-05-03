import { LS_KEYS } from '@/lib/config'
import { getLocalStorage } from '@/lib/persistence'
import { hashStringToHex } from '@/lib/hash/stringHash'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config'
import { isCanvas2dRendererId } from '@/lib/config.render'
import type { DocumentSemanticMode } from '@/hooks/store/types'
import { isInitializationWorkspacePath } from '@/features/workspace-fs/workspaceFs'
import { isPlainObject } from '@/lib/graph/value'

export type PerDocumentUiState = {
  documentRef?: string
  updatedAtMs?: number
  canvasRenderMode?: '2d' | '3d'
  canvas3dMode?: Canvas3dModeId
  canvas2dRenderer?: Canvas2dRendererId
  documentSemanticMode?: DocumentSemanticMode
  frontmatterModeEnabled?: boolean
  viewPinned?: boolean
  fitToScreenMode?: boolean
  zoomToSelectionMode?: boolean
  selectedNodeId?: string | null
  selectedEdgeId?: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
}

type PersistedMapV1 = {
  v: 1
  order: string[]
  byKey: Record<string, PerDocumentUiState>
}

const EMPTY: PersistedMapV1 = { v: 1, order: [], byKey: {} }
const MAX_DOCS = 24

type PersistedMapCache = {
  raw: string | null
  parsed: PersistedMapV1
}

type PersistedOrderCache = {
  raw: string | null
  parsed: string[]
}

type PersistedEntryCache = {
  raw: string | null
  parsed: PerDocumentUiState | null
}

// Small, single-key cache: this payload is bounded (MAX_DOCS) and read frequently
// under rapid document switching. Caching avoids repeated JSON.parse + coercion.
let perDocumentUiStateCache: PersistedMapCache = { raw: null, parsed: EMPTY }
let perDocumentUiStateOrderCache: PersistedOrderCache = { raw: null, parsed: [] }
const perDocumentUiStateEntryCache = new Map<string, PersistedEntryCache>()

const PER_DOCUMENT_UI_STATE_ENTRY_CACHE_LIMIT = 64
const getPerDocumentUiStateOrderKey = (): string => `${LS_KEYS.perDocumentUiStateMap}:order`
const getPerDocumentUiStateEntryKey = (documentKey: string): string => `${LS_KEYS.perDocumentUiStateMap}:${documentKey}`

const notePerDocumentUiStateEntryCache = (storageKey: string, next: PersistedEntryCache): void => {
  if (!storageKey) return
  if (perDocumentUiStateEntryCache.has(storageKey)) {
    perDocumentUiStateEntryCache.delete(storageKey)
  }
  perDocumentUiStateEntryCache.set(storageKey, next)
  if (perDocumentUiStateEntryCache.size <= PER_DOCUMENT_UI_STATE_ENTRY_CACHE_LIMIT) return
  const oldestKey = perDocumentUiStateEntryCache.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    perDocumentUiStateEntryCache.delete(oldestKey)
  }
}

const readPlainObject = (value: unknown): Record<string, unknown> | null => {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => String(x || '').trim()).filter(Boolean)
}

function coerceState(raw: unknown): PerDocumentUiState | null {
  const record = readPlainObject(raw)
  if (!record) return null
  const canvasRenderMode = record.canvasRenderMode === '3d' ? '3d' : record.canvasRenderMode === '2d' ? '2d' : undefined
  const canvas3dMode = record.canvas3dMode === 'voxel' ? 'voxel' : record.canvas3dMode === '3d' ? '3d' : undefined
  const canvas2dRenderer = isCanvas2dRendererId(record.canvas2dRenderer) ? (record.canvas2dRenderer as Canvas2dRendererId) : undefined
  const documentSemanticMode = record.documentSemanticMode === 'keyword' || record.documentSemanticMode === 'document'
    ? (record.documentSemanticMode as DocumentSemanticMode)
    : undefined
  const frontmatterModeEnabled = typeof record.frontmatterModeEnabled === 'boolean' ? record.frontmatterModeEnabled : undefined
  const viewPinned = typeof record.viewPinned === 'boolean' ? record.viewPinned : undefined
  const fitToScreenMode = typeof record.fitToScreenMode === 'boolean' ? record.fitToScreenMode : undefined
  const zoomToSelectionMode = typeof record.zoomToSelectionMode === 'boolean' ? record.zoomToSelectionMode : undefined
  const selectedNodeId = typeof record.selectedNodeId === 'string' ? record.selectedNodeId : record.selectedNodeId === null ? null : undefined
  const selectedEdgeId = typeof record.selectedEdgeId === 'string' ? record.selectedEdgeId : record.selectedEdgeId === null ? null : undefined
  const selectedGroupId = typeof record.selectedGroupId === 'string' ? record.selectedGroupId : record.selectedGroupId === null ? null : undefined
  const selectedNodeIds = record.selectedNodeIds != null ? coerceStringArray(record.selectedNodeIds) : undefined
  const selectedEdgeIds = record.selectedEdgeIds != null ? coerceStringArray(record.selectedEdgeIds) : undefined
  const selectedGroupIds = record.selectedGroupIds != null ? coerceStringArray(record.selectedGroupIds) : undefined
  const documentRef = typeof record.documentRef === 'string' ? record.documentRef : undefined
  const updatedAtMs = typeof record.updatedAtMs === 'number' && Number.isFinite(record.updatedAtMs) ? record.updatedAtMs : undefined
  return {
    documentRef,
    updatedAtMs,
    canvasRenderMode,
    canvas3dMode,
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    viewPinned,
    fitToScreenMode,
    zoomToSelectionMode,
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
  }
}

function coerceMap(raw: unknown): PersistedMapV1 | null {
  const record = readPlainObject(raw)
  if (!record) return null
  const v = record.v === 1 ? 1 : null
  if (v == null) return null
  const order = coerceStringArray(record.order)
  const byKeyRaw = readPlainObject(record.byKey)
  const byKey: Record<string, PerDocumentUiState> = {}
  if (byKeyRaw) {
    for (const [k, entry] of Object.entries(byKeyRaw)) {
      const coerced = coerceState(entry)
      if (!coerced) continue
      byKey[k] = coerced
    }
  }
  const normalizedOrder = order.filter(k => !!byKey[k])
  return { v: 1, order: normalizedOrder, byKey }
}

function readPerDocumentUiStateMapCached(storage: Storage | null): PersistedMapV1 {
  if (!storage) return EMPTY
  let raw: string | null = null
  try {
    raw = storage.getItem(LS_KEYS.perDocumentUiStateMap)
  } catch {
    return EMPTY
  }

  if (!raw) {
    // Keep cache in sync with reality (key cleared).
    perDocumentUiStateCache = { raw: null, parsed: EMPTY }
    return EMPTY
  }

  if (raw === perDocumentUiStateCache.raw) return perDocumentUiStateCache.parsed

  try {
    const coerced = coerceMap(JSON.parse(raw) as unknown) ?? EMPTY
    perDocumentUiStateCache = { raw, parsed: coerced }
    return coerced
  } catch {
    // Cache the raw string so we don't repeatedly re-parse the same bad value.
    perDocumentUiStateCache = { raw, parsed: EMPTY }
    return EMPTY
  }
}

function readPerDocumentUiStateOrderCached(storage: Storage | null): string[] {
  if (!storage) return []
  const orderKey = getPerDocumentUiStateOrderKey()
  let raw: string | null = null
  try {
    raw = storage.getItem(orderKey)
  } catch {
    return []
  }
  if (!raw) {
    perDocumentUiStateOrderCache = { raw: null, parsed: [] }
    return []
  }
  if (raw === perDocumentUiStateOrderCache.raw) return perDocumentUiStateOrderCache.parsed
  try {
    const parsed = JSON.parse(raw) as unknown
    const order = coerceStringArray(parsed).slice(0, MAX_DOCS)
    perDocumentUiStateOrderCache = { raw, parsed: order }
    return order
  } catch {
    perDocumentUiStateOrderCache = { raw, parsed: [] }
    return []
  }
}

function readPerDocumentUiStateEntryCached(storage: Storage | null, documentKey: string): PerDocumentUiState | null {
  if (!storage) return null
  const storageKey = getPerDocumentUiStateEntryKey(documentKey)
  let raw: string | null = null
  try {
    raw = storage.getItem(storageKey)
  } catch {
    return null
  }
  const cached = perDocumentUiStateEntryCache.get(storageKey)
  if (cached && cached.raw === raw) return cached.parsed
  if (!raw) {
    notePerDocumentUiStateEntryCache(storageKey, { raw: null, parsed: null })
    return null
  }
  try {
    const parsed = coerceState(JSON.parse(raw) as unknown)
    const next = { raw, parsed }
    notePerDocumentUiStateEntryCache(storageKey, next)
    return parsed
  } catch {
    notePerDocumentUiStateEntryCache(storageKey, { raw, parsed: null })
    return null
  }
}

function readPersistedPerDocumentUiState(storage: Storage | null): PersistedMapV1 {
  const order = readPerDocumentUiStateOrderCached(storage)
  if (order.length > 0) {
    const byKey: Record<string, PerDocumentUiState> = {}
    const normalizedOrder: string[] = []
    for (let i = 0; i < order.length; i += 1) {
      const documentKey = String(order[i] || '').trim()
      if (!documentKey) continue
      const entry = readPerDocumentUiStateEntryCached(storage, documentKey)
      if (!entry) continue
      normalizedOrder.push(documentKey)
      byKey[documentKey] = entry
    }
    return { v: 1, order: normalizedOrder, byKey }
  }
  return readPerDocumentUiStateMapCached(storage)
}

function writePerDocumentUiStateMapCached(storage: Storage | null, map: PersistedMapV1): void {
  if (!storage) return
  try {
    const raw = JSON.stringify(map)
    if (raw === perDocumentUiStateCache.raw) return
    storage.setItem(LS_KEYS.perDocumentUiStateMap, raw)
    perDocumentUiStateCache = { raw, parsed: map }
  } catch {
    void 0
  }
}

export function buildDocumentRef(args: { name: string | null; sourceUrl: string | null }): string {
  const url = typeof args.sourceUrl === 'string' ? args.sourceUrl.trim() : ''
  if (url) return url
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  return name
}

export function buildDocumentKey(args: { name: string | null; sourceUrl: string | null }): string {
  const ref = buildDocumentRef(args)
  const normalized = ref.trim().toLowerCase()
  if (!normalized) return 'doc:default'
  return `doc:${hashStringToHex(normalized)}`
}

export function shouldPersistPerDocumentUiStateDocumentRef(documentRef: string | null | undefined): boolean {
  const ref = typeof documentRef === 'string' ? documentRef.trim() : ''
  if (!ref) return true
  return !isInitializationWorkspacePath(ref)
}

export function readPerDocumentUiState(args: {
  storage?: Storage | null
  documentKey: string
  documentRef?: string | null
}): PerDocumentUiState | null {
  const storage = args.storage === undefined ? getLocalStorage() : args.storage
  const key = String(args.documentKey || '').trim()
  if (!key) return null
  if (!shouldPersistPerDocumentUiStateDocumentRef(args.documentRef)) return null
  const order = readPerDocumentUiStateOrderCached(storage)
  if (order.length > 0) return readPerDocumentUiStateEntryCached(storage, key)
  const map = readPerDocumentUiStateMapCached(storage)
  return map.byKey[key] ?? null
}

export function writePerDocumentUiState(args: {
  storage?: Storage | null
  documentKey: string
  documentRef?: string
  state: PerDocumentUiState
}): void {
  const storage = args.storage === undefined ? getLocalStorage() : args.storage
  const documentKey = String(args.documentKey || '').trim()
  if (!documentKey) return
  if (!shouldPersistPerDocumentUiStateDocumentRef(args.documentRef)) return
  const now = Date.now()
  const map = readPersistedPerDocumentUiState(storage)

  const nextEntry: PerDocumentUiState = {
    ...args.state,
    documentRef: typeof args.documentRef === 'string' && args.documentRef.trim() ? args.documentRef.trim().slice(0, 400) : args.state.documentRef,
    updatedAtMs: now,
  }

  const nextByKey = { ...map.byKey, [documentKey]: nextEntry }
  const nextOrder = [documentKey, ...map.order.filter(k => k !== documentKey)]
  const trimmedOrder = nextOrder.slice(0, MAX_DOCS)
  const trimmedByKey: Record<string, PerDocumentUiState> = {}
  for (let i = 0; i < trimmedOrder.length; i += 1) {
    const k = trimmedOrder[i]
    const v = nextByKey[k]
    if (v) trimmedByKey[k] = v
  }
  if (!storage) return
  try {
    const orderRaw = JSON.stringify(trimmedOrder)
    if (orderRaw !== perDocumentUiStateOrderCache.raw) {
      storage.setItem(getPerDocumentUiStateOrderKey(), orderRaw)
      perDocumentUiStateOrderCache = { raw: orderRaw, parsed: trimmedOrder }
    }
    for (let i = 0; i < trimmedOrder.length; i += 1) {
      const key = trimmedOrder[i]
      const entry = trimmedByKey[key]
      if (!entry) continue
      const storageKey = getPerDocumentUiStateEntryKey(key)
      const raw = JSON.stringify(entry)
      const cached = perDocumentUiStateEntryCache.get(storageKey)
      if (!cached || cached.raw !== raw) {
        storage.setItem(storageKey, raw)
        notePerDocumentUiStateEntryCache(storageKey, { raw, parsed: entry })
      }
    }
    for (const staleKey of Object.keys(map.byKey)) {
      if (trimmedByKey[staleKey]) continue
      const storageKey = getPerDocumentUiStateEntryKey(staleKey)
      storage.removeItem(storageKey)
      notePerDocumentUiStateEntryCache(storageKey, { raw: null, parsed: null })
    }
    storage.removeItem(LS_KEYS.perDocumentUiStateMap)
    perDocumentUiStateCache = { raw: null, parsed: EMPTY }
  } catch {
    void 0
  }
}
