import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  JSON_IMPORT_WORKSPACE_TARGET_LABELS,
  JSON_IMPORT_WORKSPACE_TARGET_OPTIONS,
  type JsonImportWorkspaceTarget,
} from '@/features/workspace-table/jsonImportWorkspaceTarget'
import {
  JSON_MARKDOWN_MODE_LABELS,
  JSON_MARKDOWN_MODE_SELECT_OPTIONS,
  JSON_MARKDOWN_TABLE_LIMIT_MAX,
  JSON_MARKDOWN_TABLE_LIMIT_MIN,
} from '@/features/markdown/jsonMarkdownPreferences'
import type { JsonToMarkdownMode } from '@/features/markdown/jsonToMarkdown'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import {
  WORKSPACE_EDITOR_MODE_OPTIONS,
  type WorkspaceEditorMode,
} from '@/features/workspace-table/workspaceEditorMode'
import { getWorkspaceEditorModeLabel } from '@/features/workspace-table/workspaceEditorModePresentation'
import {
  WORKSPACE_CELL_SELECT_PANEL_PLACEMENT_LABELS,
  WORKSPACE_CELL_SELECT_PANEL_PLACEMENT_OPTIONS,
  type WorkspaceCellSelectPanelPlacement,
} from '@/features/workspace-table/cellSelectPanelPlacement'
import { openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'

type WorkspaceTableModeControlProps = {
  className?: string
}

export function WorkspaceTableModeControl({ className }: WorkspaceTableModeControlProps) {
  const {
    workspaceViewMode,
    editorWorkspacePane,
    workspaceCanvasPaneOpen,
    setWorkspaceViewMode,
    setEditorWorkspacePane,
    setWorkspaceCanvasPaneOpen,
  } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen: s.setWorkspaceCanvasPaneOpen,
    })),
  )

  const tableWorkspaceOpen = workspaceViewMode === 'editor' && editorWorkspacePane === 'graphTable'
  const prefs = React.useSyncExternalStore(
    workspaceTablePreferencesStore.subscribe,
    workspaceTablePreferencesStore.getSnapshot,
    workspaceTablePreferencesStore.getServerSnapshot,
  )
  const workspaceEditorMode = prefs.workspaceEditorMode as WorkspaceEditorMode
  const jsonImportTarget = prefs.jsonImportTarget as JsonImportWorkspaceTarget
  const jsonMarkdownMode = prefs.jsonMarkdownMode as JsonToMarkdownMode
  const jsonTableMaxRows = prefs.jsonTableMaxRows
  const jsonTableMaxColumns = prefs.jsonTableMaxColumns
  const workspaceCellSelectPanelPlacement = prefs.workspaceCellSelectPanelPlacement as WorkspaceCellSelectPanelPlacement

  const openWorkspaceTableFromControl = React.useCallback(() => {
    openWorkspaceTable({
      workspaceViewMode,
      editorWorkspacePane,
      workspaceCanvasPaneOpen,
      setWorkspaceViewMode,
      setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen,
    })
  }, [editorWorkspacePane, setEditorWorkspacePane, setWorkspaceCanvasPaneOpen, setWorkspaceViewMode, workspaceCanvasPaneOpen, workspaceViewMode])

  const handleWorkspaceEditorModeChanged = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.currentTarget.value as WorkspaceEditorMode
      workspaceTablePreferencesStore.setWorkspaceEditorMode(next)
      openWorkspaceTableFromControl()
    },
    [openWorkspaceTableFromControl],
  )

  const handleOpenTable = openWorkspaceTableFromControl

  const handleJsonImportTargetChanged = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    workspaceTablePreferencesStore.setJsonImportTarget(event.currentTarget.value as JsonImportWorkspaceTarget)
  }, [])

  const handleJsonMarkdownModeChanged = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    workspaceTablePreferencesStore.setJsonMarkdownMode(event.currentTarget.value as JsonToMarkdownMode)
  }, [])

  const handleJsonTableMaxRowsChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    workspaceTablePreferencesStore.setJsonTableMaxRows(event.currentTarget.value)
  }, [])

  const handleJsonTableMaxColumnsChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    workspaceTablePreferencesStore.setJsonTableMaxColumns(event.currentTarget.value)
  }, [])

  const handleWorkspaceCellSelectPanelPlacementChanged = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    workspaceTablePreferencesStore.setWorkspaceCellSelectPanelPlacement(event.currentTarget.value as WorkspaceCellSelectPanelPlacement)
  }, [])

  return (
    <section className={className || 'flex flex-col gap-2'} aria-label={UI_COPY.markdownDataViewTitleDefault}>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">Workspace editor view</span>
        <select
          className={MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME}
          value={workspaceEditorMode}
          onChange={handleWorkspaceEditorModeChanged}
          aria-label="Workspace editor view"
        >
          {WORKSPACE_EDITOR_MODE_OPTIONS.map(option => (
            <option key={option} value={option}>
              {getWorkspaceEditorModeLabel(option)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
        onClick={handleOpenTable}
        disabled={tableWorkspaceOpen}
      >
        {tableWorkspaceOpen ? UI_COPY.toolbarGraphDataTableWorkspaceOnTooltip : UI_COPY.toolbarGraphDataTableToggleTitle}
      </button>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">Select panel position</span>
        <select
          className={MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME}
          value={workspaceCellSelectPanelPlacement}
          onChange={handleWorkspaceCellSelectPanelPlacementChanged}
          aria-label="Select panel position"
        >
          {WORKSPACE_CELL_SELECT_PANEL_PLACEMENT_OPTIONS.map(option => (
            <option key={option} value={option}>
              {WORKSPACE_CELL_SELECT_PANEL_PLACEMENT_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">JSON import target</span>
        <select
          className={MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME}
          value={jsonImportTarget}
          onChange={handleJsonImportTargetChanged}
          aria-label="JSON import target"
        >
          {JSON_IMPORT_WORKSPACE_TARGET_OPTIONS.map(option => (
            <option key={option} value={option}>
              {JSON_IMPORT_WORKSPACE_TARGET_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">JSON markdown mode</span>
        <select
          className={MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME}
          value={jsonMarkdownMode}
          onChange={handleJsonMarkdownModeChanged}
          aria-label="JSON markdown mode"
        >
          {JSON_MARKDOWN_MODE_SELECT_OPTIONS.map(option => (
            <option key={option} value={option}>
              {JSON_MARKDOWN_MODE_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">JSON table max rows</span>
        <input
          type="number"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          value={jsonTableMaxRows}
          min={JSON_MARKDOWN_TABLE_LIMIT_MIN}
          max={JSON_MARKDOWN_TABLE_LIMIT_MAX}
          onChange={handleJsonTableMaxRowsChanged}
          aria-label="JSON table max rows"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">JSON table max columns</span>
        <input
          type="number"
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          value={jsonTableMaxColumns}
          min={JSON_MARKDOWN_TABLE_LIMIT_MIN}
          max={JSON_MARKDOWN_TABLE_LIMIT_MAX}
          onChange={handleJsonTableMaxColumnsChanged}
          aria-label="JSON table max columns"
        />
      </label>
    </section>
  )
}
