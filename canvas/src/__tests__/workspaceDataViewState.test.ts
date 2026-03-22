import {
  coerceWorkspaceDataViewConfig,
  ensureWorkspaceDataViewState,
  duplicateWorkspaceDataViewInState,
  deleteWorkspaceDataViewFromState,
  getWorkspaceDataViewActiveView,
  type WorkspaceDataViewState,
} from '@/components/BottomPanel/markdownWorkspace/main/viewer/workspaceDataViewConfig'

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

