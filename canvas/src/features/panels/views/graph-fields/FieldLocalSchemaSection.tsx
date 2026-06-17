import React from 'react'
import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { GraphFieldsSelectedView } from '@/features/panels/views/GraphFieldsView'
import { parseJsonOrError } from '@/features/schema-editor/advancedSerialization'
import FieldLocalSchemaSectionBody from '@/features/panels/views/graph-fields/FieldLocalSchemaSectionBody'
import {
  computeFieldLocalSchemaPropertySuggestions,
  computeFieldLocalSchemaValidationWarnings,
} from '@/features/panels/views/graph-fields/fieldLocalSchemaUtils'
import type { ValidationWarning } from '@/features/panels/views/graph-fields/FieldLocalSchemaValidationEditor'

type FieldLocalSchemaRow = { id: string; key: string; value: string }

type FieldLocalValidationEntry = NonNullable<
  NonNullable<NonNullable<GraphSchema['validation']>['node']>
>[string]

type FieldLocalSchemaSectionProps = {
  graphData: GraphData | null
  schema: GraphSchema | null
  setSchema: (next: GraphSchema) => void
  selectedGlobalView: GraphFieldsSelectedView | null
  setSelectedGlobalView: React.Dispatch<React.SetStateAction<GraphFieldsSelectedView>>
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  uiPanelRowDensityCompactClass: string
  localSchemaNodeTypes: string[]
  localSchemaEdgeLabels: string[]
}

