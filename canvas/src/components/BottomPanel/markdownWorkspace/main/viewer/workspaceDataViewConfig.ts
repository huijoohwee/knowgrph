import { hashStringToHex } from '@/lib/hash/stringHash'
import { getMarkdownDataViewConfigStorageKey } from '@/lib/config'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import type { MarkdownDataViewColumnKind } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import { coerceMarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'

export type WorkspaceDataViewLayout = 'kanban' | 'table'

export type WorkspaceDataViewFilterOp = 'contains' | 'equals' | 'includes'

export type WorkspaceDataViewFilterRule = {
  id: string
  columnId: string
  columnKind: MarkdownDataViewColumnKind
  op: WorkspaceDataViewFilterOp
  value: string
}

export type WorkspaceDataViewFilterGroup = {
  id: string
  rules: WorkspaceDataViewFilterRule[]
}

export type WorkspaceDataViewConfigV1 = {
  v: 1
  name: string
  layout: WorkspaceDataViewLayout
  groupByColumnId: string | null
  visibleColumnIds: string[] | null
  columnTypesById: Record<string, MarkdownDataViewColumnType> | null
  filterGroups: WorkspaceDataViewFilterGroup[]
}

export type WorkspaceDataViewConfig = WorkspaceDataViewConfigV1

const DEFAULT: WorkspaceDataViewConfigV1 = {
  v: 1,
  name: 'Kanban View',
  layout: 'kanban',
  groupByColumnId: null,
  visibleColumnIds: null,
  columnTypesById: null,
  filterGroups: [{ id: 'g0', rules: [] }],
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => String(x || '').trim()).filter(Boolean)
}

function coerceRule(raw: unknown): WorkspaceDataViewFilterRule | null {
  if (!isRecord(raw)) return null
  const id = String(raw.id || '').trim()
  const columnId = String(raw.columnId || '').trim()
  const columnKind = raw.columnKind === 'select' || raw.columnKind === 'multi-select' || raw.columnKind === 'text'
    ? (raw.columnKind as MarkdownDataViewColumnKind)
    : null
  const op = raw.op === 'equals' || raw.op === 'includes' || raw.op === 'contains'
    ? (raw.op as WorkspaceDataViewFilterOp)
    : null
  const value = String(raw.value ?? '')
  if (!id || !columnId || !columnKind || !op) return null
  return { id, columnId, columnKind, op, value }
}

function coerceGroup(raw: unknown): WorkspaceDataViewFilterGroup | null {
  if (!isRecord(raw)) return null
  const id = String(raw.id || '').trim()
  if (!id) return null
  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : []
  const rules = rulesRaw.map(coerceRule).filter((x): x is WorkspaceDataViewFilterRule => !!x)
  return { id, rules }
}

function coerceColumnTypesById(raw: unknown): Record<string, MarkdownDataViewColumnType> {
  if (!isRecord(raw)) return {}
  const out: Record<string, MarkdownDataViewColumnType> = {}
  for (const [k, v] of Object.entries(raw)) {
    const id = String(k || '').trim()
    if (!id) continue
    const t = coerceMarkdownDataViewColumnType(v)
    if (!t) continue
    out[id] = t
  }
  return out
}

export function coerceWorkspaceDataViewConfig(raw: unknown): WorkspaceDataViewConfig | null {
  if (!isRecord(raw)) return null
  if (raw.v !== 1) return null
  const name = String(raw.name ?? '').trim() || DEFAULT.name
  const layout = raw.layout === 'table' ? 'table' : raw.layout === 'kanban' ? 'kanban' : DEFAULT.layout
  const groupByColumnId = raw.groupByColumnId === null ? null : typeof raw.groupByColumnId === 'string' ? raw.groupByColumnId : DEFAULT.groupByColumnId
  const visibleColumnIds = raw.visibleColumnIds === null ? null : coerceStringArray(raw.visibleColumnIds)
  const columnTypesById = raw.columnTypesById === null
    ? null
    : isRecord(raw.columnTypesById)
      ? coerceColumnTypesById(raw.columnTypesById)
      : DEFAULT.columnTypesById
  const groupsRaw = Array.isArray(raw.filterGroups) ? raw.filterGroups : []
  const filterGroups = groupsRaw.map(coerceGroup).filter((x): x is WorkspaceDataViewFilterGroup => !!x)
  const normalizedGroups = filterGroups.length ? filterGroups : DEFAULT.filterGroups
  return { v: 1, name, layout, groupByColumnId, visibleColumnIds, columnTypesById, filterGroups: normalizedGroups }
}

export function buildWorkspaceDataViewScopeKey(args: {
  activeDocumentPath: string | null
  tableId: string
}): string {
  const doc = String(args.activeDocumentPath || '').trim() || 'doc:unknown'
  const tableId = String(args.tableId || '').trim() || 'table:unknown'
  return `${doc}::${tableId}`
}

export function readWorkspaceDataViewConfig(args: {
  activeDocumentPath: string | null
  tableId: string
  fallback?: WorkspaceDataViewConfig
}): WorkspaceDataViewConfig {
  const scopeKey = buildWorkspaceDataViewScopeKey({ activeDocumentPath: args.activeDocumentPath, tableId: args.tableId })
  const hashed = hashStringToHex(scopeKey)
  const storageKey = getMarkdownDataViewConfigStorageKey(hashed)
  const storage = getLocalStorage()
  return readJsonFromStorage(storage, storageKey, args.fallback ?? DEFAULT, coerceWorkspaceDataViewConfig)
}

export function writeWorkspaceDataViewConfig(args: {
  activeDocumentPath: string | null
  tableId: string
  value: WorkspaceDataViewConfig
}): void {
  const scopeKey = buildWorkspaceDataViewScopeKey({ activeDocumentPath: args.activeDocumentPath, tableId: args.tableId })
  const hashed = hashStringToHex(scopeKey)
  const storageKey = getMarkdownDataViewConfigStorageKey(hashed)
  const storage = getLocalStorage()
  writeJsonToStorage(storage, storageKey, args.value)
}

export function defaultWorkspaceDataViewConfig(args: {
  title: string
  layout: WorkspaceDataViewLayout
  groupByColumnId: string | null
}): WorkspaceDataViewConfig {
  return {
    ...DEFAULT,
    name: String(args.title || '').trim() ? String(args.title).trim() : DEFAULT.name,
    layout: args.layout,
    groupByColumnId: args.groupByColumnId,
  }
}
