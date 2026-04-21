import { Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'

import type { FlowEditorMappingRow } from '@/features/flow-editor-manager/mappingRows'
import FlowMappingRowsTable from '@/features/flow-editor-manager/FlowMappingRowsTable'

export type FlowEditorMappingEditorDraft = {
  id: string
  isEnabled: boolean
  nodeTypeId: string
  widgetTypeId: string
  formId: string
}

export function FlowEditorMappingSettingsPanel(props: {
  mode: 'create' | 'edit' | 'none'
  draft: FlowEditorMappingEditorDraft
  rows: FlowEditorMappingRow[]
  error: string | null
  uiIconScale: 'compact' | 'default' | undefined
  uiIconStrokeWidth: number
  onClose: () => void
  onChangeDraft: (patch: Partial<FlowEditorMappingEditorDraft>) => void
  onAddRow: () => void
  onReset: () => void
  onSave: () => void
  onDelete: () => void
  onChangeRow: (id: string, patch: Partial<FlowEditorMappingRow>) => void
  onDeleteRow: (id: string) => void
  onReorderRow: (fromId: string, toId: string) => void
}) {
  const {
    mode,
    draft,
    rows,
    error,
    uiIconScale,
    uiIconStrokeWidth,
    onClose,
    onChangeDraft,
    onAddRow,
    onReset,
    onSave,
    onDelete,
    onChangeRow,
    onDeleteRow,
    onReorderRow,
  } = props

  const panelTypography = usePanelTypography()
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <section className="h-full min-h-0 flex flex-col overflow-hidden" aria-label="Edit mapping">
      <section className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" aria-label="Mapping editor">
        {mode === 'none' ? (
          <section className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
            Select a mapping to edit.
          </section>
        ) : (
          <section className="space-y-3" aria-label="Mapping editor form">
            {error ? (
              <section
                className={cn('rounded border px-2 py-2', 'border-red-300/50 bg-red-500/10', panelTypography.microLabelClass)}
                aria-label="Error"
                role="status"
              >
                <section className={cn(UI_THEME_TOKENS.text.primary)}>{error}</section>
              </section>
            ) : null}

            <section aria-label="Identity" className="space-y-2">
              <section className="flex items-center justify-between gap-2" aria-label="Identity header">
                <section className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Identity</section>
                <label className={cn('inline-flex items-center gap-2', panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                  <input type="checkbox" checked={!!draft.isEnabled} onChange={e => onChangeDraft({ isEnabled: e.target.checked })} />
                  Enabled
                </label>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="Identity inputs">
                <section className="sm:col-span-1">
                  <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-editor-manager-nodeType">
                    Node Type
                  </label>
                  <input
                    id="flow-editor-manager-nodeType"
                    value={draft.nodeTypeId}
                    onChange={e => onChangeDraft({ nodeTypeId: e.target.value })}
                    className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                  />
                </section>
                <section className="sm:col-span-1">
                  <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-editor-manager-editorType">
                    Widget Type
                  </label>
                  <input
                    id="flow-editor-manager-editorType"
                    value={draft.widgetTypeId}
                    onChange={e => onChangeDraft({ widgetTypeId: e.target.value })}
                    className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                  />
                </section>
                <section className="sm:col-span-1">
                  <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)} htmlFor="flow-editor-manager-formId">
                    Form ID
                  </label>
                  <input
                    id="flow-editor-manager-formId"
                    value={draft.formId}
                    onChange={e => onChangeDraft({ formId: e.target.value })}
                    className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                  />
                </section>
              </section>
            </section>

            <header className="flex items-center justify-between gap-2" aria-label="Rows header">
              <section className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Rows</section>
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={onAddRow}
                aria-label="Add row"
                title="Add row"
              >
                <Plus className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </button>
            </header>
            <section aria-label="Rows table">
              <FlowMappingRowsTable rows={rows} onChange={onChangeRow} onDelete={onDeleteRow} onReorder={onReorderRow} />
            </section>
          </section>
        )}
      </section>

      {mode !== 'none' ? (
        <section
          className={cn(
            'sticky bottom-0 py-2 border-t flex items-center justify-between gap-2',
            UI_THEME_TOKENS.panel.border,
            UI_THEME_TOKENS.panel.bg,
          )}
          aria-label="Editor footer"
        >
          <section className="flex items-center gap-2" aria-label="Left actions">
            <button
              type="button"
              className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
              onClick={onClose}
              aria-label={UI_LABELS.close}
              title={UI_LABELS.close}
            >
              <X className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
            </button>
            {mode === 'edit' ? (
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg, 'text-red-200')}
                onClick={onDelete}
                aria-label={UI_LABELS.delete}
                title={UI_LABELS.delete}
              >
                <Trash2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </button>
            ) : null}
          </section>

          <menu className="m-0 p-0 list-none flex items-center gap-1" aria-label="Primary actions">
            <li>
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={onReset}
                aria-label={UI_LABELS.reset}
                title={UI_LABELS.reset}
              >
                <RotateCcw className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.activeBg, UI_THEME_TOKENS.button.activeText)}
                onClick={onSave}
                aria-label={UI_LABELS.save}
                title={UI_LABELS.save}
              >
                <Save className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
              </button>
            </li>
          </menu>
        </section>
      ) : null}
    </section>
  )
}
