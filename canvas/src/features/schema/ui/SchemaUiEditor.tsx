import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react'
import { GraphSchema, PropertySpec } from '@/lib/graph/schema'
import type { JSONValue } from '@/lib/graph/types'
import { useGraphStore } from '@/hooks/useGraphStore'
import { parseSchemaLintOwner } from '@/features/schema/validation'
import { uniqueNodeTypes, uniqueEdgeLabels } from '@/features/schema/derive'
import { UI_COPY } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { buildMergedValidation, withLayoutNumbers, withLinkDistances, withCollisionByType, resolveSelectedKey, getSchemaBaseForUiApply } from './utils'
import type { SchemaUiApplyRegistration } from '@/features/schema-editor/useWorkflowManagerSchema'
import {
  SchemaUiHeaderRow,
  SchemaUiLayoutSection,
  SchemaUiMetadataContextRow,
  SchemaUiRulesRow,
  SchemaUiTemplatePropsRow,
  SchemaUiValidationRulesRow,
} from './SchemaUiEditorRows'

const schemaEditorPanelClassName = `rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} p-3`
const schemaEditorSectionTitleClassName = `text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`

function tryParseJsonWithKind<T>(
  text: string,
  fallback: T,
  kind: string,
  setError: (msg: string) => void,
): T | null {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  try {
    return JSON.parse(trimmed) as T
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    setError(`Invalid ${kind} JSON: ${msg}`)
    return null
  }
}


