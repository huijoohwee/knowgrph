import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { isWorkspaceTableOpen, openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'
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

type WorkspaceTableModeControlProps = {
  className?: string
}

export function WorkspaceTableModeControl({ className }: WorkspaceTableModeControlProps) {
  const {
    multiDimTableModeEnabled,
    setMultiDimTableModeEnabled,
    workspaceViewMode,
    editorWorkspacePane,
    setWorkspaceViewMode,
    setEditorWorkspacePane,
  } = useGraphStore(
    useShallow(s => ({
      multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
      setMultiDimTableModeEnabled: s.setMultiDimTableModeEnabled,
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
    })),
  )

  const tableWorkspaceOpen = isWorkspaceTableOpen({ workspaceViewMode, editorWorkspacePane })
  const prefs = React.useSyncExternalStore(
    workspaceTablePreferencesStore.subscribe,
    workspaceTablePreferencesStore.getSnapshot,
    workspaceTablePreferencesStore.getServerSnapshot,
  )
  const jsonImportTarget = prefs.jsonImportTarget as JsonImportWorkspaceTarget
  const jsonMarkdownMode = prefs.jsonMarkdownMode as JsonToMarkdownMode
  const jsonTableMaxRows = prefs.jsonTableMaxRows
  const jsonTableMaxColumns = prefs.jsonTableMaxColumns

  const handleToggleMode = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.currentTarget.checked
      setMultiDimTableModeEnabled(next)
      if (!next) return
      openWorkspaceTable({ workspaceViewMode, editorWorkspacePane, setWorkspaceViewMode, setEditorWorkspacePane })
    },
    [editorWorkspacePane, setEditorWorkspacePane, setMultiDimTableModeEnabled, setWorkspaceViewMode, workspaceViewMode],
  )

  const handleOpenTable = React.useCallback(() => {
    openWorkspaceTable({ workspaceViewMode, editorWorkspacePane, setWorkspaceViewMode, setEditorWorkspacePane })
  }, [editorWorkspacePane, setEditorWorkspacePane, setWorkspaceViewMode, workspaceViewMode])

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

  return (
    <section className={className || 'flex flex-col gap-2'} aria-label={UI_COPY.markdownDataViewTitleDefault}>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">{UI_COPY.markdownDataViewTitleDefault}</span>
        <input
          type="checkbox"
          checked={multiDimTableModeEnabled}
          onChange={handleToggleMode}
          aria-label={UI_COPY.multiDimTableModeToggleTooltip}
        />
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
        <span className="min-w-0 truncate">JSON import target</span>
        <select
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
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
          className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
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
