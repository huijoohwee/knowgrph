import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileText, GitMerge, Table, Tags } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { DropdownPanel } from '@/lib/ui/overlay'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiPrimaryChipActiveClassName, uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type DocumentModeSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked: () => boolean
}

type DocumentModeValue = 'documentStructure' | 'keyword' | 'frontmatter' | 'multiDimTable'

const MODE_MENU_WIDTH_CLASS = 'w-64'

export function DocumentModeSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked }: DocumentModeSelectProps) {
  const {
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    setDocumentSemanticMode,
    setFrontmatterModeEnabled,
    setMultiDimTableModeEnabled,
  } = useGraphStore(
    useShallow(s => ({
      documentSemanticMode: s.documentSemanticMode || 'document',
      frontmatterModeEnabled: s.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
      setDocumentSemanticMode: s.setDocumentSemanticMode,
      setFrontmatterModeEnabled: s.setFrontmatterModeEnabled,
      setMultiDimTableModeEnabled: s.setMultiDimTableModeEnabled,
    })),
  )

  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

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
          label: UI_LABELS.multiDimTableMode,
          tooltip: UI_COPY.multiDimTableModeTooltip,
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
    },
    [
      ensureBaselineUnlocked,
      frontmatterModeEnabled,
      multiDimTableModeEnabled,
      setDocumentSemanticMode,
      setFrontmatterModeEnabled,
      setMultiDimTableModeEnabled,
    ],
  )

  return (
    <>
      <IconButton
        ref={buttonRef}
        className={`App-toolbar__btn ${open ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName}`}
        title={activeOption.label}
        tooltipContent={activeOption.tooltip}
        onClick={() => setOpen(v => !v)}
        showTooltip
      >
        <activeOption.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      {open && (
        <DropdownPanel anchorRef={buttonRef} open={open} onClose={() => setOpen(false)} align="bottom-center">
          <menu
            className={`p-1 flex flex-col gap-1 ${MODE_MENU_WIDTH_CLASS} list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md`}
            aria-label="Document mode"
          >
            {options.map(option => {
              const isActive = option.value === activeMode
              return (
                <li key={option.value} className="list-none">
                  <button
                    type="button"
                    className={`w-full flex items-center gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      isActive ? uiPrimaryChipActiveClassName : ''
                    }`}
                    onClick={() => {
                      applyMode(option.value)
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
