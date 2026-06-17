import React from 'react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'
import { PanelTextInput } from '@/lib/ui/panelFormControls'
import {
  UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_GRID_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_HEADER_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import {
  FlowManagerRegistryEmptyState,
  FlowManagerRegistryItemCard,
  FlowManagerRegistryRemoveButton,
  FlowManagerRegistrySectionHeader,
} from '@/features/flow-editor-manager/FlowManagerRegistryEditorPrimitives'

import type { WidgetRegistrySchemaMapping } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function WidgetRegistrySchemaMappingsEditor({
  mappings,
  onChange,
}: {
  mappings: WidgetRegistrySchemaMapping[]
  onChange: (next: WidgetRegistrySchemaMapping[]) => void
}) {
  const panelTypography = usePanelTypography()
  const fieldClassName = cn(UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME, UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text, panelTypography.monospaceTextClass)

  return (
    <section aria-label="Schema mappings" className="space-y-2">
      <FlowManagerRegistrySectionHeader
        title="Schema mappings"
        actionLabel={`${UI_LABELS.add} mapping`}
        className={UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_HEADER_CLASSNAME}
        onAction={() => onChange([...(mappings || []), { fromPath: '', toPath: '' }])}
      />

      <section className="space-y-2">
        {(mappings || []).map((m, idx) => (
          <FlowManagerRegistryItemCard
            key={`${idx}:${m.fromPath}:${m.toPath}`}
            className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_CLASSNAME, UI_THEME_TOKENS.panel.border)}
            gridClassName={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_GRID_CLASSNAME, 'sm:grid-cols-2')}
            footer={
              <section className="mt-2 flex items-center justify-end">
                <FlowManagerRegistryRemoveButton ariaLabel="Remove mapping" onClick={() => onChange(mappings.filter((_, i) => i !== idx))} />
              </section>
            }
          >
              <section>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>From</label>
                <PanelTextInput
                  value={m.fromPath}
                  onChange={e => onChange(mappings.map((x, i) => (i === idx ? { ...x, fromPath: e.target.value } : x)))}
                  className={fieldClassName}
                />
              </section>
              <section>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>To</label>
                <PanelTextInput
                  value={m.toPath}
                  onChange={e => onChange(mappings.map((x, i) => (i === idx ? { ...x, toPath: e.target.value } : x)))}
                  className={fieldClassName}
                />
              </section>
          </FlowManagerRegistryItemCard>
        ))}
        {(mappings || []).length === 0 && (
          <FlowManagerRegistryEmptyState className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.tertiary)}>
            No schema mappings.
          </FlowManagerRegistryEmptyState>
        )}
      </section>
    </section>
  )
}
