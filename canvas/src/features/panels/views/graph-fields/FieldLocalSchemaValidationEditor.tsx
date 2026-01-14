import React from 'react'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { UI_COPY } from '@/lib/config.copy'
import { MonacoTextEditor } from '@/features/monaco/MonacoTextEditor'

export type ValidationWarning =
  | { kind: 'requiredMissingSchema'; keys: string[] }
  | {
      kind: 'typeMismatch'
      items: {
        key: string
        schemaType: PropertySpec['type'] | undefined
        validationType: PropertySpec['type']
      }[]
    }

type FieldLocalSchemaValidationEditorProps = {
  schema: GraphSchema | null
  localSchemaScope: 'node' | 'edge'
  localSchemaOwnerKey: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMonospaceTextClass: string
  setSelectedGlobalView: React.Dispatch<React.SetStateAction<GraphFieldsSelectedView>>
  validationPropertyNames: string[]
  localValidationWarnings: ValidationWarning[]
  localValidationRequiredSet: Set<string>
  setLocalValidationRequiredSet: React.Dispatch<React.SetStateAction<Set<string>>>
  localValidationTypesMap: Record<string, PropertySpec['type']>
  setLocalValidationTypesMap: React.Dispatch<
    React.SetStateAction<Record<string, PropertySpec['type']>>
  >
  localValidationBulkType: PropertySpec['type']
  setLocalValidationBulkType: React.Dispatch<React.SetStateAction<PropertySpec['type']>>
  localValidationSeverity: 'error' | 'warn'
  setLocalValidationSeverity: React.Dispatch<React.SetStateAction<'error' | 'warn'>>
  localValidationOtherText: string
  setLocalValidationOtherText: React.Dispatch<React.SetStateAction<string>>
  getValidationControlId: (kind: 'required' | 'type', key: string) => string
  focusValidationControl: (kind: 'required' | 'type', key: string) => void
}

