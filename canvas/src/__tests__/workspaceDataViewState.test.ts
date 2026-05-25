import {
  coerceWorkspaceDataViewConfig,
  duplicateWorkspaceDataViewConfigColumn,
  ensureWorkspaceDataViewState,
  duplicateWorkspaceDataViewInState,
  deleteWorkspaceDataViewFromState,
  getWorkspaceDataViewActiveView,
  removeWorkspaceDataViewConfigColumn,
  type WorkspaceDataViewState,
} from '@/features/markdown-workspace/main/viewer/workspaceDataViewConfig'

export function testWorkspaceDataViewStateDuplicateDelete() {
  const rawV1 = {
    v: 1,
    name: 'My View',
    layout: 'table',
    groupByColumnId: null,
    visibleColumnIds: null,
    columnTypesById: null,
    filterGroups: [{ id: 'g0', rules: [] }],
  }

  const cfg = coerceWorkspaceDataViewConfig(rawV1)
  if (!cfg) {
    throw new Error('expected v1 config coercion to succeed')
  }
  if (cfg.v !== 2) {
    throw new Error('expected v2 config after coercion')
  }
  if (!cfg.id) {
    throw new Error('expected view config to have stable id')
  }

  const state0 = ensureWorkspaceDataViewState(rawV1, cfg)
  if (state0.sv !== 1) {
    throw new Error('expected state version 1')
  }
  if (state0.views.length !== 1) {
    throw new Error('expected single view state')
  }
  if (state0.activeViewId !== state0.views[0]!.id) {
    throw new Error('expected activeViewId to point at the only view')
  }

  const dup = duplicateWorkspaceDataViewInState({ state: state0, viewId: state0.activeViewId })
  if (dup.views.length !== 2) {
    throw new Error('expected duplicate to create second view')
  }
  const activeDup = getWorkspaceDataViewActiveView({ state: dup })
  if (activeDup.viewId !== dup.activeViewId) {
    throw new Error('expected duplicate to activate new view')
  }
  if (activeDup.view.id === state0.views[0]!.id) {
    throw new Error('expected duplicated view to have a new id')
  }
  if (!String(activeDup.view.name).includes('Copy')) {
    throw new Error('expected duplicated view name to include Copy')
  }

  const deleted: WorkspaceDataViewState = deleteWorkspaceDataViewFromState({ state: dup, viewId: dup.activeViewId })
  if (deleted.views.length !== 1) {
    throw new Error('expected delete to remove active view')
  }
  if (deleted.activeViewId !== deleted.views[0]!.id) {
    throw new Error('expected activeViewId to be reassigned to remaining view')
  }

  const cannotDeleteLast = deleteWorkspaceDataViewFromState({ state: deleted, viewId: deleted.activeViewId })
  if (cannotDeleteLast.views.length !== 1) {
    throw new Error('expected delete to be a noop when only one view remains')
  }
}

export function testWorkspaceDataViewConfigColumnCrudCleanup() {
  const base = coerceWorkspaceDataViewConfig({
    v: 2,
    id: 'v0',
    name: 'Kanban',
    layout: 'kanban',
    groupByColumnId: 'status',
    visibleColumnIds: ['title', 'status', 'summary'],
    columnTypesById: { summary: 'text' },
    filterGroups: [{ id: 'g0', rules: [{ id: 'r0', columnId: 'summary', columnKind: 'text', op: 'contains', value: 'sync' }] }],
    sortRules: [{ id: 's0', columnId: 'summary', direction: 'asc' }],
    graphRolesByColumnId: { summary: 'node' },
  })
  if (!base) {
    throw new Error('expected config to coerce')
  }

  const duplicated = duplicateWorkspaceDataViewConfigColumn({
    viewConfig: base,
    sourceColumnId: 'summary',
    nextColumnId: 'summary_copy',
  })
  if (!duplicated.visibleColumnIds || duplicated.visibleColumnIds.join(',') !== 'title,status,summary,summary_copy') {
    throw new Error('expected duplicated column to inherit visible ordering next to source column')
  }
  if (duplicated.columnTypesById?.summary_copy !== 'text') {
    throw new Error('expected duplicated column to inherit configured type override')
  }
  if (duplicated.graphRolesByColumnId?.summary_copy !== 'node') {
    throw new Error('expected duplicated column to inherit graph role')
  }

  const removed = removeWorkspaceDataViewConfigColumn({
    viewConfig: duplicated,
    columnId: 'summary',
    nextGroupByColumnId: null,
  })
  if (removed.columnTypesById && 'summary' in removed.columnTypesById) {
    throw new Error('expected removed column to be dropped from type overrides')
  }
  if (removed.graphRolesByColumnId && 'summary' in removed.graphRolesByColumnId) {
    throw new Error('expected removed column to be dropped from graph roles')
  }
  if (removed.filterGroups.some(group => group.rules.some(rule => rule.columnId === 'summary'))) {
    throw new Error('expected removed column to be dropped from filters')
  }
  if (removed.sortRules.some(rule => rule.columnId === 'summary')) {
    throw new Error('expected removed column to be dropped from sort rules')
  }
}
