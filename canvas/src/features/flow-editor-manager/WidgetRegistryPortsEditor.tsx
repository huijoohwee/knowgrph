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

import type { WidgetRegistryPort } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function WidgetRegistryPortsEditor({
  ports,
  onChange,
}: {
  ports: WidgetRegistryPort[]
  onChange: (next: WidgetRegistryPort[]) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const fieldClassName = cn(UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME, UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)

  return (
    <section aria-label="Ports" className="space-y-2">
      <section className={UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_HEADER_CLASSNAME}>
        <h4 className={cn('text-xs font-semibold uppercase tracking-wider', UI_THEME_TOKENS.text.secondary)}>Ports</h4>
        <button
          type="button"
          className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
          onClick={() => onChange([...(ports || []), { direction: 'input', portKey: '', schemaPath: '' }])}
        >
          {UI_LABELS.add} port
        </button>
      </section>

      <section className="space-y-2">
        {(ports || []).map((p, idx) => (
          <section key={`${idx}:${p.direction}:${p.portKey}`} className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_CLASSNAME, UI_THEME_TOKENS.panel.border)}>
            <section className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_GRID_CLASSNAME, 'sm:grid-cols-4')}>
              <section>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Direction</label>
                <select
                  value={p.direction}
                  onChange={e => onChange(ports.map((x, i) => (i === idx ? { ...x, direction: e.target.value === 'output' ? 'output' : 'input' } : x)))}
                  className={fieldClassName}
                >
                  <option value="input">input</option>
                  <option value="output">output</option>
                </select>
              </section>
              <section>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Port key</label>
                <input
                  value={p.portKey}
                  onChange={e => onChange(ports.map((x, i) => (i === idx ? { ...x, portKey: e.target.value } : x)))}
                  className={cn(fieldClassName, panelTypography.monospaceTextClass)}
                />
              </section>
              <section className="sm:col-span-2">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Schema path (optional)</label>
                <input
                  value={p.schemaPath || ''}
                  onChange={e => onChange(ports.map((x, i) => (i === idx ? { ...x, schemaPath: e.target.value } : x)))}
                  className={cn(fieldClassName, panelTypography.monospaceTextClass)}
                />
              </section>
            </section>
            <section className="mt-2 flex items-center justify-end">
              <button
                type="button"
                className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                onClick={() => onChange(ports.filter((_, i) => i !== idx))}
                aria-label="Remove port"
              >
                <X className={iconSizeClass} aria-hidden="true" />
              </button>
            </section>
          </section>
        ))}

        {(ports || []).length === 0 && (
          <section className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.tertiary)}>No ports.</section>
        )}
      </section>
    </section>
  )
}
