import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import { hashStringToHex } from '@/lib/hash/stringHash'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config'
import type { DocumentSemanticMode } from '@/hooks/store/types'

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => String(x || '').trim()).filter(Boolean)
}

function coerceState(raw: unknown): PerDocumentUiState | null {
  if (!isRecord(raw)) return null
  const canvasRenderMode = raw.canvasRenderMode === '3d' ? '3d' : raw.canvasRenderMode === '2d' ? '2d' : undefined
  const canvas3dMode = raw.canvas3dMode === 'voxel' ? 'voxel' : raw.canvas3dMode === '3d' ? '3d' : undefined
  const canvas2dRenderer =
    raw.canvas2dRenderer === 'flowEditor' || raw.canvas2dRenderer === 'flow' || raw.canvas2dRenderer === 'design' || raw.canvas2dRenderer === 'd3' || raw.canvas2dRenderer === 'd3Bipartite'
      ? (raw.canvas2dRenderer as Canvas2dRendererId)
      : undefined
  const documentSemanticMode = raw.documentSemanticMode === 'keyword' || raw.documentSemanticMode === 'document'
    ? (raw.documentSemanticMode as DocumentSemanticMode)
    : undefined
  const frontmatterModeEnabled = typeof raw.frontmatterModeEnabled === 'boolean' ? raw.frontmatterModeEnabled : undefined
  const viewPinned = typeof raw.viewPinned === 'boolean' ? raw.viewPinned : undefined
  const fitToScreenMode = typeof raw.fitToScreenMode === 'boolean' ? raw.fitToScreenMode : undefined
  const zoomToSelectionMode = typeof raw.zoomToSelectionMode === 'boolean' ? raw.zoomToSelectionMode : undefined
  const selectedNodeId = typeof raw.selectedNodeId === 'string' ? raw.selectedNodeId : raw.selectedNodeId === null ? null : undefined
  const selectedEdgeId = typeof raw.selectedEdgeId === 'string' ? raw.selectedEdgeId : raw.selectedEdgeId === null ? null : undefined
  const selectedGroupId = typeof raw.selectedGroupId === 'string' ? raw.selectedGroupId : raw.selectedGroupId === null ? null : undefined
  const selectedNodeIds = raw.selectedNodeIds != null ? coerceStringArray(raw.selectedNodeIds) : undefined
  const selectedEdgeIds = raw.selectedEdgeIds != null ? coerceStringArray(raw.selectedEdgeIds) : undefined
  const selectedGroupIds = raw.selectedGroupIds != null ? coerceStringArray(raw.selectedGroupIds) : undefined
  const documentRef = typeof raw.documentRef === 'string' ? raw.documentRef : undefined
  const updatedAtMs = typeof raw.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs) ? raw.updatedAtMs : undefined
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
  if (!isRecord(raw)) return null
  const v = raw.v === 1 ? 1 : null
  if (v == null) return null
  const order = coerceStringArray(raw.order)
  const byKeyRaw = isRecord(raw.byKey) ? raw.byKey : null
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

export function readPerDocumentUiState(args: {
  storage?: Storage | null
  documentKey: string
}): PerDocumentUiState | null {
  const storage = args.storage === undefined ? getLocalStorage() : args.storage
  const map = readJsonFromStorage(storage, LS_KEYS.perDocumentUiStateMap, EMPTY, raw => coerceMap(raw))
  const key = String(args.documentKey || '').trim()
  if (!key) return null
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
  const now = Date.now()
  const map = readJsonFromStorage(storage, LS_KEYS.perDocumentUiStateMap, EMPTY, raw => coerceMap(raw))

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
  writeJsonToStorage(storage, LS_KEYS.perDocumentUiStateMap, { v: 1, order: trimmedOrder, byKey: trimmedByKey })
}
