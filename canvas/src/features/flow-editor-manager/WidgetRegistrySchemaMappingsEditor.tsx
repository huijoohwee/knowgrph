import React from 'react'

import { X } from 'lucide-react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_GRID_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_HEADER_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

import type { WidgetRegistrySchemaMapping } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function WidgetRegistrySchemaMappingsEditor({
  mappings,
  onChange,
}: {
  mappings: WidgetRegistrySchemaMapping[]
  onChange: (next: WidgetRegistrySchemaMapping[]) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const fieldClassName = cn(UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME, UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text, panelTypography.monospaceTextClass)

  return (
    <section aria-label="Schema mappings" className="space-y-2">
      <div className={UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_HEADER_CLASSNAME}>
        <h4 className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Schema mappings</h4>
        <button
          type="button"
          className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={() => onChange([...(mappings || []), { fromPath: '', toPath: '' }])}
        >
          {UI_LABELS.add} mapping
        </button>
      </div>

      <div className="space-y-2">
        {(mappings || []).map((m, idx) => (
          <div key={`${idx}:${m.fromPath}:${m.toPath}`} className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_CLASSNAME, UI_THEME_TOKENS.panel.border)}>
            <div className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_GRID_CLASSNAME, 'sm:grid-cols-2')}>
              <div>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>From</label>
                <input
                  value={m.fromPath}
                  onChange={e => onChange(mappings.map((x, i) => (i === idx ? { ...x, fromPath: e.target.value } : x)))}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>To</label>
                <input
                  value={m.toPath}
                  onChange={e => onChange(mappings.map((x, i) => (i === idx ? { ...x, toPath: e.target.value } : x)))}
                  className={fieldClassName}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => onChange(mappings.filter((_, i) => i !== idx))}
                aria-label="Remove mapping"
              >
                <X className={iconSizeClass} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        {(mappings || []).length === 0 && (
          <div className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.tertiary)}>No schema mappings.</div>
        )}
      </div>
    </section>
  )
}
