import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileText, GitMerge, Table, Tags } from 'lucide-react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { isWorkspaceTableOpen, openWorkspaceTable } from '@/features/workspace-table/workspaceTableSsot'
import { WORKSPACE_TABLE_TOOLBAR_UI } from '@/features/workspace-table/workspaceTableToolbarUi'

type DocumentModeSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked: () => boolean
}

type DocumentModeValue = 'documentStructure' | 'keyword' | 'frontmatter' | 'multiDimTable'

export function DocumentModeSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked }: DocumentModeSelectProps) {
  const {
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    setDocumentSemanticMode,
    setFrontmatterModeEnabled,
    setMultiDimTableModeEnabled,
    workspaceViewMode,
    editorWorkspacePane,
    setWorkspaceViewMode,
    setEditorWorkspacePane,
  } = useGraphStore(
    useShallow(s => ({
      documentSemanticMode: s.documentSemanticMode || 'document',
      frontmatterModeEnabled: s.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
      setDocumentSemanticMode: s.setDocumentSemanticMode,
      setFrontmatterModeEnabled: s.setFrontmatterModeEnabled,
      setMultiDimTableModeEnabled: s.setMultiDimTableModeEnabled,
      workspaceViewMode: s.workspaceViewMode,
      editorWorkspacePane: s.editorWorkspacePane,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
    })),
  )

  const activeMode: DocumentModeValue = multiDimTableModeEnabled
    ? 'multiDimTable'
    : frontmatterModeEnabled
      ? 'frontmatter'
      : documentSemanticMode === 'keyword'
        ? 'keyword'
        : 'documentStructure'

  const options = React.useMemo(
    () =>
      [
        {
          value: 'documentStructure' as const,
          label: UI_LABELS.documentStructureMode,
          tooltip: UI_COPY.documentStructureModeTooltip,
          Icon: FileText,
        },
        {
          value: 'keyword' as const,
          label: UI_LABELS.keywordMode,
          tooltip: UI_COPY.keywordModeTooltip,
          Icon: Tags,
        },
        {
          value: 'frontmatter' as const,
          label: UI_LABELS.frontmatterMode,
          tooltip: UI_COPY.frontmatterModeTooltip,
          Icon: GitMerge,
        },
        {
          value: 'multiDimTable' as const,
          label: WORKSPACE_TABLE_TOOLBAR_UI.label,
          tooltip: WORKSPACE_TABLE_TOOLBAR_UI.optionTooltip,
          Icon: Table,
        },
      ] satisfies Array<{
        value: DocumentModeValue
        label: string
        tooltip: string
        Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
      }>,
    [],
  )

  const activeOption = options.find(o => o.value === activeMode) || options[0]
  const tableWorkspaceOpen = isWorkspaceTableOpen({ workspaceViewMode, editorWorkspacePane })
  const triggerTooltip =
    activeMode === 'multiDimTable'
      ? tableWorkspaceOpen
        ? WORKSPACE_TABLE_TOOLBAR_UI.openedTooltip
        : WORKSPACE_TABLE_TOOLBAR_UI.closedTooltip
      : activeOption.tooltip

  React.useEffect(() => {
    if (!multiDimTableModeEnabled) return
    openWorkspaceTable({ workspaceViewMode, editorWorkspacePane, setWorkspaceViewMode, setEditorWorkspacePane })
  }, [editorWorkspacePane, multiDimTableModeEnabled, setEditorWorkspacePane, setWorkspaceViewMode, workspaceViewMode])

  const applyMode = React.useCallback(
    (next: DocumentModeValue) => {
      if (!ensureBaselineUnlocked()) return

      if (next === 'documentStructure') {
        if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
        if (frontmatterModeEnabled) setFrontmatterModeEnabled(false)
        setDocumentSemanticMode('document')
        return
      }
      if (next === 'keyword') {
        if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
        if (frontmatterModeEnabled) setFrontmatterModeEnabled(false)
        setDocumentSemanticMode('keyword')
        return
      }
      if (next === 'frontmatter') {
        setFrontmatterModeEnabled(true)
        return
      }
      setMultiDimTableModeEnabled(true)
      openWorkspaceTable({ workspaceViewMode, editorWorkspacePane, setWorkspaceViewMode, setEditorWorkspacePane })
    },
    [
      editorWorkspacePane,
      ensureBaselineUnlocked,
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      setEditorWorkspacePane,
      setDocumentSemanticMode,
      setFrontmatterModeEnabled,
      setMultiDimTableModeEnabled,
      setWorkspaceViewMode,
      workspaceViewMode,
    ],
  )

  return (
    <ToolbarDropdownSelect
      value={activeMode}
      options={options.map(option => ({
        id: option.value,
        title: option.label,
        tooltip: option.tooltip,
        Icon: option.Icon,
      }))}
      title={activeOption.label}
      tooltipContent={triggerTooltip}
      onSelect={id => applyMode(id)}
      renderButtonContent={active => (
        <active.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      )}
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
