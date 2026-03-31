import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileCode, Table } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { isWorkspaceTableOpen, openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'

type EditorWorkspaceSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
}

type EditorWorkspaceOptionKey = 'editor' | 'multiDimTable'

type Option = {
  key: EditorWorkspaceOptionKey
  label: string
  tooltip: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
}

export function EditorWorkspaceSelect({ iconSizeClass, iconStrokeWidth }: EditorWorkspaceSelectProps) {
  const {
    workspaceViewMode,
    editorWorkspacePane,
    setEditorWorkspacePane,
    setWorkspaceViewMode,
  } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
    })),
  )

  const isEditor = workspaceViewMode === 'editor'
  const isGraphTable = isWorkspaceTableOpen({ workspaceViewMode, editorWorkspacePane })

  const options = React.useMemo(
    () =>
      [
        {
          key: 'editor' as const,
          label: UI_LABELS.editor,
          tooltip: UI_COPY.toolbarEditorWorkspaceOffTooltip,
          Icon: FileCode,
        },
        {
          key: 'multiDimTable' as const,
          label: UI_LABELS.graphDataTable,
          tooltip: UI_COPY.toolbarGraphDataTableToggleTitle,
          Icon: Table,
        },
      ] satisfies Option[],
    [],
  )

  const activeKey: EditorWorkspaceOptionKey | null = isGraphTable ? 'multiDimTable' : isEditor ? 'editor' : null
  const activeOption = activeKey ? options.find(o => o.key === activeKey) || null : null

  const triggerTitle = activeOption?.label || UI_LABELS.editor
  const triggerTooltip = (() => {
    if (isGraphTable) return UI_COPY.toolbarGraphDataTableWorkspaceOnTooltip
    if (isEditor) return UI_COPY.toolbarEditorWorkspaceOnTooltip
    return UI_COPY.toolbarEditorWorkspaceOffTooltip
  })()

  const apply = React.useCallback(
    (key: EditorWorkspaceOptionKey) => {
      if (key === 'multiDimTable') {
        openWorkspaceTable({ workspaceViewMode, editorWorkspacePane, setWorkspaceViewMode, setEditorWorkspacePane })
        return
      }
      if (workspaceViewMode !== 'editor') setWorkspaceViewMode('editor')
      setEditorWorkspacePane('markdown')
    },
    [editorWorkspacePane, setEditorWorkspacePane, setWorkspaceViewMode, workspaceViewMode],
  )

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
      menuWidthClass="w-64"
    />
  )
}
