import React from 'react'
import type { MarkdownDataViewColumn } from '@/features/markdown/ui/markdownDataViewModel'
import type { MarkdownDataViewColumnType } from '@/features/markdown/ui/markdownDataViewColumnType'
import type { WorkspaceDataViewConfig, WorkspaceDataViewLayout } from './workspaceDataViewConfig'
import type { WorkspaceEditorMode } from '@/features/workspace-table/workspaceEditorMode'

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

const listeners = new Set<() => void>()
let currentBinding: WorkspaceDataViewFloatingBinding | null = null

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

export function setWorkspaceDataViewFloatingBinding(
  binding: WorkspaceDataViewFloatingBinding | null,
) {
  currentBinding = binding
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
