import React from 'react'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import { UI_LABELS } from '@/lib/config.copy'
import {
  KeyTypeValueRow,
  RightAlignedValueCell,
} from '@/features/panels/ui/KeyTypeValueRow'

type FieldLocalSchemaRow = { id: string; key: string; value: string }

type FieldLocalSchemaRowsEditorProps = {
  localSchemaFacet: 'properties' | 'localRules'
  schema: GraphSchema | null
  hasLocalSchemaOwner: boolean
  localSchemaScope: 'node' | 'edge'
  localSchemaOwnerKey: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelMonospaceTextClass: string
  localSchemaRows: FieldLocalSchemaRow[]
  setLocalSchemaRows: React.Dispatch<React.SetStateAction<FieldLocalSchemaRow[]>>
  suggestedPropertyKeys: string[]
  suggestedPropertyTypeByKey: Record<string, PropertySpec['type']>
  suggestedPropertySampleByKey: Record<string, JSONValue | null>
  enumCandidatesByKey: Record<string, string[]>
}

export default function FieldLocalSchemaRowsEditor({
  localSchemaFacet,
  schema,
  hasLocalSchemaOwner,
  localSchemaScope,
  localSchemaOwnerKey,
  uiPanelKeyValueTextSizeClass,
  uiPanelMonospaceTextClass,
  localSchemaRows,
  setLocalSchemaRows,
  suggestedPropertyKeys,
  suggestedPropertyTypeByKey,
  suggestedPropertySampleByKey,
  enumCandidatesByKey,
}: FieldLocalSchemaRowsEditorProps) {
  return (
    <section className="rounded border border-gray-200 bg-white" aria-label="Schema Rows Editor">
      <header className="px-2 border-b border-gray-200">
        <KeyTypeValueRow
          keyNode={
            <span className="font-semibold text-gray-600">
              {localSchemaFacet === 'localRules' ? 'Rule' : 'Key'}
            </span>
          }
          valueNode={
            <span className="font-semibold text-gray-600">
              {localSchemaFacet === 'localRules' ? 'Rule JSON' : 'Value JSON'}
            </span>
          }
          density="compact"
          layout="keyValue"
        />
      </header>
      <div className="max-h-72 overflow-auto">
        {localSchemaRows.map((row, index) => {
          const trimmedKey = String(row.key || '').trim()
          const sampleValue =
            localSchemaFacet === 'properties' && trimmedKey
              ? suggestedPropertySampleByKey[trimmedKey] ?? null
              : null
          const specForKey =
            localSchemaFacet === 'properties' && schema && hasLocalSchemaOwner && trimmedKey
              ? localSchemaScope === 'node'
                ? schema.propertySchemas?.node?.[localSchemaOwnerKey]?.[trimmedKey]
                : schema.propertySchemas?.edge?.[localSchemaOwnerKey]?.[trimmedKey]
              : undefined
          const enumFromSchema =
            !!specForKey && Array.isArray(specForKey.enum) && specForKey.enum.length > 0
              ? (specForKey.enum as string[])
              : null
          const enumFromData =
            localSchemaFacet === 'properties' && trimmedKey
              ? enumCandidatesByKey[trimmedKey] ?? null
              : null
          const hasEnumSuggestions =
            !!enumFromSchema ||
            (!!enumFromData && Array.isArray(enumFromData) && enumFromData.length > 0)
          const hasDefaultSuggestion = !!specForKey && typeof specForKey.default !== 'undefined'
          const hasSampleSuggestion = sampleValue != null
          const hasAnySuggestions =
            localSchemaFacet === 'properties' &&
            (hasEnumSuggestions || hasDefaultSuggestion || hasSampleSuggestion)

          const enumValuesToShow: string[] = (() => {
            if (enumFromSchema && enumFromSchema.length > 0) {
              return enumFromSchema.slice(0, 3)
            }
            if (enumFromData && enumFromData.length > 0) {
              return enumFromData.slice(0, 3)
            }
            return []
          })()

          const applySuggestedSpec = (
            source: 'schema' | 'enum' | 'default' | 'sample',
            enumValue?: string,
          ) => {
            if (localSchemaFacet !== 'properties') return
            const next = localSchemaRows.slice()
            let nextValue = row.value
            let spec: Record<string, JSONValue> | null = null
            if (source === 'schema' && specForKey) {
              spec = specForKey as unknown as Record<string, JSONValue>
            } else if (source === 'enum') {
              const t = specForKey?.type ?? 'string'
              const value = enumValue ?? ''
              const enumValues =
                enumFromSchema && enumFromSchema.length > 0
                  ? enumFromSchema
                  : enumFromData && enumFromData.length > 0
                    ? enumFromData
                    : [String(value)]
              spec = {
                type: t,
                enum: enumValues.map(v => String(v)),
              }
            } else if (source === 'default' && specForKey) {
              const t = specForKey.type ?? 'string'
              spec = {
                type: t,
              }
              if (typeof specForKey.default !== 'undefined') {
                spec.default = specForKey.default as JSONValue
              }
            } else if (source === 'sample' && sampleValue != null) {
              let inferredType: PropertySpec['type'] = 'string'
              if (typeof sampleValue === 'number') inferredType = 'number'
              else if (typeof sampleValue === 'boolean') inferredType = 'boolean'
              else if (Array.isArray(sampleValue)) inferredType = 'array'
              else if (typeof sampleValue === 'object') inferredType = 'object'
              spec = {
                type: inferredType,
                default: sampleValue,
              }
            }
            if (spec) {
              try {
                nextValue = JSON.stringify(spec)
              } catch {
                nextValue = row.value
              }
            }
            next[index] = { ...row, value: nextValue }
            setLocalSchemaRows(next)
          }

          return (
            <KeyTypeValueRow
              key={row.id}
              layout="keyValue"
              align="center"
              className="px-2"
              keyNode={
                <div className="flex items-center gap-1 min-w-0">
                  {localSchemaFacet === 'localRules' ? (
                    <span className="text-gray-700">Rule {index + 1}</span>
                  ) : (
                    <input
                      type="text"
                      value={row.key}
                      onChange={e => {
                        const raw = e.target.value
                        const next = localSchemaRows.slice()
                        if (
                          localSchemaFacet === 'properties' &&
                          !String(row.value || '').trim()
                        ) {
                          const k = String(raw || '').trim()
                          if (k) {
                            const schemaSpec =
                              schema && hasLocalSchemaOwner
                                ? localSchemaScope === 'node'
                                  ? schema.propertySchemas?.node?.[localSchemaOwnerKey]?.[
                                      k
                                    ]
                                  : schema.propertySchemas?.edge?.[localSchemaOwnerKey]?.[
                                      k
                                    ]
                                : undefined
                            let spec: Record<string, JSONValue> | null = null
                            if (schemaSpec) {
                              spec = schemaSpec as unknown as Record<string, JSONValue>
                            } else {
                              const t = suggestedPropertyTypeByKey[k]
                              const sample = suggestedPropertySampleByKey[k]
                              const enumFromKey = enumCandidatesByKey[k]
                              if (t) {
                                let inferredType: PropertySpec['type'] = t
                                if (
                                  inferredType !== 'string' &&
                                  inferredType !== 'number' &&
                                  inferredType !== 'boolean' &&
                                  inferredType !== 'array' &&
                                  inferredType !== 'object'
                                ) {
                                  inferredType = 'string'
                                }
                                spec = {
                                  type: inferredType,
                                } as unknown as Record<string, JSONValue>
                                if (enumFromKey && enumFromKey.length > 0) {
                                  ;(spec as Record<string, JSONValue>).enum =
                                    enumFromKey.map(v => String(v))
                                } else if (typeof sample !== 'undefined') {
                                  ;(spec as Record<string, JSONValue>).default =
                                    sample as JSONValue
                                }
                              }
                            }
                            if (spec) {
                              try {
                                next[index] = {
                                  ...row,
                                  key: raw,
                                  value: JSON.stringify(spec),
                                }
                                setLocalSchemaRows(next)
                                return
                              } catch {
                                next[index] = { ...row, key: raw }
                                setLocalSchemaRows(next)
                                return
                              }
                            }
                          }
                        }
                        next[index] = { ...row, key: raw }
                        setLocalSchemaRows(next)
                      }}
                      className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800"
                      placeholder="key"
                      list={
                        localSchemaFacet === 'properties'
                          ? 'local-schema-property-keys'
                          : undefined
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const next = localSchemaRows.filter(r => r.id !== row.id)
                      setLocalSchemaRows(next)
                    }}
                    className="App-toolbar__btn text-[11px] border border-gray-300 bg-white text-gray-600"
                  >
                    {UI_LABELS.delete}
                  </button>
                </div>
              }
              valueNode={
                <RightAlignedValueCell className="gap-1">
                  <input
                    type="text"
                    value={row.value}
                    onChange={e => {
                      const next = localSchemaRows.slice()
                      next[index] = { ...row, value: e.target.value }
                      setLocalSchemaRows(next)
                    }}
                    className={`h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800 ${uiPanelMonospaceTextClass}`}
                    placeholder={
                      localSchemaFacet === 'localRules'
                        ? '{"target":"node"}'
                        : '{"type":"string"}'
                    }
                  />
                  {hasAnySuggestions ? (
                    <div
                      className={`${uiPanelKeyValueTextSizeClass} flex flex-wrap items-center gap-1 text-gray-500`}
                    >
                      <span>Suggestions:</span>
                      {hasDefaultSuggestion ? (
                        <button
                          type="button"
                          className="App-toolbar__btn text-[11px] border border-gray-300 bg-white text-gray-600"
                          onClick={() => applySuggestedSpec('default')}
                        >
                          Use default
                        </button>
                      ) : null}
                      {enumValuesToShow.map(v => (
                        <button
                          key={v}
                          type="button"
                          className="App-toolbar__btn text-[11px] border border-gray-300 bg-white text-gray-600"
                          onClick={() => applySuggestedSpec('enum', String(v))}
                        >
                          {v}
                        </button>
                      ))}
                      {hasSampleSuggestion ? (
                        <button
                          type="button"
                          className="App-toolbar__btn text-[11px] border border-gray-300 bg-white text-gray-600"
                          onClick={() => applySuggestedSpec('sample')}
                        >
                          Use sample
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </RightAlignedValueCell>
              }
            />
          )
        })}
        {localSchemaFacet === 'properties' && suggestedPropertyKeys.length > 0 ? (
          <datalist id="local-schema-property-keys">
            {suggestedPropertyKeys.map(k => (
              <option key={k} value={k} />
            ))}
          </datalist>
        ) : null}
      </div>
      <div className="border-t border-gray-200 px-2 py-1.5 flex justify-between items-center">
        <button
          type="button"
          onClick={() => {
            const nextId = `${Date.now()}-${localSchemaRows.length}`
            if (localSchemaFacet === 'localRules') {
              setLocalSchemaRows([
                ...localSchemaRows,
                {
                  id: nextId,
                  key: String(localSchemaRows.length + 1),
                  value: '',
                },
              ])
            } else {
              setLocalSchemaRows([
                ...localSchemaRows,
                {
                  id: nextId,
                  key: '',
                  value: '',
                },
              ])
            }
          }}
          className="App-toolbar__btn text-xs border border-gray-300 bg-white text-gray-700"
        >
          {localSchemaFacet === 'localRules' ? 'Add rule' : 'Add key'}
        </button>
      </div>
    </section>
  )
}

