import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileCode, Link2, Table } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { isWorkspaceTableOpen, openWorkspaceEditorPane, openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'
import { WORKSPACE_TABLE_TOOLBAR_UI } from '@/features/workspace-table/workspaceTableToolbarUi'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type EditorWorkspaceSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked?: () => boolean
}

type EditorWorkspaceOptionKey = 'editor' | 'multiDimTable'

type Option = {
  key: EditorWorkspaceOptionKey
  label: string
  tooltip: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
}

export function EditorWorkspaceSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked }: EditorWorkspaceSelectProps) {
  const {
    workspaceViewMode,
    editorWorkspacePane,
    workspaceCanvasPaneOpen,
    canvasWorkspaceSyncMode,
    setEditorWorkspacePane,
    setWorkspaceCanvasPaneOpen,
    setWorkspaceViewMode,
    setCanvasWorkspaceSyncMode,
  } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
      canvasWorkspaceSyncMode: s.canvasWorkspaceSyncMode,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen: s.setWorkspaceCanvasPaneOpen,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
      setCanvasWorkspaceSyncMode: s.setCanvasWorkspaceSyncMode,
    })),
  )

  const isEditor = workspaceViewMode === 'editor'
  const isGraphTable = isWorkspaceTableOpen({ workspaceViewMode, editorWorkspacePane })

  const options = React.useMemo(
    () =>
      [
        {
          key: 'editor' as const,
          label: WORKSPACE_TABLE_TOOLBAR_UI.editorLabel,
          tooltip: WORKSPACE_TABLE_TOOLBAR_UI.editorOffTooltip,
          Icon: FileCode,
        },
        {
          key: 'multiDimTable' as const,
          label: WORKSPACE_TABLE_TOOLBAR_UI.tableLabel,
          tooltip: WORKSPACE_TABLE_TOOLBAR_UI.tableOptionTooltip,
          Icon: Table,
        },
      ] satisfies Option[],
    [],
  )

  const activeKey: EditorWorkspaceOptionKey | null = isGraphTable ? 'multiDimTable' : isEditor ? 'editor' : null
  const activeOption = activeKey ? options.find(o => o.key === activeKey) || null : null

  const triggerTitle = UI_LABELS.workspaceView
  const triggerTooltip = (() => {
    if (isGraphTable) return WORKSPACE_TABLE_TOOLBAR_UI.tableOpenedTooltip
    if (isEditor) return WORKSPACE_TABLE_TOOLBAR_UI.editorOnTooltip
    return WORKSPACE_TABLE_TOOLBAR_UI.editorOffTooltip
  })()

  const apply = React.useCallback(
    (key: EditorWorkspaceOptionKey) => {
      if (key === 'multiDimTable') {
        const snap = workspaceTablePreferencesStore.getSnapshot()
        if (snap.workspaceEditorMode !== 'multiDimTable') {
          workspaceTablePreferencesStore.setWorkspaceEditorMode('multiDimTable')
        }
        openWorkspaceTable({
          workspaceViewMode,
          editorWorkspacePane,
          workspaceCanvasPaneOpen,
          setWorkspaceViewMode,
          setEditorWorkspacePane,
          setWorkspaceCanvasPaneOpen,
        })
        return
      }

      const snap = workspaceTablePreferencesStore.getSnapshot()
      if (snap.workspaceEditorMode === 'multiDimTable') {
        workspaceTablePreferencesStore.setWorkspaceEditorMode('table')
      }

      openWorkspaceEditorPane({
        workspaceViewMode,
        editorWorkspacePane,
        workspaceCanvasPaneOpen,
        pane: 'markdown',
        setWorkspaceViewMode,
        setEditorWorkspacePane,
        setWorkspaceCanvasPaneOpen,
      })
    },
    [editorWorkspacePane, setEditorWorkspacePane, setWorkspaceCanvasPaneOpen, setWorkspaceViewMode, workspaceCanvasPaneOpen, workspaceViewMode],
  )

  const toggleWorkspaceSyncMode = React.useCallback(() => {
    if (ensureBaselineUnlocked && !ensureBaselineUnlocked()) return
    setCanvasWorkspaceSyncMode(canvasWorkspaceSyncMode === 'realtime' ? 'manual' : 'realtime')
  }, [canvasWorkspaceSyncMode, ensureBaselineUnlocked, setCanvasWorkspaceSyncMode])

  const syncLabel =
    canvasWorkspaceSyncMode === 'realtime'
      ? UI_COPY.canvasWorkspaceSyncRealtimeLabel
      : UI_COPY.canvasWorkspaceSyncManualLabel

  return (
    <ToolbarDropdownSelect
      value={activeKey || 'editor'}
      options={options.map(option => ({
        id: option.key,
        title: option.label,
        tooltip: option.tooltip,
        Icon: option.Icon,
      }))}
      title={triggerTitle}
      tooltipContent={triggerTooltip}
      isButtonActive={isEditor}
      onSelect={id => apply(id)}
      renderButtonContent={() =>
        activeKey === 'multiDimTable' ? (
          <Table className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <FileCode className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )
      }
      renderOptionContent={option => (
        <>
          <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="truncate">{option.title}</span>
        </>
      )}
      renderMenuAppend={() => (
        <>
          <li className="list-none px-1 py-0.5" aria-hidden="true">
            <hr className={`border-t ${UI_THEME_TOKENS.panel.border}`} />
          </li>
          <li className="list-none">
            <button
              type="button"
              className={`w-full flex items-center gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} hover:bg-gray-100 dark:hover:bg-gray-800`}
              onClick={toggleWorkspaceSyncMode}
              title={
                canvasWorkspaceSyncMode === 'realtime'
                  ? UI_COPY.canvasWorkspaceSyncRealtimeTooltip
                  : UI_COPY.canvasWorkspaceSyncManualTooltip
              }
            >
              <Link2 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
              <span className="truncate">{`${UI_LABELS.workspaceSyncMode}: ${syncLabel}`}</span>
            </button>
          </li>
        </>
      )}
      menuWidthClass="w-64"
    />
  )
}
