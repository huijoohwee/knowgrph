import React from 'react'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { normalizeSelectOptionsAndDefaultValue } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import { KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME } from '@/features/panels/ui/KeyTypeValueRow'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getIconSizeClass } from '@/lib/ui'
import { reorderList } from '@/lib/reorder'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'
import {
  UI_RESPONSIVE_GRAPH_FIELDS_COMPACT_ICON_CELL_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_FIELD_INPUT_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_OPTION_ACTION_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_OPTION_DRAG_HANDLE_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_OPTION_ROW_CLASSNAME,
  UI_RESPONSIVE_GRAPH_FIELDS_OPTION_SWATCH_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

function buildOptionSwatchStyle(value: string): React.CSSProperties {
  const raw = String(value || '')
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  const bg = `hsl(${hue} 70% 88%)`
  const fg = `hsl(${hue} 45% 22%)`
  return { backgroundColor: bg, color: fg }
}

function createNextSelectOptionLabel(current: ReadonlyArray<string>): string {
  const existing = new Set(current.map(v => v.trim()).filter(Boolean))
  for (let i = 1; i < 10_000; i += 1) {
    const candidate = `Option ${i}`
    if (!existing.has(candidate)) return candidate
  }
  return `Option ${current.length + 1}`
}

export function SelectOptionsSection({
  selectedSettings,
  updateSettings,
  sampleCount,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
  sampleCount?: number
}) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  )
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const [draggingSelectOptionIndex, setDraggingSelectOptionIndex] = React.useState<number | null>(null)
  const [pendingFocusSelectOptionIndex, setPendingFocusSelectOptionIndex] = React.useState<number | null>(null)
  const selectOptionInputRefs = React.useRef<Map<number, HTMLInputElement | null>>(new Map())

  React.useEffect(() => {
    if (pendingFocusSelectOptionIndex === null) return
    const el = selectOptionInputRefs.current.get(pendingFocusSelectOptionIndex)
    if (el) {
      try {
        el.focus()
        el.select()
      } catch {
        void 0
      }
    }
    setPendingFocusSelectOptionIndex(null)
  }, [pendingFocusSelectOptionIndex, selectedSettings.selectOptions.length])

  const setSelectedSelectOptions = React.useCallback(
    (options: ReadonlyArray<string>) => {
      const next = normalizeSelectOptionsAndDefaultValue({
        fieldType: selectedSettings.fieldType,
        selectOptions: options,
        defaultValue: selectedSettings.defaultValue,
      })
      updateSettings(next)
    },
    [selectedSettings.defaultValue, selectedSettings.fieldType, updateSettings],
  )

  return (
    <div className={`rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`}>
      <div className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.primary}`}>{UI_LABELS.options}</span>
        <div className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
          {typeof sampleCount === 'number' && sampleCount > 0 ? <span>Graph data {sampleCount}</span> : null}
          <span>{selectedSettings.selectOptions.length}</span>
        </div>
      </div>
      <div className={`mt-2 rounded-lg border ${UI_THEME_TOKENS.panel.border} overflow-auto`}>
        {selectedSettings.selectOptions.length === 0 ? (
          <div className={`px-2 py-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.graphFieldsNoOptions}</div>
        ) : null}
        {selectedSettings.selectOptions.map((opt, idx) => (
          <div
            key={`${idx}:${opt}`}
            className={`${UI_RESPONSIVE_GRAPH_FIELDS_OPTION_ROW_CLASSNAME} group ${UI_THEME_TOKENS.table.rowHover} ${draggingSelectOptionIndex === idx ? 'opacity-60' : ''}`}
            onDragOver={e => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={e => {
              e.preventDefault()
              const raw = e.dataTransfer.getData('text/plain') || ''
              const fromIndex = Number(raw)
              if (!Number.isFinite(fromIndex)) return
              if (fromIndex === idx) return
              const next = reorderList(selectedSettings.selectOptions, fromIndex, idx)
              setSelectedSelectOptions(next)
              setDraggingSelectOptionIndex(null)
            }}
          >
            <div
              className={`${UI_RESPONSIVE_GRAPH_FIELDS_OPTION_DRAG_HANDLE_CLASSNAME} cursor-grab ${UI_THEME_TOKENS.text.tertiary}`}
              draggable
              onDragStart={e => {
                setDraggingSelectOptionIndex(idx)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(idx))
              }}
              onDragEnd={() => setDraggingSelectOptionIndex(null)}
              aria-label={UI_LABELS.dragToReorder}
              title={UI_LABELS.dragToReorder}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={`text-current ${iconSizeClass}`}>
                <path
                  d="M8 7h2M8 12h2M8 17h2M14 7h2M14 12h2M14 17h2"
                  stroke="currentColor"
                  strokeWidth={uiIconStrokeWidth}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={UI_RESPONSIVE_GRAPH_FIELDS_OPTION_SWATCH_CLASSNAME}>
              <div className={`${UI_RESPONSIVE_GRAPH_FIELDS_COMPACT_ICON_CELL_CLASSNAME} rounded flex items-center justify-center`} style={buildOptionSwatchStyle(opt)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSizeClass}>
                  <path
                    fill="currentColor"
                    d="M12 14.975q-.2 0-.375-.062T11.3 14.7l-4.6-4.6q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l3.9 3.9l3.9-3.9q.275-.275.7-.275t.7.275t.275.7t-.275.7l-4.6 4.6q-.15.15-.325.213t-.375.062"
                  />
                </svg>
              </div>
            </div>
            <input
              value={opt}
              ref={el => {
                if (!el) {
                  selectOptionInputRefs.current.delete(idx)
                  return
                }
                selectOptionInputRefs.current.set(idx, el)
              }}
              onChange={e => {
                const next = [...selectedSettings.selectOptions]
                next[idx] = e.target.value
                setSelectedSelectOptions(next)
              }}
              className={`${UI_RESPONSIVE_GRAPH_FIELDS_FIELD_INPUT_CLASSNAME} flex-1 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.input.text}`}
            />
            <button
              type="button"
              className={`${UI_RESPONSIVE_GRAPH_FIELDS_OPTION_ACTION_CLASSNAME} ${UI_THEME_TOKENS.text.tertiary} hover:!${UI_THEME_TOKENS.text.secondary} cursor-pointer ${UI_THEME_TOKENS.button.hoverBg} rounded-md invisible group-hover:visible`}
              onClick={() => {
                const next = selectedSettings.selectOptions.filter((_, i) => i !== idx)
                setSelectedSelectOptions(next)
              }}
              aria-label={UI_LABELS.removeOption}
              title={UI_LABELS.removeOption}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={iconSizeClass}>
                <path
                  fill="currentColor"
                  d="m12 13.4l-4.9 4.9q-.275.275-.7.275t-.7-.275t-.275-.7t.275-.7l4.9-4.9l-4.9-4.9q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l4.9 4.9l4.9-4.9q.275-.275.7-.275t.7.275t.275.7t-.275.7L13.4 12l4.9 4.9q.275.275.275.7t-.275.7t-.7.275t-.7-.275z"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`mt-2 w-full App-toolbar__btn ${uiPanelKeyValueTextSizeClass} border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary} flex items-center justify-center gap-2`}
        onClick={() => {
          const nextLabel = createNextSelectOptionLabel(selectedSettings.selectOptions)
          setPendingFocusSelectOptionIndex(selectedSettings.selectOptions.length)
          setSelectedSelectOptions([...selectedSettings.selectOptions, nextLabel])
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg" className={iconSizeClass}>
          <path d="M8 3.33301V12.6663" stroke="currentColor" strokeWidth={uiIconStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.33325 8H12.6666" stroke="currentColor" strokeWidth={uiIconStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{UI_LABELS.add}</span>
      </button>
    </div>
  )
}