export default function FieldLocalSchemaValidationEditor({
  schema,
  localSchemaScope,
  localSchemaOwnerKey,
  uiPanelKeyValueTextSizeClass,
  uiPanelMonospaceTextClass,
  setSelectedGlobalView,
  validationPropertyNames,
  localValidationWarnings,
  localValidationRequiredSet,
  setLocalValidationRequiredSet,
  localValidationTypesMap,
  setLocalValidationTypesMap,
  localValidationBulkType,
  setLocalValidationBulkType,
  localValidationSeverity,
  setLocalValidationSeverity,
  localValidationOtherText,
  setLocalValidationOtherText,
  getValidationControlId,
  focusValidationControl,
}: FieldLocalSchemaValidationEditorProps) {
  return (
    <div className="space-y-3">
      {localValidationWarnings.length > 0 ? (
        <div className={`${uiPanelKeyValueTextSizeClass} text-amber-700 space-y-1`}>
          {localValidationWarnings.map((warning, index) => {
            if (warning.kind === 'requiredMissingSchema') {
              const text = `Required properties with no schema entry: ${warning.keys.join(', ')}`
              return (
                <button
                  key={`warn-${index}`}
                  type="button"
                  className="underline decoration-dotted underline-offset-2"
                  onClick={() => {
                    setSelectedGlobalView(prev => {
                      if (!prev || prev.kind !== 'localSchema') return prev
                      return { ...prev, facet: 'properties' }
                    })
                  }}
                >
                  {text}
                </button>
              )
            }
            return (
              <div key={`warn-${index}`} className="space-y-0.5">
                {warning.items.map(item => {
                  const labelParts = []
                  labelParts.push(item.key)
                  labelParts.push(': ')
                  labelParts.push(
                    item.schemaType
                      ? `schema ${item.schemaType} vs validation ${item.validationType}`
                      : `validation ${item.validationType} (schema type unknown)`,
                  )
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="block text-left underline decoration-dotted underline-offset-2"
                      onClick={() => focusValidationControl('type', item.key)}
                    >
                      {labelParts.join('')}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : null}

      <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
        Validation uses this owner&apos;s property schema for available fields and base
        types. Adjust properties first, then refine required fields, types, and
        additional options here.
      </div>

      <div className={`flex items-center gap-2 ${uiPanelKeyValueTextSizeClass}`}>
        <span className="text-gray-700">{UI_COPY.validationSeverityLabel}</span>
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLocalValidationSeverity('error')}
            className={[
              'App-toolbar__btn text-xs border border-gray-300',
              localValidationSeverity === 'error'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700',
            ].join(' ')}
          >
            {UI_COPY.validationSeverityErrorLabel}
          </button>
          <button
            type="button"
            onClick={() => setLocalValidationSeverity('warn')}
            className={[
              'App-toolbar__btn text-xs border border-gray-300',
              localValidationSeverity === 'warn'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700',
            ].join(' ')}
          >
            {UI_COPY.validationSeverityWarnLabel}
          </button>
        </div>
      </div>

      <div>
        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
          {UI_COPY.validationRequiredFieldsTitle}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {validationPropertyNames.length === 0 ? (
            <div className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>
              No properties for this owner.
            </div>
          ) : (
            validationPropertyNames.map(p => (
              <label
                key={p}
                className={`${uiPanelKeyValueTextSizeClass} flex items-center gap-1`}
              >
                <input
                  type="checkbox"
                  id={getValidationControlId('required', p)}
                  checked={localValidationRequiredSet.has(p)}
                  onChange={e => {
                    const next = new Set(localValidationRequiredSet)
                    if (e.target.checked) next.add(p)
                    else next.delete(p)
                    setLocalValidationRequiredSet(next)
                  }}
                />
                <span className="truncate">{p}</span>
              </label>
            ))
          )}
        </div>
        {validationPropertyNames.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-gray-300"
              onClick={() =>
                setLocalValidationRequiredSet(new Set<string>(validationPropertyNames))
              }
            >
              {UI_COPY.validationRequireAllButtonLabel}
            </button>
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-gray-300"
              onClick={() => {
                const nums = validationPropertyNames.filter(
                  p => (localValidationTypesMap[p] ?? 'string') === 'number',
                )
                setLocalValidationRequiredSet(new Set<string>(nums))
              }}
            >
              {UI_COPY.validationRequireNumericButtonLabel}
            </button>
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-gray-300"
              onClick={() => setLocalValidationRequiredSet(new Set())}
            >
              {UI_COPY.validationClearRequiredButtonLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div>
        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
          {UI_COPY.validationPropertyTypesTitle}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {validationPropertyNames.map(p => (
            <div
              key={p}
              className={`${uiPanelKeyValueTextSizeClass} flex items-center gap-1`}
            >
              <span className="w-24 truncate text-gray-700">{p}</span>
              <select
                id={getValidationControlId('type', p)}
                value={localValidationTypesMap[p] ?? 'string'}
                onChange={e => {
                  const v = e.target.value as PropertySpec['type']
                  setLocalValidationTypesMap({
                    ...localValidationTypesMap,
                    [p]: v,
                  })
                }}
                className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="array">array</option>
                <option value="object">object</option>
              </select>
            </div>
          ))}
        </div>
        {validationPropertyNames.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <select
              value={localValidationBulkType}
              onChange={e =>
                setLocalValidationBulkType(e.target.value as PropertySpec['type'])
              }
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="array">array</option>
              <option value="object">object</option>
            </select>
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-gray-300"
              onClick={() => {
                const next: Record<string, PropertySpec['type']> = {}
                validationPropertyNames.forEach(p => {
                  next[p] = localValidationBulkType
                })
                setLocalValidationTypesMap(next)
              }}
            >
              {UI_COPY.validationSetAllTypesButtonLabel}
            </button>
            <button
              type="button"
              className="App-toolbar__btn text-xs border border-gray-300"
              title="Infer types from the current property schema for this owner"
              onClick={() => {
                const inferred: Record<string, PropertySpec['type']> = {}
                validationPropertyNames.forEach(p => {
                  const specType =
                    localSchemaScope === 'node'
                      ? schema?.propertySchemas?.node?.[localSchemaOwnerKey]?.[p]?.type
                      : schema?.propertySchemas?.edge?.[localSchemaOwnerKey]?.[p]?.type
                  inferred[p] = (specType as PropertySpec['type'] | undefined) ?? 'string'
                })
                setLocalValidationTypesMap(inferred)
              }}
            >
              {UI_COPY.validationInferTypesButtonLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div>
        <div className={`${uiPanelKeyValueTextSizeClass} text-gray-700 mb-1`}>
          {UI_COPY.validationAdditionalOptionsJsonTitle}
        </div>
        <div className="w-full rounded border border-gray-300 overflow-hidden bg-white h-[116px]">
          <MonacoTextEditor
            value={localValidationOtherText}
            onChange={setLocalValidationOtherText}
            language="json"
            uri={`inmemory://graph-fields/validation/other/${encodeURIComponent(localSchemaScope)}/${encodeURIComponent(localSchemaOwnerKey)}`}
            themeMode="light"
            wordWrap={false}
            className={`w-full h-full ${uiPanelMonospaceTextClass}`}
          />
        </div>
      </div>
    </div>
  )
}
