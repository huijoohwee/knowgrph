import React from 'react'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { GraphField, GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { GraphFieldsCompactCheckbox } from '@/features/panels/views/graph-fields/GraphFieldsPanelControls'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { GRAPH_FIELDS_FIELD_GRID_CLASS_NAME } from '@/features/panels/views/graph-fields/graphFieldResponsiveClasses'

function inferPropertyTypeFromFieldType(
  fieldType: GraphFieldSettingsResolved['fieldType'],
): PropertySpec['type'] {
  if (fieldType === 'Checkbox') return 'boolean'
  if (fieldType === 'Number') return 'number'
  if (fieldType === 'Decimal') return 'number'
  if (fieldType === 'Currency') return 'number'
  if (fieldType === 'JSON') return 'object'
  if (fieldType === 'Multi-select') return 'array'
  return 'string'
}

type FieldSchemaSectionProps = {
  schema: GraphSchema
  selectedField: GraphField
  selectedSettings: GraphFieldSettingsResolved
  ownersWithField?: string[]
  ownerKey: string
  uiPanelKeyValueTextSizeClass: string
}

export default function FieldSchemaSection({
  schema,
  selectedField,
  selectedSettings,
  ownersWithField,
  ownerKey,
  uiPanelKeyValueTextSizeClass,
}: FieldSchemaSectionProps) {
  const ownerLabel = selectedField.scope === 'node' ? 'Node type' : 'Edge label'

  const spec = React.useMemo<PropertySpec | null>(() => {
    const key = String(ownerKey || '').trim()
    if (!key) return null
    if (selectedField.scope === 'node') {
      return (schema.propertySchemas?.node?.[key]?.[selectedField.key] ?? null) as PropertySpec | null
    }
    return (schema.propertySchemas?.edge?.[key]?.[selectedField.key] ?? null) as PropertySpec | null
  }, [ownerKey, schema, selectedField.scope, selectedField.key])

  const effectiveType = spec?.type ?? inferPropertyTypeFromFieldType(selectedSettings.fieldType)

  const upsertProperty = React.useCallback(
    (patch: Partial<PropertySpec>) => {
      const key = String(ownerKey || '').trim()
      if (!key) return
      const base: PropertySpec = {
        type: effectiveType,
        required: !!spec?.required,
        uniqueness: !!spec?.uniqueness,
      }
      const next = { ...base, ...patch, type: patch.type ?? base.type } as PropertySpec
      if (selectedField.scope === 'node') {
        ;(useGraphStore.getState().upsertNodeProperty)(key, selectedField.key, next)
      } else {
        ;(useGraphStore.getState().upsertEdgeProperty)(key, selectedField.key, next)
      }
    },
    [effectiveType, ownerKey, selectedField.key, selectedField.scope, spec],
  )

  const shouldShowOwnersWithField = (ownersWithField?.length ?? 0) > 0
  const panelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3 space-y-3`
  const headingClassName = `${uiPanelKeyValueTextSizeClass} font-semibold ${UI_THEME_TOKENS.text.primary}`
  const labelClassName = `block ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const helperTextClassName = `mt-1 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`
  const constraintsPanelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.button.neutralSubtle} p-2 space-y-2`
  const constraintLabelClassName = `flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.secondary}`
  const constraintStatusClassName = `${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`

  return (
    <section className={panelClassName}>
      <section className={headingClassName}>
        Schema
      </section>

      <section className={GRAPH_FIELDS_FIELD_GRID_CLASS_NAME}>
        <section className="min-w-0">
          <label className={labelClassName}>
            {ownerLabel}
          </label>
          {shouldShowOwnersWithField ? (
            <section className={helperTextClassName}>
              Detected on {ownersWithField!.length}: {ownersWithField!.join(', ')}
            </section>
          ) : null}
        </section>
      </section>

      <section className={constraintsPanelClassName}>
        <section className="min-w-0">
          <label className={labelClassName}>
            Constraints
          </label>
          <section className="mt-1 flex items-center gap-4">
            <label className={constraintLabelClassName}>
              <GraphFieldsCompactCheckbox
                checked={!!spec?.required}
                onChange={e => upsertProperty({ required: e.target.checked })}
                disabled={!ownerKey}
              />
              <span>required</span>
            </label>
            <label className={constraintLabelClassName}>
              <GraphFieldsCompactCheckbox
                checked={!!spec?.uniqueness}
                onChange={e => upsertProperty({ uniqueness: e.target.checked })}
                disabled={!ownerKey}
              />
              <span>unique</span>
            </label>
            <span className={constraintStatusClassName}>
              {spec ? 'In schema' : 'Not in schema'}
            </span>
          </section>
        </section>
      </section>
    </section>
  )
}
