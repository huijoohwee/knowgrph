import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { isWorkspaceTableOpen, openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'

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
    </section>
  )
}
