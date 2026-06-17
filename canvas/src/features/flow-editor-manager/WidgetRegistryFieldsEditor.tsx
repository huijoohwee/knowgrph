import React from 'react'

import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { cn } from '@/lib/utils'
import { PanelCheckbox, PanelTextInput } from '@/lib/ui/panelFormControls'
import {
  UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_INLINE_CONTROL_CLASSNAME,
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

import type { WidgetRegistryField } from '@/features/flow-editor-manager/widgetRegistryTypes'

export default function WidgetRegistryFieldsEditor({
  fields,
  onChange,
}: {
  fields: WidgetRegistryField[]
  onChange: (next: WidgetRegistryField[]) => void
}) {
  const panelTypography = usePanelTypography()
  const fieldClassName = cn(UI_RESPONSIVE_FLOW_MANAGER_FORM_FIELD_CLASSNAME, UI_THEME_TOKENS.input.bg, UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.text)
  const selectionControlClassName = cn('rounded', UI_THEME_TOKENS.input.border, UI_THEME_TOKENS.input.selectionControl)

  return (
    <section aria-label="Fields" className="space-y-2">
      <FlowManagerRegistrySectionHeader
        title="Fields"
        actionLabel={`${UI_LABELS.add} field`}
        className={UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_HEADER_CLASSNAME}
        onAction={() => onChange([...(fields || []), { fieldKey: '', fieldType: 'text', schemaPath: '' }])}
      />

      <section className="space-y-2">
        {(fields || []).map((f, idx) => (
          <FlowManagerRegistryItemCard
            key={`${idx}:${f.fieldKey}`}
            className={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_CLASSNAME, UI_THEME_TOKENS.panel.border)}
            gridClassName={cn(UI_RESPONSIVE_FLOW_MANAGER_REGISTRY_ITEM_GRID_CLASSNAME, 'sm:grid-cols-4')}
            footer={
              <section className="mt-2 flex items-center justify-between">
                <label className={cn(UI_RESPONSIVE_FLOW_MANAGER_INLINE_CONTROL_CLASSNAME, panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>
                  <PanelCheckbox
                    className={selectionControlClassName}
                    checked={!!f.required}
                    onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))}
                  />
                  Required
                </label>
                <FlowManagerRegistryRemoveButton ariaLabel="Remove field" onClick={() => onChange(fields.filter((_, i) => i !== idx))} />
              </section>
            }
          >
              <section>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Field key</label>
                <PanelTextInput
                  value={f.fieldKey}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, fieldKey: e.target.value } : x)))}
                  className={fieldClassName}
                />
              </section>
              <section>
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Type</label>
                <PanelTextInput
                  value={f.fieldType}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, fieldType: e.target.value } : x)))}
                  className={fieldClassName}
                />
              </section>
              <section className="sm:col-span-2">
                <label className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.secondary)}>Schema path</label>
                <PanelTextInput
                  value={f.schemaPath || ''}
                  onChange={e => onChange(fields.map((x, i) => (i === idx ? { ...x, schemaPath: e.target.value } : x)))}
                  className={cn(fieldClassName, panelTypography.monospaceTextClass)}
                />
              </section>
          </FlowManagerRegistryItemCard>
        ))}

        {(fields || []).length === 0 && (
          <FlowManagerRegistryEmptyState className={cn(panelTypography.microLabelClass, UI_THEME_TOKENS.text.tertiary)}>
            No fields.
          </FlowManagerRegistryEmptyState>
        )}
      </section>
    </section>
  )
}
