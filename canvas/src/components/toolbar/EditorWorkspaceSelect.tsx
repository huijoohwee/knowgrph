import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileCode, Table } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { DropdownPanel } from '@/lib/ui/overlay'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiPrimaryChipActiveClassName, uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type EditorWorkspaceSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
}

type EditorWorkspaceOptionKey = 'editor' | 'graphDataTable'

type Option = {
  key: EditorWorkspaceOptionKey
  label: string
  tooltip: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
}

const MENU_WIDTH_CLASS = 'w-64'

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

  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  const isEditor = workspaceViewMode === 'editor'
  const isGraphTable = isEditor && editorWorkspacePane === 'graphTable'

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
          key: 'graphDataTable' as const,
          label: UI_LABELS.graphDataTable,
          tooltip: UI_COPY.toolbarGraphDataTableToggleTitle,
          Icon: Table,
        },
      ] satisfies Option[],
    [],
  )

  const activeKey: EditorWorkspaceOptionKey | null = isGraphTable ? 'graphDataTable' : isEditor ? 'editor' : null
  const activeOption = activeKey ? options.find(o => o.key === activeKey) || null : null

  const triggerTitle = activeOption?.label || UI_LABELS.editor
  const triggerTooltip = (() => {
    if (isGraphTable) return UI_COPY.toolbarGraphDataTableWorkspaceOnTooltip
    if (isEditor) return UI_COPY.toolbarEditorWorkspaceOnTooltip
    return UI_COPY.toolbarEditorWorkspaceOffTooltip
  })()

  const apply = React.useCallback(
    (key: EditorWorkspaceOptionKey) => {
      if (workspaceViewMode !== 'editor') setWorkspaceViewMode('editor')
      if (key === 'graphDataTable') {
        setEditorWorkspacePane('graphTable')
        return
      }
      setEditorWorkspacePane('markdown')
    },
    [setEditorWorkspacePane, setWorkspaceViewMode, workspaceViewMode],
  )

  return (
    <>
      <IconButton
        ref={buttonRef}
        className={`App-toolbar__btn ${open || isEditor ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName}`}
        title={triggerTitle}
        tooltipContent={triggerTooltip}
        onClick={() => setOpen(v => !v)}
        showTooltip
      >
        {activeKey === 'graphDataTable' ? (
          <Table className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <FileCode className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>

      {open && (
        <DropdownPanel anchorRef={buttonRef} open={open} onClose={() => setOpen(false)} align="bottom-center">
          <menu
            className={`p-1 flex flex-col gap-1 ${MENU_WIDTH_CLASS} list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md`}
            aria-label="Workspace"
          >
            {options.map(option => {
              const active = option.key === activeKey
              return (
                <li key={option.key} className="list-none">
                  <button
                    type="button"
                    className={`w-full flex items-center gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      active ? uiPrimaryChipActiveClassName : ''
                    }`}
                    onClick={() => {
                      apply(option.key)
                      setOpen(false)
                    }}
                    title={option.tooltip}
                  >
                    <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              )
            })}
          </menu>
        </DropdownPanel>
      )}
    </>
  )
}

