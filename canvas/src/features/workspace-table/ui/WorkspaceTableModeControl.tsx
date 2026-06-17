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
import { openMarkdownWorkspaceEditorPane } from '@/features/workspace-table/workspaceEditorPane'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'
import { PanelField, PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { uiToolbarRowScrollJustifyBetweenClassName } from '@/features/toolbar/ui/toolbarStyles'

type WorkspaceTableModeControlProps = {
  className?: string
}

export function WorkspaceTableModeControl({ className }: WorkspaceTableModeControlProps) {
  const {
    workspaceViewMode,
    editorWorkspacePane,
    workspaceCanvasPaneOpen,
    setWorkspaceViewMode,
    setWorkspaceViewState,
    setEditorWorkspacePane,
    setWorkspaceCanvasPaneOpen,
  } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
      setWorkspaceViewState: s.setWorkspaceViewState,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen: s.setWorkspaceCanvasPaneOpen,
    })),
  )

  const tableWorkspaceOpen = workspaceViewMode === 'editor' && workspaceCanvasPaneOpen === true
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

  const openWorkspaceMultiDimTableFromControl = React.useCallback(() => {
    openMarkdownWorkspaceEditorPane({
      workspaceViewMode,
      editorWorkspacePane,
      workspaceCanvasPaneOpen,
      setWorkspaceViewMode,
      setWorkspaceViewState,
      setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen,
    })
  }, [editorWorkspacePane, setEditorWorkspacePane, setWorkspaceCanvasPaneOpen, setWorkspaceViewMode, setWorkspaceViewState, workspaceCanvasPaneOpen, workspaceViewMode])

  const handleWorkspaceEditorModeChanged = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.currentTarget.value as WorkspaceEditorMode
      workspaceTablePreferencesStore.setWorkspaceEditorMode(next)
      openWorkspaceMultiDimTableFromControl()
    },
    [openWorkspaceMultiDimTableFromControl],
  )

  const handleOpenTable = openWorkspaceMultiDimTableFromControl

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

  const inlineFieldRowClassName = `${uiToolbarRowScrollJustifyBetweenClassName} gap-2 text-xs`
  const inlineFieldLabelClassName = `mb-0 min-w-0 ${UI_TEXT_TRUNCATE}`
  const numberFieldClassName = `App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`

  return (
    <section className={className || 'flex min-w-0 max-w-full flex-col gap-2 overflow-hidden'} aria-label={UI_COPY.markdownDataViewTitleDefault}>
      <PanelField
        label="Workspace editor view"
        variant="section"
        className={inlineFieldRowClassName}
        labelClassName={inlineFieldLabelClassName}
      >
        <PanelSelect
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
        </PanelSelect>
      </PanelField>
      <button
        type="button"
        className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
        onClick={handleOpenTable}
        disabled={tableWorkspaceOpen}
      >
        <span className={UI_TEXT_TRUNCATE}>
          {tableWorkspaceOpen ? UI_COPY.toolbarMultiDimTableWorkspaceOnTooltip : UI_COPY.toolbarMultiDimTableToggleTitle}
        </span>
      </button>
      <PanelField
        label="Select panel position"
        variant="section"
        className={inlineFieldRowClassName}
        labelClassName={inlineFieldLabelClassName}
      >
        <PanelSelect
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
        </PanelSelect>
      </PanelField>
      <PanelField
        label="JSON import target"
        variant="section"
        className={inlineFieldRowClassName}
        labelClassName={inlineFieldLabelClassName}
      >
        <PanelSelect
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
        </PanelSelect>
      </PanelField>
      <PanelField
        label="JSON markdown mode"
        variant="section"
        className={inlineFieldRowClassName}
        labelClassName={inlineFieldLabelClassName}
      >
        <PanelSelect
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
        </PanelSelect>
      </PanelField>
      <PanelField
        label="JSON table max rows"
        variant="section"
        className={inlineFieldRowClassName}
        labelClassName={inlineFieldLabelClassName}
      >
        <PanelTextInput
          type="number"
          className={numberFieldClassName}
          value={jsonTableMaxRows}
          min={JSON_MARKDOWN_TABLE_LIMIT_MIN}
          max={JSON_MARKDOWN_TABLE_LIMIT_MAX}
          onChange={handleJsonTableMaxRowsChanged}
          aria-label="JSON table max rows"
        />
      </PanelField>
      <PanelField
        label="JSON table max columns"
        variant="section"
        className={inlineFieldRowClassName}
        labelClassName={inlineFieldLabelClassName}
      >
        <PanelTextInput
          type="number"
          className={numberFieldClassName}
          value={jsonTableMaxColumns}
          min={JSON_MARKDOWN_TABLE_LIMIT_MIN}
          max={JSON_MARKDOWN_TABLE_LIMIT_MAX}
          onChange={handleJsonTableMaxColumnsChanged}
          aria-label="JSON table max columns"
        />
      </PanelField>
    </section>
  )
}
