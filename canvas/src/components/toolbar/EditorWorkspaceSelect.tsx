import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Database, FileCode, Link2, Table } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import {
  isWorkspaceTableOpen,
  openWorkspaceEditorPane,
} from '@/features/workspace-table/workspaceTableSsot'
import { WORKSPACE_TABLE_TOOLBAR_UI } from '@/features/workspace-table/workspaceTableToolbarUi'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import {
  UI_RESPONSIVE_COMPACT_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME,
  UI_RESPONSIVE_MENU_OPTION_ROW_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  readWorkspaceSeedSyncEnabledSetting,
  subscribeWorkspaceStoreSyncSettingsChanged,
  writeWorkspaceSeedSyncEnabledSetting,
} from '@/lib/workspace/workspaceStoreSyncSettings'

type EditorWorkspaceSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked?: () => boolean
}

type EditorWorkspaceOptionKey = 'editor'

type Option = {
  key: EditorWorkspaceOptionKey
  label: string
  tooltip: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
}

export function EditorWorkspaceSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked }: EditorWorkspaceSelectProps) {
  const [storageSyncEnabled, setStorageSyncEnabled] = React.useState(() => readWorkspaceSeedSyncEnabledSetting())
  const {
    workspaceViewMode,
    editorWorkspacePane,
    canvasWorkspaceSyncMode,
    setCanvasWorkspaceSyncMode,
  } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      canvasWorkspaceSyncMode: s.canvasWorkspaceSyncMode,
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
      ] satisfies Option[],
    [],
  )

  const activeKey: EditorWorkspaceOptionKey | null = isEditor ? 'editor' : null

  const triggerTitle = UI_LABELS.workspaceView
  const triggerTooltip = (() => {
    if (isGraphTable) return WORKSPACE_TABLE_TOOLBAR_UI.tableOpenedTooltip
    if (isEditor) return WORKSPACE_TABLE_TOOLBAR_UI.editorOnTooltip
    return WORKSPACE_TABLE_TOOLBAR_UI.editorOffTooltip
  })()

  const apply = React.useCallback(
    (_key: EditorWorkspaceOptionKey) => {
      const state = useGraphStore.getState()
      const liveWorkspaceViewMode = state.workspaceViewMode
      const liveEditorWorkspacePane = state.editorWorkspacePane
      const liveWorkspaceCanvasPaneOpen = state.workspaceCanvasPaneOpen
      const liveIsGraphTable = isWorkspaceTableOpen({
        workspaceViewMode: liveWorkspaceViewMode,
        editorWorkspacePane: liveEditorWorkspacePane,
      })

      if (liveWorkspaceViewMode === 'editor' && !liveIsGraphTable && liveWorkspaceCanvasPaneOpen === true) {
        return
      }

      const snap = workspaceTablePreferencesStore.getSnapshot()
      if (snap.workspaceEditorMode === 'multiDimTable') {
        workspaceTablePreferencesStore.setWorkspaceEditorMode('table')
      }

      openWorkspaceEditorPane({
        workspaceViewMode: liveWorkspaceViewMode,
        editorWorkspacePane: liveEditorWorkspacePane,
        workspaceCanvasPaneOpen: liveWorkspaceCanvasPaneOpen,
        pane: 'markdown',
        setWorkspaceViewMode: state.setWorkspaceViewMode,
        setWorkspaceViewState: state.setWorkspaceViewState,
        setEditorWorkspacePane: state.setEditorWorkspacePane,
        setWorkspaceCanvasPaneOpen: state.setWorkspaceCanvasPaneOpen,
      })
    },
    [],
  )

  const handleTriggerClick = React.useCallback(() => {
    const state = useGraphStore.getState()
    const liveWorkspaceViewMode = state.workspaceViewMode
    const liveEditorWorkspacePane = state.editorWorkspacePane
    const liveWorkspaceCanvasPaneOpen = state.workspaceCanvasPaneOpen
    if (liveWorkspaceViewMode !== 'editor' || liveWorkspaceCanvasPaneOpen === true) return false
    openWorkspaceEditorPane({
      workspaceViewMode: liveWorkspaceViewMode,
      editorWorkspacePane: liveEditorWorkspacePane,
      workspaceCanvasPaneOpen: liveWorkspaceCanvasPaneOpen,
      pane: liveEditorWorkspacePane,
      setWorkspaceViewMode: state.setWorkspaceViewMode,
      setWorkspaceViewState: state.setWorkspaceViewState,
      setEditorWorkspacePane: state.setEditorWorkspacePane,
      setWorkspaceCanvasPaneOpen: state.setWorkspaceCanvasPaneOpen,
    })
    return true
  }, [])

  const toggleWorkspaceSyncMode = React.useCallback(() => {
    if (ensureBaselineUnlocked && !ensureBaselineUnlocked()) return
    setCanvasWorkspaceSyncMode(canvasWorkspaceSyncMode === 'realtime' ? 'manual' : 'realtime')
  }, [canvasWorkspaceSyncMode, ensureBaselineUnlocked, setCanvasWorkspaceSyncMode])

  React.useEffect(() => {
    const syncStorageSyncEnabled = () => setStorageSyncEnabled(readWorkspaceSeedSyncEnabledSetting())
    syncStorageSyncEnabled()
    return subscribeWorkspaceStoreSyncSettingsChanged(syncStorageSyncEnabled)
  }, [])

  const toggleStorageSync = React.useCallback(() => {
    const next = !readWorkspaceSeedSyncEnabledSetting()
    writeWorkspaceSeedSyncEnabledSetting(next)
    setStorageSyncEnabled(next)
  }, [])

  const syncLabel =
    canvasWorkspaceSyncMode === 'realtime'
      ? UI_COPY.canvasWorkspaceSyncRealtimeLabel
      : UI_COPY.canvasWorkspaceSyncManualLabel
  const storageSyncLabel = storageSyncEnabled ? UI_COPY.storageSyncOnLabel : UI_COPY.storageSyncOffLabel

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
      onTriggerClick={handleTriggerClick}
      renderButtonContent={() =>
        isGraphTable ? (
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
              className={`${UI_RESPONSIVE_MENU_OPTION_ROW_CLASSNAME} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={toggleWorkspaceSyncMode}
              title={
                canvasWorkspaceSyncMode === 'realtime'
                  ? UI_COPY.canvasWorkspaceSyncRealtimeTooltip
                  : UI_COPY.canvasWorkspaceSyncManualTooltip
              }
            >
              <Link2 className={`${iconSizeClass} shrink-0`} strokeWidth={iconStrokeWidth} />
              <span className="truncate">{`${UI_LABELS.workspaceSyncMode}: ${syncLabel}`}</span>
            </button>
          </li>
          <li className="list-none">
            <button
              type="button"
              className={`${UI_RESPONSIVE_MENU_OPTION_ROW_CLASSNAME} ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={toggleStorageSync}
              title={
                storageSyncEnabled
                  ? UI_COPY.storageSyncOnTooltip
                  : UI_COPY.storageSyncOffTooltip
              }
            >
              <Database className={`${iconSizeClass} shrink-0`} strokeWidth={iconStrokeWidth} />
              <span className="truncate">{`${UI_LABELS.storageSync}: ${storageSyncLabel}`}</span>
            </button>
          </li>
        </>
      )}
      menuWidthClass={UI_RESPONSIVE_COMPACT_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME}
    />
  )
}
