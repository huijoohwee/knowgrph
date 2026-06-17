import React from 'react'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import type { WorkspaceDataViewConfig, WorkspaceDataViewLayout } from './workspaceDataViewConfig'
import type { WorkspaceEditorMode } from '@/features/workspace-table/workspaceEditorMode'
import type { DataViewFieldLineMode, DataViewRowHeightPreset } from '@/lib/ui/dataViewDensity'

export const WORKSPACE_DATA_VIEW_SETTINGS_PANEL_KEYS = [
  'layout',
  'properties',
  'filter',
  'sort',
  'group',
  'reset',
] as const

export type WorkspaceDataViewSettingsPanelKey =
  (typeof WORKSPACE_DATA_VIEW_SETTINGS_PANEL_KEYS)[number]

export type WorkspaceDataViewFloatingBinding = {
  registrationId: string
  contextLabel: string
  activePanel: WorkspaceDataViewSettingsPanelKey
  canMutate: boolean
  viewerLayout: WorkspaceDataViewLayout
  viewerMode?: WorkspaceEditorMode
  allowMultiDimLayout?: boolean
  columns: readonly MarkdownDataViewColumn[]
  groupByColumnId: string | null
  viewConfig: WorkspaceDataViewConfig
  setViewConfig: (next: WorkspaceDataViewConfig) => void
  onChangeLayout: (layout: WorkspaceDataViewLayout) => void
  onChangeLayoutMode?: (mode: WorkspaceEditorMode) => void
  onSelectGeospatialView?: () => void
  onReset?: () => void
  onNewRecord?: () => void
  onAddColumn?: (args: { name: string; columnType: MarkdownDataViewColumnType }) => void
  onDuplicateColumn?: (columnId: string) => void
  onDeleteColumn?: (columnId: string) => void
  onRenameColumn?: (columnId: string, nextName: string) => void
}

export type WorkspaceDataViewFloatingDensity = {
  rowHeightPreset: DataViewRowHeightPreset
  fieldLineMode: DataViewFieldLineMode
}

const listeners = new Set<() => void>()
let currentBinding: WorkspaceDataViewFloatingBinding | null = null
let currentDensity: WorkspaceDataViewFloatingDensity = {
  rowHeightPreset: 'comfortable',
  fieldLineMode: 'single',
}

const notifyListeners = () => {
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => currentBinding
const getDensitySnapshot = () => currentDensity

const readBindingDensity = (binding: WorkspaceDataViewFloatingBinding): WorkspaceDataViewFloatingDensity => ({
  rowHeightPreset: binding.viewConfig.rowHeightPreset === 'compact' ? 'compact' : 'comfortable',
  fieldLineMode: binding.viewConfig.fieldLineMode === 'double' ? 'double' : 'single',
})

export function setWorkspaceDataViewFloatingBinding(
  binding: WorkspaceDataViewFloatingBinding | null,
) {
  const previousRegistrationId = currentBinding?.registrationId || null
  const previousBindingDensity = currentBinding ? readBindingDensity(currentBinding) : null
  currentBinding = binding
  if (binding) {
    const nextDensity = readBindingDensity(binding)
    const bindingDensityChanged =
      !previousBindingDensity
      || previousBindingDensity.rowHeightPreset !== nextDensity.rowHeightPreset
      || previousBindingDensity.fieldLineMode !== nextDensity.fieldLineMode
    const snapshotChanged =
      currentDensity.rowHeightPreset !== nextDensity.rowHeightPreset
      || currentDensity.fieldLineMode !== nextDensity.fieldLineMode
    if ((binding.registrationId !== previousRegistrationId || bindingDensityChanged) && snapshotChanged) {
      currentDensity = nextDensity
    }
  }
  notifyListeners()
}

export function setWorkspaceDataViewFloatingDensity(next: WorkspaceDataViewFloatingDensity) {
  const normalized: WorkspaceDataViewFloatingDensity = {
    rowHeightPreset: next.rowHeightPreset === 'compact' ? 'compact' : 'comfortable',
    fieldLineMode: next.fieldLineMode === 'double' ? 'double' : 'single',
  }
  if (
    currentDensity.rowHeightPreset === normalized.rowHeightPreset
    && currentDensity.fieldLineMode === normalized.fieldLineMode
  ) {
    return
  }
  currentDensity = normalized
  notifyListeners()
}

export function clearWorkspaceDataViewFloatingBinding(registrationId: string | null) {
  if (!registrationId) return
  if (currentBinding?.registrationId !== registrationId) return
  currentBinding = null
  notifyListeners()
}

export function useWorkspaceDataViewFloatingBinding() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useWorkspaceDataViewFloatingDensity() {
  return React.useSyncExternalStore(subscribe, getDensitySnapshot, getDensitySnapshot)
}

export function useWorkspaceDataViewFloatingRegistration(
  binding: WorkspaceDataViewFloatingBinding | null,
) {
  const previousRegistrationIdRef = React.useRef<string | null>(null)

  React.useLayoutEffect(() => {
    if (!binding) {
      clearWorkspaceDataViewFloatingBinding(previousRegistrationIdRef.current)
      previousRegistrationIdRef.current = null
      return
    }
    previousRegistrationIdRef.current = binding.registrationId
    setWorkspaceDataViewFloatingBinding(binding)
    return () => {
      clearWorkspaceDataViewFloatingBinding(binding.registrationId)
    }
  }, [binding])
}