export default function SchemaUiEditor({
  schema,
  setSchema,
  registerApply,
  preferredType,
  preferredKey,
  mode,
}: {
  schema: GraphSchema
  setSchema: (s: GraphSchema) => void
  registerApply?: (reg: SchemaUiApplyRegistration) => void
  preferredType?: 'node' | 'edge'
  preferredKey?: string
  mode?: 'full' | 'globalOnly'
}) {
  const schemaLintExamplePath = useGraphStore(s => s.schemaLintExamplePath)
  const data = useGraphStore(s => s.graphData)
  const setSchemaOpStatus = useGraphStore(s => s.setSchemaOpStatus)
  const [type, setType] = useState<'node' | 'edge'>('node')

  const keys = useMemo(() => {
    if (type === 'node') return uniqueNodeTypes(data, schema)
    return uniqueEdgeLabels(data, schema)
  }, [type, data, schema])

  const [selectedKey, setSelectedKey] = useState<string>(keys[0] ?? '')
  const [newKey, setNewKey] = useState<string>('')
  const [templateText, setTemplateText] = useState<string>('{}')
  const [propsText, setPropsText] = useState<string>('{}')
  const [metadataText, setMetadataText] = useState<string>('{}')
  const [contextText, setContextText] = useState<string>('{}')
  const [validationText, setValidationText] = useState<string>('{}')
  const [globalRulesText, setGlobalRulesText] = useState<string>('[]')
  const [localRulesText, setLocalRulesText] = useState<string>('[]')
  const [linkDistanceText, setLinkDistanceText] = useState<string>('{}')
  const [collisionByTypeText, setCollisionByTypeText] = useState<string>('{}')
  const [layoutCharge, setLayoutCharge] = useState<number>(schema.layout?.forces?.charge ?? -300)
  const [layoutCenterStrength, setLayoutCenterStrength] = useState<number>(schema.layout?.forces?.centerStrength ?? 1)
  const [layoutAlphaDecay, setLayoutAlphaDecay] = useState<number>(schema.layout?.forces?.alphaDecay ?? 0.02)
  const [fitPadding, setFitPadding] = useState<number>(schema.layout?.fitPadding ?? 80)
  const [error, setError] = useState<string>('')
  const propertyNames = useMemo(() => {
    const props = type === 'node' ? (schema.propertySchemas?.node?.[selectedKey] ?? {}) : (schema.propertySchemas?.edge?.[selectedKey] ?? {})
    return Object.keys(props)
  }, [schema, type, selectedKey])
  const [requiredSet, setRequiredSet] = useState<Set<string>>(new Set())
  const [typesMap, setTypesMap] = useState<Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>>({})
  const [bulkType, setBulkType] = useState<'string' | 'number' | 'boolean' | 'array' | 'object'>('string')

  const lintOwner = useMemo<null | { ownerKind: 'node' | 'edge'; ownerKey: string }>(
    () => parseSchemaLintOwner(schemaLintExamplePath || ''),
    [schemaLintExamplePath],
  )

  useEffect(() => {
    if (!keys.length) return
    setSelectedKey(prev => {
      const trimmed = String(prev || '').trim()
      if (trimmed && keys.includes(trimmed)) return trimmed
      return keys[0] ?? ''
    })
  }, [keys])

  useLayoutEffect(() => {
    const tmpl = (type === 'node' ? schema.templates?.node?.[selectedKey] : schema.templates?.edge?.[selectedKey]) ?? {}
    const props = (type === 'node' ? schema.propertySchemas?.node?.[selectedKey] : schema.propertySchemas?.edge?.[selectedKey]) ?? {}
    const validationEntry = (type === 'node' ? schema.validation?.node?.[selectedKey] : schema.validation?.edge?.[selectedKey]) ?? {}
    const globalRules = (schema.rules ?? []).filter(r => r.target === type && !r.type)
    const localRules = (schema.rules ?? []).filter(r => r.target === type && r.type === selectedKey)
    try { setTemplateText(JSON.stringify(tmpl, null, 2)) } catch { setTemplateText('{}') }
    try { setPropsText(JSON.stringify(props, null, 2)) } catch { setPropsText('{}') }
    try { setValidationText(JSON.stringify(validationEntry, null, 2)) } catch { setValidationText('{}') }
    try { setGlobalRulesText(JSON.stringify(globalRules, null, 2)) } catch { setGlobalRulesText('[]') }
    try { setLocalRulesText(JSON.stringify(localRules, null, 2)) } catch { setLocalRulesText('[]') }
    setError('')
    const initialRequired = (type === 'node' ? schema.validation?.node?.[selectedKey]?.required ?? [] : schema.validation?.edge?.[selectedKey]?.required ?? [])
    setRequiredSet(new Set(initialRequired))
    const initialTypes = (type === 'node' ? schema.validation?.node?.[selectedKey]?.types ?? {} : schema.validation?.edge?.[selectedKey]?.types ?? {})
    const fallbackTypes: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'> = {}
    propertyNames.forEach(p => {
      const specType = (type === 'node'
        ? (schema.propertySchemas?.node?.[selectedKey]?.[p]?.type)
        : (schema.propertySchemas?.edge?.[selectedKey]?.[p]?.type)) as ('string' | 'number' | 'boolean' | 'array' | 'object' | undefined)
      fallbackTypes[p] = (initialTypes[p] ?? specType ?? 'string') as 'string' | 'number' | 'boolean' | 'array' | 'object'
    })
    setTypesMap(fallbackTypes)
  }, [type, selectedKey, schema, propertyNames])

  useLayoutEffect(() => {
    try { setMetadataText(JSON.stringify(schema.metadata ?? {}, null, 2)) } catch { setMetadataText('{}') }
    try { setContextText(JSON.stringify(schema.serialization?.context ?? {}, null, 2)) } catch { setContextText('{}') }
    setLayoutCharge(schema.layout?.forces?.charge ?? -300)
    setLayoutCenterStrength(schema.layout?.forces?.centerStrength ?? 1)
    setLayoutAlphaDecay(schema.layout?.forces?.alphaDecay ?? 0.02)
    setFitPadding(schema.layout?.fitPadding ?? 80)
    try { setLinkDistanceText(JSON.stringify(schema.layout?.forces?.linkDistanceByLabel ?? {}, null, 2)) } catch { setLinkDistanceText('{}') }
    try { setCollisionByTypeText(JSON.stringify(schema.layout?.forces?.collisionByType ?? {}, null, 2)) } catch { setCollisionByTypeText('{}') }
  }, [schema])

  const applyTemplateToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const key = String(selectedKey || '').trim()
    if (!key) return baseSchema
    const parsed = tryParseJsonWithKind<Record<string, JSONValue>>(templateText, {}, 'template', setError)
    if (!parsed) return null
    if (type === 'node') {
      return {
        ...baseSchema,
        templates: {
          ...(baseSchema.templates ?? {}),
          node: { ...(baseSchema.templates?.node ?? {}), [key]: parsed },
        },
      }
    }
    return {
      ...baseSchema,
      templates: {
        ...(baseSchema.templates ?? {}),
        edge: { ...(baseSchema.templates?.edge ?? {}), [key]: parsed },
      },
    }
  }, [templateText, type, selectedKey])

  const applyPropsToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const key = String(selectedKey || '').trim()
    if (!key) return baseSchema
    const parsed = tryParseJsonWithKind<Record<string, PropertySpec>>(propsText, {}, 'properties', setError)
    if (!parsed) return null
    if (type === 'node') {
      return {
        ...baseSchema,
        propertySchemas: {
          ...(baseSchema.propertySchemas ?? {}),
          node: { ...(baseSchema.propertySchemas?.node ?? {}), [key]: parsed },
        },
      }
    }
    return {
      ...baseSchema,
      propertySchemas: {
        ...(baseSchema.propertySchemas ?? {}),
        edge: { ...(baseSchema.propertySchemas?.edge ?? {}), [key]: parsed },
      },
    }
  }, [propsText, type, selectedKey])

  const applyMetadataToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const parsed = tryParseJsonWithKind<Record<string, JSONValue>>(metadataText, {}, 'metadata', setError)
    if (!parsed) return null
    return { ...baseSchema, metadata: parsed }
  }, [metadataText])

  const applyContextToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const parsed = tryParseJsonWithKind<Record<string, JSONValue>>(contextText, {}, 'context', setError)
    if (!parsed) return null
    return { ...baseSchema, serialization: { ...(baseSchema.serialization ?? {}), context: parsed } }
  }, [contextText])

  const applyValidationToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const key = String(selectedKey || '').trim()
    if (!key) return baseSchema
    const parsed = tryParseJsonWithKind<Record<string, unknown>>(validationText, {}, 'validation', setError)
    if (!parsed) return null
    const merged = buildMergedValidation(parsed, requiredSet, typesMap)
    if (type === 'node') {
      return {
        ...baseSchema,
        validation: {
          ...(baseSchema.validation ?? {}),
          node: { ...(baseSchema.validation?.node ?? {}), [key]: merged },
        },
      }
    }
    return {
      ...baseSchema,
      validation: {
        ...(baseSchema.validation ?? {}),
        edge: { ...(baseSchema.validation?.edge ?? {}), [key]: merged },
      },
    }
  }, [validationText, type, selectedKey, requiredSet, typesMap])

  const applyRulesToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const key = String(selectedKey || '').trim()
    if (!key) return baseSchema
    try {
      const parsedGlobal = globalRulesText.trim() ? JSON.parse(globalRulesText) : []
      if (!Array.isArray(parsedGlobal)) throw new Error('Global rules must be an array')
      const normalizedGlobal = parsedGlobal.map((r: unknown) => {
        if (typeof r !== 'object' || r === null) return { target: type }
        const rest = { ...(r as Record<string, unknown>) }
        delete rest.type
        delete rest.target
        return { target: type, ...rest }
      })

      const parsedLocal = localRulesText.trim() ? JSON.parse(localRulesText) : []
      if (!Array.isArray(parsedLocal)) throw new Error('Local rules must be an array')
      const normalizedLocal = parsedLocal.map((r: unknown) => {
        if (typeof r !== 'object' || r === null) return { target: type, type: selectedKey }
        const rest = { ...(r as Record<string, unknown>) }
        delete rest.type
        delete rest.target
        return { target: type, type: selectedKey, ...rest }
      })

      const others = (baseSchema.rules ?? []).filter(r => !(r.target === type && (!r.type || r.type === key)))
      const next: GraphSchema = { ...baseSchema, rules: [...others, ...normalizedGlobal, ...normalizedLocal] }
      return next
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`${UI_COPY.invalidRulesJsonPrefix}${msg}`)
      return null
    }
  }, [globalRulesText, localRulesText, type, selectedKey])

  const applyLayoutNumbersToSchema = useCallback((baseSchema: GraphSchema): GraphSchema => {
    return withLayoutNumbers(baseSchema, layoutCharge, layoutCenterStrength, layoutAlphaDecay, fitPadding)
  }, [layoutCharge, layoutCenterStrength, layoutAlphaDecay, fitPadding])

  const applyLinkDistancesToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const parsed = tryParseJsonWithKind<Record<string, number>>(linkDistanceText, {}, 'linkDistances', setError)
    if (!parsed) return null
    const next = withLinkDistances(baseSchema, parsed)
    return next
  }, [linkDistanceText])

  const applyCollisionByTypeToSchema = useCallback((baseSchema: GraphSchema): GraphSchema | null => {
    const parsed = tryParseJsonWithKind<Record<string, number>>(collisionByTypeText, {}, 'collisionByType', setError)
    if (!parsed) return null
    const next = withCollisionByType(baseSchema, parsed)
    return next
  }, [collisionByTypeText])

  const applyFromUi = useCallback(() => {
    let next: GraphSchema | null = getSchemaBaseForUiApply(schema)
    const metadataNext = applyMetadataToSchema(next)
    if (!metadataNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = metadataNext
    const contextNext = applyContextToSchema(next)
    if (!contextNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = contextNext
    const templateNext = applyTemplateToSchema(next)
    if (!templateNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = templateNext
    const propsNext = applyPropsToSchema(next)
    if (!propsNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = propsNext
    const validationNext = applyValidationToSchema(next)
    if (!validationNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = validationNext
    const rulesNext = applyRulesToSchema(next)
    if (!rulesNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = rulesNext
    next = applyLayoutNumbersToSchema(next)
    const linkNext = applyLinkDistancesToSchema(next)
    if (!linkNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = linkNext
    const collNext = applyCollisionByTypeToSchema(next)
    if (!collNext) {
      setSchemaOpStatus(false, 'Apply failed')
      return
    }
    next = collNext
    setSchema(next)
    setError('')
    setSchemaOpStatus(true, 'Apply OK')
  }, [
    schema,
    setSchema,
    setSchemaOpStatus,
    applyMetadataToSchema,
    applyContextToSchema,
    applyTemplateToSchema,
    applyPropsToSchema,
    applyValidationToSchema,
    applyRulesToSchema,
    applyLayoutNumbersToSchema,
    applyLinkDistancesToSchema,
    applyCollisionByTypeToSchema,
  ])

  useEffect(() => {
    const nextType = lintOwner?.ownerKind ?? preferredType
    if (!nextType) return
    if (nextType === type) return
    setType(nextType)
  }, [lintOwner?.ownerKind, preferredType, type])

  useEffect(() => {
    if (!registerApply) return
    const schemaHash = (() => {
      try {
        return JSON.stringify(schema)
      } catch {
        return ''
      }
    })()
    registerApply({ apply: applyFromUi, schemaHash })
  }, [
    registerApply,
    schema,
    setSchema,
    setSchemaOpStatus,
    applyFromUi,
    applyTemplateToSchema,
    applyPropsToSchema,
    applyValidationToSchema,
    applyRulesToSchema,
    applyLayoutNumbersToSchema,
    applyLinkDistancesToSchema,
    applyCollisionByTypeToSchema,
    applyMetadataToSchema,
    applyContextToSchema,
    type,
  ])

  const availableKeys = useMemo(() => {
    const fromCatalog = keys
    const fromTemplates = Object.keys(type === 'node' ? (schema.templates?.node ?? {}) : (schema.templates?.edge ?? {}))
    const fromProps = Object.keys(type === 'node' ? (schema.propertySchemas?.node ?? {}) : (schema.propertySchemas?.edge ?? {}))
    const set = new Set<string>([...fromCatalog, ...fromTemplates, ...fromProps])
    return Array.from(set).sort()
  }, [keys, type, schema])

  useEffect(() => {
    const resolved = resolveSelectedKey(availableKeys, selectedKey)
    if (!resolved || resolved === selectedKey) return
    setSelectedKey(resolved)
  }, [availableKeys, selectedKey])

  useEffect(() => {
    const nextKey =
      (lintOwner && lintOwner.ownerKind === type ? lintOwner.ownerKey : undefined) ?? preferredKey
    if (!nextKey) return
    if (!availableKeys.includes(nextKey)) return
    setSelectedKey(prev => (prev === nextKey ? prev : nextKey))
  }, [lintOwner, preferredKey, type, availableKeys, setSelectedKey])

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-2">
      <section className={schemaEditorPanelClassName}>
        <section className="flex items-center justify-between gap-2">
          <section className={schemaEditorSectionTitleClassName}>
            Global schema
          </section>
          {!registerApply ? (
            <button
              type="button"
              className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.primarySolid}`}
              onClick={applyFromUi}
            >
              Apply
            </button>
          ) : null}
        </section>
        <SchemaUiMetadataContextRow
          metadataText={metadataText}
          contextText={contextText}
          setMetadataText={setMetadataText}
          setContextText={setContextText}
        />
        <SchemaUiRulesRow
          title={`Global rules (${type})`}
          rulesText={globalRulesText}
          setRulesText={setGlobalRulesText}
          helperText="Rules without a type apply to all owners for the selected scope."
          className="mt-2"
        />
        <SchemaUiLayoutSection
          layoutCharge={layoutCharge}
          layoutCenterStrength={layoutCenterStrength}
          layoutAlphaDecay={layoutAlphaDecay}
          fitPadding={fitPadding}
          setLayoutCharge={setLayoutCharge}
          setLayoutCenterStrength={setLayoutCenterStrength}
          setLayoutAlphaDecay={setLayoutAlphaDecay}
          setFitPadding={setFitPadding}
          linkDistanceText={linkDistanceText}
          collisionByTypeText={collisionByTypeText}
          setLinkDistanceText={setLinkDistanceText}
          setCollisionByTypeText={setCollisionByTypeText}
        />
      </section>

      {mode !== 'globalOnly' ? (
        <section className={`${schemaEditorPanelClassName} flex-1 min-h-0`}>
          <section className="flex items-center justify-between gap-2">
            <section className={schemaEditorSectionTitleClassName}>
              Local schema (per owner)
            </section>
            <section className="flex items-center gap-1">
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${type === 'node' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralMuted} ${UI_THEME_TOKENS.button.hoverBg}`}`}
                onClick={() => setType('node')}
              >
                Node
              </button>
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${type === 'edge' ? UI_THEME_TOKENS.button.primarySolid : `${UI_THEME_TOKENS.button.neutralMuted} ${UI_THEME_TOKENS.button.hoverBg}`}`}
                onClick={() => setType('edge')}
              >
                Edge
              </button>
            </section>
          </section>
          <section className="mt-2">
            <SchemaUiHeaderRow
              type={type}
              availableKeys={availableKeys}
              selectedKey={selectedKey}
              newKey={newKey}
              setSelectedKey={setSelectedKey}
              setNewKey={setNewKey}
              error={error}
            />
            <SchemaUiTemplatePropsRow
              templateText={templateText}
              propsText={propsText}
              setTemplateText={setTemplateText}
              setPropsText={setPropsText}
            />
            <SchemaUiValidationRulesRow
              type={type}
              schema={schema}
              selectedKey={selectedKey}
              propertyNames={propertyNames}
              validationText={validationText}
              rulesText={localRulesText}
              setValidationText={setValidationText}
              setRulesText={setLocalRulesText}
              requiredSet={requiredSet}
              setRequiredSet={setRequiredSet}
              typesMap={typesMap}
              setTypesMap={setTypesMap}
              bulkType={bulkType}
              setBulkType={setBulkType}
              rulesTitle={`Local rules (${type}:${selectedKey || '(none)'})`}
              rulesHelperText="Rules with a type apply only to the selected owner."
            />
          </section>
        </section>
      ) : null}
    </section>
  )
}
