import { hashStringToHex } from '@/lib/hash/stringHash'
import { getMarkdownDataViewConfigStorageKey } from '@/lib/config'
import { getLocalStorage, readJsonFromStorage, writeJsonToStorage } from '@/lib/persistence'
import type { MarkdownDataView, MarkdownDataViewColumnKind } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import { coerceMarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import { MARKDOWN_DATA_VIEW_COPY } from '@/lib/config-copy/markdownDataViewCopy'

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

export type WorkspaceDataViewSortDirection = 'asc' | 'desc'

export type WorkspaceDataViewSortRule = {
  id: string
  columnId: string
  direction: WorkspaceDataViewSortDirection
}

export type WorkspaceDataViewGraphColumnRole =
  | 'none'
  | 'node'
  | 'color'
  | 'group'
  | 'dependsOn'
  | 'predecessor'
  | 'successor'

export type WorkspaceDataViewViewV2 = {
  v: 2
  id: string
  name: string
  layout: WorkspaceDataViewLayout
  groupByColumnId: string | null
  visibleColumnIds: string[] | null
  columnTypesById: Record<string, MarkdownDataViewColumnType> | null
  filterGroups: WorkspaceDataViewFilterGroup[]
  sortRules: WorkspaceDataViewSortRule[]
  graphEnabled?: boolean
  graphRolesByColumnId?: Record<string, WorkspaceDataViewGraphColumnRole> | null
}

export type WorkspaceDataViewStateV1 = {
  sv: 1
  activeViewId: string
  views: WorkspaceDataViewViewV2[]
}

export type WorkspaceDataViewState = WorkspaceDataViewStateV1

export type WorkspaceDataViewConfig = WorkspaceDataViewViewV2

export type WorkspaceDataViewQueryState = {
  searchQuery: string
  visibleGroups: readonly string[] | null
  sortMode: 'none' | 'title_asc' | 'title_desc'
}

const normalizeSearch = (v: string): string => String(v || '').trim().toLowerCase()

const splitMultiValues = (raw: string): string[] => {
  return String(raw ?? '')
    .split(',')
    .map(x => String(x ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const matchRule = (cell: string, kind: MarkdownDataViewColumnKind, op: WorkspaceDataViewFilterOp, needle: string): boolean => {
  const n = normalizeSearch(needle)
  if (!n) return true
  const v = String(cell ?? '').trim()
  const lower = v.toLowerCase()

  if (op === 'equals') return lower === n
  if (op === 'includes') {
    if (kind !== 'multi-select') return lower.includes(n)
    return splitMultiValues(v).some(x => x.toLowerCase() === n)
  }
  return lower.includes(n)
}

export function computeWorkspaceDataViewGroupOptions(args: { view: MarkdownDataView; groupByColumnId: string | null }): string[] {
  const groupById = args.groupByColumnId ? String(args.groupByColumnId).trim() : ''
  if (!groupById) return []
  const groupIndex = args.view.columns.findIndex(c => c.id === groupById)
  if (groupIndex < 0) return []
  const col = args.view.columns[groupIndex]
  const opts = Array.isArray(col.options) ? col.options.map(x => String(x || '').trim()).filter(Boolean) : []
  if (opts.length) return opts
  const set = new Set<string>()
  for (const r of args.view.rows) {
    const g = String(r.cells[groupIndex] ?? '').trim() || MARKDOWN_DATA_VIEW_COPY.ungroupedLabel
    set.add(g)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function applyWorkspaceDataViewQuery(args: {
  view: MarkdownDataView
  viewConfig: WorkspaceDataViewConfig | null
  state: WorkspaceDataViewQueryState
}): MarkdownDataView {
  const baseView = args.view
  const q = normalizeSearch(args.state.searchQuery)
  const filterGroups = args.state.visibleGroups
  const sortMode = args.state.sortMode
  const dataFilters: WorkspaceDataViewFilterGroup[] = args.viewConfig?.filterGroups || []
  const configSortRule: WorkspaceDataViewSortRule | null = args.viewConfig?.sortRules?.[0] || null

  const needsFilter = Boolean(q || filterGroups || dataFilters.some(g => g.rules.length))
  const needsSort = !!configSortRule || sortMode !== 'none'
  if (!needsFilter && !needsSort) return baseView

  const titleIndex = baseView.columns.findIndex(c => c.id === baseView.titleColumnId)
  const groupIndex = baseView.groupByColumnId ? baseView.columns.findIndex(c => c.id === baseView.groupByColumnId) : -1
  const allowedGroups = filterGroups ? new Set(filterGroups.map(x => String(x || '').trim()).filter(Boolean)) : null

  const columnIndexById = new Map<string, number>()
  for (let i = 0; i < baseView.columns.length; i += 1) {
    columnIndexById.set(baseView.columns[i].id, i)
  }

  const rowPassesDataFilters = (row: (typeof baseView.rows)[number]): boolean => {
    if (!dataFilters.length) return true
    let hasAnyRules = false
    for (const g of dataFilters) {
      if (!g.rules.length) continue
      hasAnyRules = true
      let ok = true
      for (const r of g.rules) {
        const idx = columnIndexById.get(r.columnId) ?? -1
        if (idx < 0) continue
        if (!matchRule(String(row.cells[idx] ?? ''), r.columnKind, r.op, r.value)) {
          ok = false
          break
        }
      }
      if (ok) return true
    }
    return !hasAnyRules
  }

  let rows = baseView.rows
  if (needsFilter) {
    rows = rows.filter(r => {
      if (allowedGroups && groupIndex >= 0) {
        const g = String(r.cells[groupIndex] ?? '').trim() || MARKDOWN_DATA_VIEW_COPY.ungroupedLabel
        if (!allowedGroups.has(g)) return false
      }
      if (!rowPassesDataFilters(r)) return false
      if (!q) return true
      if (titleIndex >= 0) {
        const title = String(r.cells[titleIndex] ?? '')
        if (title.toLowerCase().includes(q)) return true
      }
      for (let i = 0; i < baseView.columns.length; i += 1) {
        if (i === titleIndex) continue
        const v = String(r.cells[i] ?? '')
        if (v && v.toLowerCase().includes(q)) return true
      }
      return false
    })
  }

  if (needsSort) {
    const sortColumnIndex = configSortRule ? (columnIndexById.get(configSortRule.columnId) ?? -1) : titleIndex
    if (sortColumnIndex < 0) {
      return rows === baseView.rows ? baseView : { ...baseView, rows }
    }
    const dir = configSortRule ? (configSortRule.direction === 'desc' ? -1 : 1) : (sortMode === 'title_desc' ? -1 : 1)
    rows = [...rows].sort((a, b) => {
      const ta = String(a.cells[sortColumnIndex] ?? '')
      const tb = String(b.cells[sortColumnIndex] ?? '')
      return dir * ta.localeCompare(tb)
    })
  }

  return rows === baseView.rows ? baseView : { ...baseView, rows }
}

export function defaultWorkspaceDataViewConfig(args: {
  title: string
  layout: WorkspaceDataViewLayout
  groupByColumnId: string | null
}): WorkspaceDataViewConfig {
  return {
    ...DEFAULT_VIEW,
    id: 'v0',
    v: 2,
    name: String(args.title || '').trim() || DEFAULT_VIEW.name,
    layout: args.layout === 'table' ? 'table' : 'kanban',
    groupByColumnId: args.groupByColumnId ? String(args.groupByColumnId).trim() || null : null,
  }
}

const DEFAULT_VIEW: WorkspaceDataViewViewV2 = {
  v: 2,
  id: 'v0',
  name: MARKDOWN_DATA_VIEW_COPY.kanbanViewLabel,
  layout: 'kanban',
  groupByColumnId: null,
  visibleColumnIds: null,
  columnTypesById: null,
  filterGroups: [{ id: 'g0', rules: [] }],
  sortRules: [],
}

const DEFAULT_STATE: WorkspaceDataViewStateV1 = {
  sv: 1,
  activeViewId: 'v0',
  views: [DEFAULT_VIEW],
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeWorkspaceDataViewLayout(v: unknown): WorkspaceDataViewLayout {
  const s = String(v || '').trim()
  return s === 'table' ? 'table' : 'kanban'
}

function normalizeFilterOp(v: unknown): WorkspaceDataViewFilterOp {
  const s = String(v || '').trim()
  if (s === 'equals') return 'equals'
  if (s === 'includes') return 'includes'
  return 'contains'
}

function normalizeSortDirection(v: unknown): WorkspaceDataViewSortDirection {
  return String(v || '').trim() === 'desc' ? 'desc' : 'asc'
}

function coerceRule(raw: unknown): WorkspaceDataViewFilterRule | null {
  if (!isRecord(raw)) return null
  const id = String(raw.id || '').trim()
  const columnId = String(raw.columnId || '').trim()
  const columnKind = String(raw.columnKind || '').trim() as MarkdownDataViewColumnKind
  const op = normalizeFilterOp(raw.op)
  const value = String(raw.value || '')
  if (!id || !columnId) return null
  if (!columnKind) return null
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

function coerceSortRule(raw: unknown): WorkspaceDataViewSortRule | null {
  if (!isRecord(raw)) return null
  const id = String(raw.id || '').trim()
  const columnId = String(raw.columnId || '').trim()
  if (!id || !columnId) return null
  const direction = normalizeSortDirection(raw.direction)
  return { id, columnId, direction }
}

function coerceGraphRolesByColumnId(raw: unknown): Record<string, WorkspaceDataViewGraphColumnRole> {
  if (!isRecord(raw)) return {}
  const out: Record<string, WorkspaceDataViewGraphColumnRole> = {}
  for (const [k, v] of Object.entries(raw)) {
    const id = String(k || '').trim()
    if (!id) continue
    const role = String(v || '').trim()
    if (
      role === 'none' ||
      role === 'node' ||
      role === 'color' ||
      role === 'group' ||
      role === 'dependsOn' ||
      role === 'predecessor' ||
      role === 'successor'
    ) {
      out[id] = role
    }
  }
  return out
}

export function coerceWorkspaceDataViewConfig(raw: unknown): WorkspaceDataViewConfig | null {
  if (!isRecord(raw)) return null

  if (raw.v === 2) {
    const id = String(raw.id || '').trim()
    const name = String(raw.name || '').trim() || DEFAULT_VIEW.name
    const layout = normalizeWorkspaceDataViewLayout(raw.layout)
    const groupByColumnId = typeof raw.groupByColumnId === 'string' ? (raw.groupByColumnId.trim() || null) : null

    const visibleColumnIds = Array.isArray(raw.visibleColumnIds)
      ? raw.visibleColumnIds.map(String).map(s => s.trim()).filter(Boolean)
      : null

    const columnTypesById = (() => {
      if (!isRecord(raw.columnTypesById)) return null
      const out: Record<string, MarkdownDataViewColumnType> = {}
      for (const [k, v] of Object.entries(raw.columnTypesById)) {
        const colId = String(k || '').trim()
        if (!colId) continue
        const t = coerceMarkdownDataViewColumnType(v)
        if (!t) continue
        out[colId] = t
      }
      return Object.keys(out).length ? out : null
    })()

    const groupsRaw = Array.isArray(raw.filterGroups) ? raw.filterGroups : []
    const filterGroups = groupsRaw.map(coerceGroup).filter((x): x is WorkspaceDataViewFilterGroup => !!x)
    const normalizedGroups = filterGroups.length ? filterGroups : DEFAULT_VIEW.filterGroups

    const sortRulesRaw = Array.isArray(raw.sortRules) ? raw.sortRules : []
    const sortRules = sortRulesRaw.map(coerceSortRule).filter((x): x is WorkspaceDataViewSortRule => !!x)

    const graphEnabled = typeof raw.graphEnabled === 'boolean' ? raw.graphEnabled : undefined
    const graphRolesByColumnId = (() => {
      if (!isRecord(raw.graphRolesByColumnId)) return null
      const m = coerceGraphRolesByColumnId(raw.graphRolesByColumnId)
      return Object.keys(m).length ? m : null
    })()

    if (!id) return null
    return {
      v: 2,
      id,
      name,
      layout,
      groupByColumnId,
      visibleColumnIds,
      columnTypesById,
      filterGroups: normalizedGroups,
      sortRules,
      graphEnabled,
      graphRolesByColumnId,
    }
  }

  if (raw.v === 1) {
    const migrated: WorkspaceDataViewViewV2 = {
      ...DEFAULT_VIEW,
      id: 'v0',
      v: 2,
      name: String(raw.name || '').trim() || DEFAULT_VIEW.name,
      layout: normalizeWorkspaceDataViewLayout(raw.layout),
      groupByColumnId: typeof raw.groupByColumnId === 'string' ? (raw.groupByColumnId.trim() || null) : null,
      visibleColumnIds: Array.isArray(raw.visibleColumnIds)
        ? raw.visibleColumnIds.map(String).map(s => s.trim()).filter(Boolean)
        : null,
      columnTypesById: isRecord(raw.columnTypesById)
        ? (() => {
            const out: Record<string, MarkdownDataViewColumnType> = {}
            for (const [k, v] of Object.entries(raw.columnTypesById)) {
              const colId = String(k || '').trim()
              if (!colId) continue
              const t = coerceMarkdownDataViewColumnType(v)
              if (!t) continue
              out[colId] = t
            }
            return Object.keys(out).length ? out : null
          })()
        : null,
      filterGroups: Array.isArray(raw.filterGroups)
        ? raw.filterGroups.map(coerceGroup).filter((x): x is WorkspaceDataViewFilterGroup => !!x)
        : DEFAULT_VIEW.filterGroups,
      sortRules: [],
      graphEnabled: typeof raw.graphEnabled === 'boolean' ? raw.graphEnabled : undefined,
      graphRolesByColumnId: isRecord(raw.graphRolesByColumnId)
        ? (() => {
            const m = coerceGraphRolesByColumnId(raw.graphRolesByColumnId)
            return Object.keys(m).length ? m : null
          })()
        : null,
    }
    return migrated
  }

  return null
}

function coerceWorkspaceDataViewState(raw: unknown, fallback: WorkspaceDataViewStateV1): WorkspaceDataViewStateV1 {
  if (isRecord(raw) && raw.sv === 1) {
    const activeViewId = String(raw.activeViewId || '').trim()
    const viewsRaw = Array.isArray(raw.views) ? raw.views : []
    const views = viewsRaw.map(coerceWorkspaceDataViewConfig).filter((x): x is WorkspaceDataViewViewV2 => !!x)
    if (views.length > 0) {
      const resolvedActive = activeViewId && views.some(v => v.id === activeViewId) ? activeViewId : views[0]!.id
      return { sv: 1, activeViewId: resolvedActive, views }
    }
  }

  const maybeView = coerceWorkspaceDataViewConfig(raw)
  if (maybeView) {
    return { sv: 1, activeViewId: maybeView.id || 'v0', views: [maybeView] }
  }
  return fallback
}

export function ensureWorkspaceDataViewState(raw: unknown, fallbackView: WorkspaceDataViewConfig): WorkspaceDataViewState {
  const fallback: WorkspaceDataViewState = {
    sv: 1,
    activeViewId: fallbackView.id || 'v0',
    views: [{ ...fallbackView, id: fallbackView.id || 'v0' }],
  }
  return coerceWorkspaceDataViewState(raw, fallback)
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

export function getWorkspaceDataViewActiveView(args: {
  state: WorkspaceDataViewState
}): { viewId: string; view: WorkspaceDataViewConfig } {
  const id = String(args.state.activeViewId || '').trim()
  const view = args.state.views.find(v => v.id === id) || args.state.views[0]
  const resolved = view?.id || id || 'v0'
  return { viewId: resolved, view: (view as WorkspaceDataViewConfig) || DEFAULT_VIEW }
}

export function duplicateWorkspaceDataViewInState(args: {
  state: WorkspaceDataViewState
  viewId: string
}): WorkspaceDataViewState {
  const sourceId = String(args.viewId || '').trim()
  const source = args.state.views.find(v => v.id === sourceId) || args.state.views[0]
  if (!source) return args.state

  const nextId = makeId()
  const nextName = `${String(source.name || 'View')} Copy`
  const copy: WorkspaceDataViewViewV2 = { ...source, id: nextId, name: nextName }
  return { sv: 1, activeViewId: nextId, views: [...args.state.views, copy] }
}

export function deleteWorkspaceDataViewFromState(args: {
  state: WorkspaceDataViewState
  viewId: string
}): WorkspaceDataViewState {
  if (args.state.views.length <= 1) return args.state
  const id = String(args.viewId || '').trim()
  const remaining = args.state.views.filter(v => v.id !== id)
  if (remaining.length === args.state.views.length) return args.state
  const nextActive = remaining[0]!.id
  return { sv: 1, activeViewId: nextActive, views: remaining }
}

export function buildWorkspaceDataViewScopeKey(args: { activeDocumentPath: string | null; tableId: string }): string {
  const doc = String(args.activeDocumentPath || '').trim() || 'unknown-doc'
  const tid = String(args.tableId || '').trim() || 'unknown-table'
  return `mdDataView:${doc}::${tid}`
}

export function readWorkspaceDataViewStateWithMeta(args: {
  activeDocumentPath: string | null
  tableId: string
  fallback?: WorkspaceDataViewStateV1
}): { state: WorkspaceDataViewStateV1; hasStoredValue: boolean } {
  const scopeKey = buildWorkspaceDataViewScopeKey({ activeDocumentPath: args.activeDocumentPath, tableId: args.tableId })
  const hashed = hashStringToHex(scopeKey)
  const storageKey = getMarkdownDataViewConfigStorageKey(hashed)
  const storage = getLocalStorage()
  const hasStoredValue = storage.getItem(storageKey) != null
  const fallback = args.fallback ?? DEFAULT_STATE
  const state = readJsonFromStorage(storage, storageKey, fallback, (raw) => coerceWorkspaceDataViewState(raw, fallback))
  return { state, hasStoredValue }
}

export function writeWorkspaceDataViewState(args: {
  activeDocumentPath: string | null
  tableId: string
  value: WorkspaceDataViewStateV1
}): void {
  const scopeKey = buildWorkspaceDataViewScopeKey({ activeDocumentPath: args.activeDocumentPath, tableId: args.tableId })
  const hashed = hashStringToHex(scopeKey)
  const storageKey = getMarkdownDataViewConfigStorageKey(hashed)
  const storage = getLocalStorage()
  writeJsonToStorage(storage, storageKey, args.value)
}

export function readWorkspaceDataViewConfig(args: {
  activeDocumentPath: string | null
  tableId: string
  fallback?: WorkspaceDataViewConfig
}): WorkspaceDataViewConfig {
  const { state } = readWorkspaceDataViewStateWithMeta({ activeDocumentPath: args.activeDocumentPath, tableId: args.tableId })
  const active = state.views.find(v => v.id === state.activeViewId) || state.views[0]
  return active || (args.fallback ?? DEFAULT_VIEW)
}

export function writeWorkspaceDataViewConfig(args: {
  activeDocumentPath: string | null
  tableId: string
  value: WorkspaceDataViewConfig
}): void {
  const { state } = readWorkspaceDataViewStateWithMeta({ activeDocumentPath: args.activeDocumentPath, tableId: args.tableId })
  const id = String(state.activeViewId || args.value.id || 'v0')
  const nextViews = state.views.map(v => (v.id === id ? { ...args.value, id } : v))
  const hasMatch = nextViews.some(v => v.id === id)
  const normalized = hasMatch ? nextViews : [{ ...args.value, id }, ...nextViews]
  writeWorkspaceDataViewState({
    activeDocumentPath: args.activeDocumentPath,
    tableId: args.tableId,
    value: { sv: 1, activeViewId: id, views: normalized },
  })
}
