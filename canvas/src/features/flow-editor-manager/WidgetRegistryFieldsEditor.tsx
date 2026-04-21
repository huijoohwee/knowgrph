import React from 'react'

import { X } from 'lucide-react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'

import type { WidgetRegistryField } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function WidgetRegistryFieldsEditor({
  fields,
  onChange,
}: {
  fields: WidgetRegistryField[]
  onChange: (next: WidgetRegistryField[]) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <section aria-label="Fields" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Fields</h4>
        <button
          type="button"
          className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={() => onChange([...(fields || []), { fieldKey: '', fieldType: 'text', schemaPath: '' }])}
        >
          {UI_LABELS.add} field
        </button>
      </div>

      <div className="space-y-2">
        {(fields || []).map((f, idx) => (
          <div key={`${idx}:${f.fieldKey}`} className={cn('rounded border p-2', UI_THEME_TOKENS.panel.border)}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Field key</label>
                <input
                  value={f.fieldKey}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, fieldKey: e.target.value } : x)))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                />
              </div>
              <div>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Type</label>
                <input
                  value={f.fieldType}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, fieldType: e.target.value } : x)))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Schema path</label>
                <input
                  value={f.schemaPath || ''}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, schemaPath: e.target.value } : x)))}
                  className={cn('mt-1 w-full rounded border px-2 py-1', UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text, panelTypography.monospaceTextClass)}
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <label className={cn('inline-flex items-center gap-2', panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))}
                />
                Required
              </label>
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => onChange(fields.filter((_, i) => i !== idx))}
                aria-label="Remove field"
              >
                <X className={iconSizeClass} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        {(fields || []).length === 0 && (
          <div className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.tertiary)}>No fields.</div>
        )}
      </div>
    </section>
  )
}

