import React from 'react'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { GraphField, GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'

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

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-3">
      <div className={`${uiPanelKeyValueTextSizeClass} font-semibold text-gray-800`}>
        Schema
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            {ownerLabel}
          </label>
          {shouldShowOwnersWithField ? (
            <div className={`mt-1 ${uiPanelKeyValueTextSizeClass} text-gray-500`}>
              Detected on {ownersWithField!.length}: {ownersWithField!.join(', ')}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-2 space-y-2">
        <div className="min-w-0">
          <label className={`block ${uiPanelKeyValueTextSizeClass} text-gray-700`}>
            Constraints
          </label>
          <div className="mt-1 flex items-center gap-4">
            <label className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} text-gray-700`}>
              <input
                type="checkbox"
                checked={!!spec?.required}
                onChange={e => upsertProperty({ required: e.target.checked })}
                disabled={!ownerKey}
              />
              <span>required</span>
            </label>
            <label className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass} text-gray-700`}>
              <input
                type="checkbox"
                checked={!!spec?.uniqueness}
                onChange={e => upsertProperty({ uniqueness: e.target.checked })}
                disabled={!ownerKey}
              />
              <span>unique</span>
            </label>
            <span className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
              {spec ? 'In schema' : 'Not in schema'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