export default function FieldLocalSchemaSection({
  graphData,
  schema,
  setSchema,
  selectedGlobalView,
  setSelectedGlobalView,
  uiPanelKeyValueTextSizeClass,
  uiPanelTextFontClass,
  uiPanelMonospaceTextClass,
  uiPanelRowDensityCompactClass,
  localSchemaNodeTypes,
  localSchemaEdgeLabels,
}: FieldLocalSchemaSectionProps) {
  const localSchemaScope =
    selectedGlobalView?.kind === 'localSchema' ? selectedGlobalView.scope : 'node'
  const localSchemaOwnerKey =
    selectedGlobalView?.kind === 'localSchema' ? selectedGlobalView.ownerKey : ''
  const localSchemaFacet =
    selectedGlobalView?.kind === 'localSchema' ? selectedGlobalView.facet : null

  const localSchemaOwnerCandidates =
    localSchemaScope === 'node' ? localSchemaNodeTypes : localSchemaEdgeLabels
  const hasLocalSchemaOwner = !!String(localSchemaOwnerKey || '').trim()

  React.useEffect(() => {
    if (selectedGlobalView?.kind !== 'localSchema') return
    const candidates = localSchemaOwnerCandidates
    const current = String(localSchemaOwnerKey || '').trim()
    if (candidates.length === 0) {
      if (!current) return
      setSelectedGlobalView(prev => {
        if (!prev || prev.kind !== 'localSchema') return prev
        return { ...prev, ownerKey: '' }
      })
      return
    }
    if (current && candidates.includes(current)) return
    setSelectedGlobalView(prev => {
      if (!prev || prev.kind !== 'localSchema') return prev
      return { ...prev, ownerKey: candidates[0] }
    })
  }, [
    localSchemaOwnerCandidates,
    localSchemaOwnerKey,
    selectedGlobalView,
    setSelectedGlobalView,
  ])

  const [localSchemaError, setLocalSchemaError] = React.useState('')
  const [localSchemaRows, setLocalSchemaRows] = React.useState<FieldLocalSchemaRow[]>([])

  const [localValidationRequiredSet, setLocalValidationRequiredSet] = React.useState<
    Set<string>
  >(new Set())
  const [localValidationTypesMap, setLocalValidationTypesMap] = React.useState<
    Record<string, PropertySpec['type']>
  >({})
  const [localValidationBulkType, setLocalValidationBulkType] =
    React.useState<PropertySpec['type']>('string')
  const [localValidationSeverity, setLocalValidationSeverity] = React.useState<
    'error' | 'warn'
  >('error')
  const [localValidationOtherText, setLocalValidationOtherText] =
    React.useState<string>('{}')
  const [localValidationWarnings, setLocalValidationWarnings] = React.useState<
    ValidationWarning[]
  >([])

  const getValidationControlId = (kind: 'required' | 'type', key: string) => {
    const owner = String(localSchemaOwnerKey || '').trim() || 'owner'
    const scope = localSchemaScope === 'edge' ? 'edge' : 'node'
    return (
      kind === 'required'
        ? `local-validation-required-${scope}-${owner}-${key}`
        : `local-validation-type-${scope}-${owner}-${key}`
    )
  }

  const validationPropertyNames = React.useMemo(() => {
    if (!schema) return [] as string[]
    if (!hasLocalSchemaOwner) return [] as string[]
    if (localSchemaFacet !== 'validation') return [] as string[]
    const props =
      localSchemaScope === 'node'
        ? schema.propertySchemas?.node?.[localSchemaOwnerKey] ?? {}
        : schema.propertySchemas?.edge?.[localSchemaOwnerKey] ?? {}
    return Object.keys(props)
  }, [schema, hasLocalSchemaOwner, localSchemaFacet, localSchemaOwnerKey, localSchemaScope])

  const propertySuggestions = React.useMemo(
    () =>
      computeFieldLocalSchemaPropertySuggestions({
        graphData,
        hasLocalSchemaOwner,
        localSchemaFacet,
        localSchemaOwnerKey,
        localSchemaScope,
      }),
    [
      graphData,
      hasLocalSchemaOwner,
      localSchemaFacet,
      localSchemaOwnerKey,
      localSchemaScope,
    ],
  )

  const suggestedPropertyKeys = propertySuggestions.keys
  const suggestedPropertyTypeByKey = propertySuggestions.typeByKey
  const suggestedPropertySampleByKey = propertySuggestions.sampleByKey
  const enumCandidatesByKey = propertySuggestions.enumByKey

  const computeLocalSchemaInitialValue = React.useCallback(() => {
    if (!schema) return localSchemaFacet === 'localRules' ? '[]' : '{}'
    if (selectedGlobalView?.kind !== 'localSchema')
      return localSchemaFacet === 'localRules' ? '[]' : '{}'
    if (!hasLocalSchemaOwner) return localSchemaFacet === 'localRules' ? '[]' : '{}'
    const next = (() => {
      if (localSchemaFacet === 'properties') {
        return (localSchemaScope === 'node'
          ? schema.propertySchemas?.node?.[localSchemaOwnerKey]
          : schema.propertySchemas?.edge?.[localSchemaOwnerKey]) ?? {}
      }
      if (localSchemaFacet === 'validation') {
        return (localSchemaScope === 'node'
          ? schema.validation?.node?.[localSchemaOwnerKey]
          : schema.validation?.edge?.[localSchemaOwnerKey]) ?? {}
      }
      if (localSchemaFacet === 'localRules') {
        return (schema.rules ?? []).filter(
          r => r.target === localSchemaScope && r.type === localSchemaOwnerKey,
        )
      }
      return {}
    })()
    try {
      return JSON.stringify(next, null, 2)
    } catch {
      return localSchemaFacet === 'localRules' ? '[]' : '{}'
    }
  }, [
    hasLocalSchemaOwner,
    localSchemaFacet,
    localSchemaOwnerKey,
    localSchemaScope,
    schema,
    selectedGlobalView?.kind,
  ])

  const resetValidationUiState = React.useCallback(() => {
    setLocalValidationRequiredSet(new Set())
    setLocalValidationTypesMap({})
    setLocalValidationBulkType('string')
    setLocalValidationSeverity('error')
    setLocalValidationOtherText('{}')
  }, [])

  const hydrateEditorStateFromText = React.useCallback(
    (nextText: string) => {
      const parsed = parseJsonOrError(nextText)
      if (parsed.error || parsed.value == null) {
        setLocalSchemaRows([])
        if (localSchemaFacet === 'validation') resetValidationUiState()
        return
      }
      if (localSchemaFacet === 'localRules') {
        if (!Array.isArray(parsed.value)) {
          setLocalSchemaRows([])
          return
        }
        setLocalSchemaRows(
          parsed.value.map((v, index) => ({
            id: `${Date.now()}-${index}`,
            key: String(index + 1),
            value: (() => {
              try {
                return JSON.stringify(v)
              } catch {
                return ''
              }
            })(),
          })),
        )
        return
      }
      if (typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
        setLocalSchemaRows([])
        if (localSchemaFacet === 'validation') resetValidationUiState()
        return
      }
      const entries = Object.entries(parsed.value as Record<string, unknown>)
      if (localSchemaFacet === 'validation') {
        const entry = parsed.value as Record<string, unknown>
        const rawRequired = Array.isArray((entry as { required?: unknown }).required)
          ? ((entry as { required?: unknown }).required as unknown[])
          : []
        const nextRequired = new Set<string>()
        for (let i = 0; i < rawRequired.length; i += 1) {
          const v = String(rawRequired[i] ?? '').trim()
          if (v) nextRequired.add(v)
        }
        const rawTypes = (entry as { types?: unknown }).types
        const nextTypes: Record<string, PropertySpec['type']> = {}
        if (rawTypes && typeof rawTypes === 'object' && !Array.isArray(rawTypes)) {
          Object.entries(rawTypes as Record<string, unknown>).forEach(([k, v]) => {
            const t = String(v ?? '').trim()
            if (
              t === 'string' ||
              t === 'number' ||
              t === 'boolean' ||
              t === 'array' ||
              t === 'object'
            ) {
              nextTypes[k] = t
            }
          })
        }
        const rawSeverity = (entry as { severity?: unknown }).severity
        const nextSeverity = rawSeverity === 'warn' ? 'warn' : 'error'
        const rest: Record<string, unknown> = {}
        entries.forEach(([k, v]) => {
          if (k === 'required' || k === 'types' || k === 'severity') return
          rest[k] = v
        })
        let otherText = '{}'
        try {
          otherText = JSON.stringify(rest, null, 2)
        } catch {
          otherText = '{}'
        }
        setLocalValidationRequiredSet(nextRequired)
        setLocalValidationTypesMap(nextTypes)
        setLocalValidationBulkType('string')
        setLocalValidationSeverity(nextSeverity)
        setLocalValidationOtherText(otherText)
      }
      setLocalSchemaRows(
        entries.map(([k, v], index) => ({
          id: `${Date.now()}-${index}`,
          key: String(k),
          value: (() => {
            try {
              return JSON.stringify(v)
            } catch {
              return ''
            }
          })(),
        })),
      )
    },
    [localSchemaFacet, resetValidationUiState],
  )

  React.useEffect(() => {
    if (selectedGlobalView?.kind !== 'localSchema') return
    setLocalSchemaError('')
    const nextText = computeLocalSchemaInitialValue()
    hydrateEditorStateFromText(nextText)
  }, [computeLocalSchemaInitialValue, hydrateEditorStateFromText, selectedGlobalView?.kind])

  React.useEffect(() => {
    const nextWarnings = computeFieldLocalSchemaValidationWarnings({
      schema,
      hasLocalSchemaOwner,
      localSchemaFacet,
      localSchemaOwnerKey,
      localSchemaScope,
      localValidationRequiredSet,
      localValidationTypesMap,
    }) as ValidationWarning[]
    setLocalValidationWarnings(nextWarnings)
  }, [
    schema,
    hasLocalSchemaOwner,
    localSchemaFacet,
    localSchemaOwnerKey,
    localSchemaScope,
    localValidationRequiredSet,
    localValidationTypesMap,
  ])

  const focusValidationControl = (kind: 'required' | 'type', key: string) => {
    const id = getValidationControlId(kind, key)
    const el = document.getElementById(id)
    if (el && typeof (el as HTMLElement).focus === 'function') {
      ;(el as HTMLElement).focus()
    }
  }

  const resetLocalSchemaText = React.useCallback(() => {
    if (selectedGlobalView?.kind !== 'localSchema') return
    setLocalSchemaError('')
    const nextText = computeLocalSchemaInitialValue()
    hydrateEditorStateFromText(nextText)
  }, [computeLocalSchemaInitialValue, hydrateEditorStateFromText, selectedGlobalView?.kind])

  const applyLocalSchemaText = React.useCallback(() => {
    if (!schema) return
    if (!hasLocalSchemaOwner) return
    if (!localSchemaFacet) return
    if (localSchemaFacet === 'template') return
    if (localSchemaFacet === 'properties') {
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < localSchemaRows.length; i += 1) {
        const row = localSchemaRows[i]
        const key = String(row.key || '').trim()
        if (!key) continue
        const trimmed = String(row.value || '').trim()
        if (!trimmed) {
          obj[key] = null
          continue
        }
        const parsed = parseJsonOrError(trimmed)
        if (parsed.error) {
          setLocalSchemaError(parsed.error)
          return
        }
        obj[key] = parsed.value
      }
      const value: unknown = obj
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        setLocalSchemaError('Properties must be a JSON object')
        return
      }
      const ps = schema.propertySchemas ?? { node: {}, edge: {} }
      const currentByScope =
        localSchemaScope === 'node' ? (ps.node ?? {}) : (ps.edge ?? {})
      const nextByScope = {
        ...currentByScope,
        [localSchemaOwnerKey]: value as Record<string, PropertySpec>,
      }
      const next: GraphSchema = {
        ...schema,
        propertySchemas: {
          ...ps,
          [localSchemaScope]: nextByScope,
        },
      }
      setSchema(next)
      setLocalSchemaError('')
      return
    }

    if (localSchemaFacet === 'validation') {
      const trimmed = String(localValidationOtherText || '').trim()
      let extra: Record<string, unknown> = {}
      if (trimmed) {
        const parsed = parseJsonOrError(trimmed)
        if (parsed.error) {
          setLocalSchemaError(parsed.error)
          return
        }
        if (
          typeof parsed.value !== 'object' ||
          parsed.value === null ||
          Array.isArray(parsed.value)
        ) {
          setLocalSchemaError('Additional validation options must be a JSON object')
          return
        }
        extra = parsed.value as Record<string, unknown>
      }
      const validationEntry: Record<string, unknown> = {
        ...extra,
        required: Array.from(localValidationRequiredSet),
        types: localValidationTypesMap,
        severity: localValidationSeverity,
      }
      const v = schema.validation ?? { node: {}, edge: {} }
      const currentByScope =
        localSchemaScope === 'node' ? (v.node ?? {}) : (v.edge ?? {})
      const nextByScope = {
        ...currentByScope,
        [localSchemaOwnerKey]: validationEntry as FieldLocalValidationEntry,
      }
      const next: GraphSchema = {
        ...schema,
        validation: {
          ...v,
          [localSchemaScope]: nextByScope,
        },
      }
      setSchema(next)
      setLocalSchemaError('')
      return
    }

    if (localSchemaFacet === 'localRules') {
      const rules: unknown[] = []
      for (let i = 0; i < localSchemaRows.length; i += 1) {
        const row = localSchemaRows[i]
        const trimmed = String(row.value || '').trim()
        if (!trimmed) continue
        const parsed = parseJsonOrError(trimmed)
        if (parsed.error) {
          setLocalSchemaError(parsed.error)
          return
        }
        rules.push(parsed.value)
      }
      const value: unknown = rules
      if (!Array.isArray(value)) {
        setLocalSchemaError('Local rules must be a JSON array')
        return
      }
      const others = (schema.rules ?? []).filter(
        r => !(r.target === localSchemaScope && r.type === localSchemaOwnerKey),
      )
      const normalized = value.map((r: unknown) => {
        if (typeof r !== 'object' || r === null) {
          return { target: localSchemaScope, type: localSchemaOwnerKey }
        }
        const rest = { ...(r as Record<string, unknown>) }
        delete rest.target
        delete rest.type
        return { target: localSchemaScope, type: localSchemaOwnerKey, ...rest }
      })
      setSchema({
        ...schema,
        rules: [...others, ...normalized],
      })
      setLocalSchemaError('')
    }
  }, [
    hasLocalSchemaOwner,
    localSchemaFacet,
    localSchemaOwnerKey,
    localSchemaRows,
    localSchemaScope,
    schema,
    setSchema,
    localValidationOtherText,
    localValidationRequiredSet,
    localValidationSeverity,
    localValidationTypesMap,
  ])

  return (
    <FieldLocalSchemaSectionBody
      schema={schema}
      localSchemaFacet={localSchemaFacet}
      localSchemaScope={localSchemaScope}
      localSchemaOwnerKey={localSchemaOwnerKey}
      localSchemaNodeTypes={localSchemaNodeTypes}
      localSchemaEdgeLabels={localSchemaEdgeLabels}
      localSchemaOwnerCandidates={localSchemaOwnerCandidates}
      hasLocalSchemaOwner={hasLocalSchemaOwner}
      localSchemaError={localSchemaError}
      uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
      uiPanelTextFontClass={uiPanelTextFontClass}
      uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
      uiPanelRowDensityCompactClass={uiPanelRowDensityCompactClass}
      setSelectedGlobalView={setSelectedGlobalView}
      applyLocalSchemaText={applyLocalSchemaText}
      resetLocalSchemaText={resetLocalSchemaText}
      validationPropertyNames={validationPropertyNames}
      localValidationWarnings={localValidationWarnings}
      localValidationRequiredSet={localValidationRequiredSet}
      setLocalValidationRequiredSet={setLocalValidationRequiredSet}
      localValidationTypesMap={localValidationTypesMap}
      setLocalValidationTypesMap={setLocalValidationTypesMap}
      localValidationBulkType={localValidationBulkType}
      setLocalValidationBulkType={setLocalValidationBulkType}
      localValidationSeverity={localValidationSeverity}
      setLocalValidationSeverity={setLocalValidationSeverity}
      localValidationOtherText={localValidationOtherText}
      setLocalValidationOtherText={setLocalValidationOtherText}
      getValidationControlId={getValidationControlId}
      focusValidationControl={focusValidationControl}
      localSchemaRows={localSchemaRows}
      setLocalSchemaRows={setLocalSchemaRows}
      suggestedPropertyKeys={suggestedPropertyKeys}
      suggestedPropertyTypeByKey={suggestedPropertyTypeByKey}
      suggestedPropertySampleByKey={suggestedPropertySampleByKey}
      enumCandidatesByKey={enumCandidatesByKey}
    />
  )
}
