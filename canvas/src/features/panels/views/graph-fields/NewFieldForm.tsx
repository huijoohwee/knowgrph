import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { FieldKeyIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { GRAPH_FIELD_TYPES, type GraphFieldType } from '@/features/graph-fields/graphFields'
import { MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME } from '@/features/panels/ui/mainPanelSettingsSelectClass'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type NewFieldFormProps = {
  newFieldKey: string
  setNewFieldKey: (value: string) => void
  newFieldScope: 'node' | 'edge'
  setNewFieldScope: (value: 'node' | 'edge') => void
  newFieldType: GraphFieldType
  setNewFieldType: (value: GraphFieldType) => void
  createNewField: () => void
  setNewFieldOpen: (open: boolean) => void
  graphDataPresent: boolean
  uiPanelKeyValueTextSizeClass: string
  iconSizeClass: string
  uiIconStrokeWidth: number
}

export function NewFieldForm({
  newFieldKey,
  setNewFieldKey,
  newFieldScope,
  setNewFieldScope,
  newFieldType,
  setNewFieldType,
  createNewField,
  setNewFieldOpen,
  graphDataPresent,
  uiPanelKeyValueTextSizeClass,
  iconSizeClass,
  uiIconStrokeWidth,
}: NewFieldFormProps) {
  const sectionClassName = `border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.bg} p-2`
  const labelClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const inputShellClassName = `mt-1 flex items-center gap-2 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} px-2 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-500 dark:focus-within:ring-blue-400`
  const textInputClassName = `h-8 w-full bg-transparent text-xs ${UI_THEME_TOKENS.input.text} outline-none placeholder:text-[color:var(--kg-text-tertiary)]`
  const actionButtonClassName = `App-toolbar__btn rounded border px-2 py-1 ${uiPanelKeyValueTextSizeClass}`

  return (
    <div className={sectionClassName}>
      <form
        onSubmit={e => {
          e.preventDefault()
          createNewField()
        }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className={labelClassName}>{UI_LABELS.name}</div>
            <div className={inputShellClassName}>
              <FieldKeyIcon
                className={`${iconSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}
                strokeWidth={uiIconStrokeWidth}
              />
              <input
                value={newFieldKey}
                onChange={e => setNewFieldKey(e.target.value)}
                placeholder={UI_COPY.fieldNamePlaceholder}
                className={textInputClassName}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className={labelClassName}>{UI_LABELS.scope}</div>
            <div className="mt-1">
              <select
                value={newFieldScope}
                onChange={e =>
                  setNewFieldScope(e.target.value === 'edge' ? 'edge' : 'node')
                }
                className={[MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME, 'h-8 w-full text-left'].join(' ')}
              >
                <option value="node">Node</option>
                <option value="edge">Edge</option>
              </select>
            </div>
          </div>
          <div className="flex-1">
            <div className={labelClassName}>{UI_LABELS.type}</div>
            <div className="mt-1">
              <select
                value={newFieldType}
                onChange={e => setNewFieldType(e.target.value as GraphFieldType)}
                className={[MAIN_PANEL_SETTINGS_DROPDOWN_SELECT_CLASSNAME, 'h-8 w-full text-left'].join(' ')}
              >
                {GRAPH_FIELD_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className={`${actionButtonClassName} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary}`}
            onClick={() => setNewFieldOpen(false)}
          >
            {UI_LABELS.cancel}
          </button>
          <button
            type="submit"
            className={`${actionButtonClassName} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.neutralSubtle} ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.secondary} disabled:opacity-50`}
            disabled={!graphDataPresent}
          >
            {UI_LABELS.create}
          </button>
        </div>
      </form>
    </div>
  )
}
