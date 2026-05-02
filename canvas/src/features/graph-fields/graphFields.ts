import type { GraphData, JSONValue } from '@/lib/graph/types'
import { isJsonValue } from '@/lib/graph/jsonValue'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'

export type GraphFieldScope = 'node' | 'edge'
export type GraphFieldKind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'mixed' | 'unknown'
export type GraphFieldId = `${GraphFieldScope}:${string}`

export type GraphFieldType =
  | 'Single line text'
  | 'Long text'
  | 'Number'
  | 'Decimal'
  | 'Checkbox'
  | 'Multi-select'
  | 'Single-select'
  | 'Date Time'
  | 'URL'
  | 'Currency'
  | 'JSON'

export const GRAPH_FIELD_TYPES: ReadonlyArray<GraphFieldType> = [
  'Single line text',
  'Long text',
  'Number',
  'Decimal',
  'Checkbox',
  'Multi-select',
  'Single-select',
  'Date Time',
  'URL',
  'Currency',
  'JSON',
]

export type GraphField = Readonly<{
  id: GraphFieldId
  scope: GraphFieldScope
  key: string
  kind: GraphFieldKind
  samples: number
}>

export type GraphFieldUrlProtocol = 'any' | 'http' | 'https'
export type GraphFieldDateTimeFormat = 'ISO' | 'Local'

export type GraphFieldSettings = Readonly<{
  displayName: string
  isHidden: boolean
  fieldType?: GraphFieldType
  isCustom?: boolean
  description?: string
  defaultValue?: JSONValue | null
  selectOptions?: ReadonlyArray<string>
  decimalPlaces?: number
  currencyCode?: string
  urlProtocol?: GraphFieldUrlProtocol
  dateTimeFormat?: GraphFieldDateTimeFormat
}>

export type GraphFieldSettingsResolved = Readonly<{
  displayName: string
  isHidden: boolean
  fieldType: GraphFieldType
  isCustom: boolean
  description: string
  defaultValue: JSONValue | null
  selectOptions: ReadonlyArray<string>
  decimalPlaces: number
  currencyCode: string
  urlProtocol: GraphFieldUrlProtocol
  dateTimeFormat: GraphFieldDateTimeFormat
}>

export type GraphFieldSettingsById = Partial<Record<GraphFieldId, GraphFieldSettings>>

export type AgenticRagFieldKind =
  | 'chunk_text'
  | 'embedding'
  | 'media_url'
  | 'graphRAGPath'

export const AGENTIC_RAG_FIELD_KIND_META: Record<
  AgenticRagFieldKind,
  Readonly<{
    legendLabel: string
    defaultDisplayName: string
  }>
> = {
  chunk_text: {
    legendLabel: 'chunk_text (node.properties.chunk_text)',
    defaultDisplayName: 'AgenticRAG chunk text',
  },
  embedding: {
    legendLabel: 'embedding (node.properties.embedding: number[])',
    defaultDisplayName: 'AgenticRAG embedding',
  },
  media_url: {
    legendLabel: 'media_url (node.properties.media_url)',
    defaultDisplayName: 'AgenticRAG media URL',
  },
  graphRAGPath: {
    legendLabel: 'graphRAGPath (node.properties.graphRAGPath)',
    defaultDisplayName: 'AgenticRAG path',
  },
} as const

export function getAgenticRagFieldKind(field: GraphField): AgenticRagFieldKind | null {
  if (field.scope !== 'node') return null
  if (field.key === 'chunk_text') return 'chunk_text'
  if (field.key === 'embedding') return 'embedding'
  if (field.key === 'media_url') return 'media_url'
  if (field.key === 'graphRAGPath') return 'graphRAGPath'
  return null
}

type GraphFieldKindBase = Exclude<GraphFieldKind, 'mixed' | 'unknown'>

function defaultDisplayNameForField(field: GraphField): string {
  const agenticKind = getAgenticRagFieldKind(field)
  if (agenticKind) return AGENTIC_RAG_FIELD_KIND_META[agenticKind].defaultDisplayName
  return field.key
}

export function parseGraphFieldId(id: string): { scope: GraphFieldScope; key: string } | null {
  const raw = String(id || '').trim()
  const idx = raw.indexOf(':')
  if (idx <= 0) return null
  const scope = raw.slice(0, idx)
  const key = raw.slice(idx + 1)
  if (scope !== 'node' && scope !== 'edge') return null
  const cleanedKey = String(key || '').trim()
  if (!cleanedKey) return null
  return { scope, key: cleanedKey }
}

function toGraphFieldKindBase(value: JSONValue): GraphFieldKindBase {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'object'
}

const DERIVED_FIELD_NESTED_MAX_DEPTH = 4
const DERIVED_FIELD_NESTED_SCAN_LIMIT = 20_000
const DERIVED_FIELDS_CACHE_LIMIT = 12
const RESOLVED_FIELD_SETTINGS_CACHE_LIMIT = 16
const derivedFieldsCache = new Map<string, ReadonlyArray<GraphField>>()
const resolvedFieldSettingsCache = new Map<string, Map<GraphFieldId, GraphFieldSettingsResolved>>()

export type GetCachedDerivedFieldsArgs = {
  graphData?: GraphData | null
  graphRevision?: number | null
  graphSemanticKey?: string | null
}

function readCachedDerivedFields(cacheKey: string): ReadonlyArray<GraphField> | null {
  const cached = derivedFieldsCache.get(cacheKey) || null
  if (!cached) return null
  derivedFieldsCache.delete(cacheKey)
  derivedFieldsCache.set(cacheKey, cached)
  return cached
}

function writeCachedDerivedFields(
  cacheKey: string,
  fields: ReadonlyArray<GraphField>,
): ReadonlyArray<GraphField> {
  derivedFieldsCache.set(cacheKey, fields)
  if (derivedFieldsCache.size > DERIVED_FIELDS_CACHE_LIMIT) {
    const oldestKey = derivedFieldsCache.keys().next().value
    if (typeof oldestKey === 'string') derivedFieldsCache.delete(oldestKey)
  }
  return fields
}

function buildResolvedFieldSettingsFieldSignature(
  fields: ReadonlyArray<GraphField>,
): string {
  if (!Array.isArray(fields) || fields.length === 0) return hashSignatureParts(['resolved-field-settings-fields', 0])
  return hashSignatureParts([
    'resolved-field-settings-fields',
    hashArrayOfObjectsSignature(
      fields.map(field => ({
        id: field.id,
        scope: field.scope,
        key: field.key,
        kind: field.kind,
      })),
      { maxItems: Math.max(24, fields.length), maxKeysPerItem: 4 },
    ),
  ])
}

function buildResolvedFieldSettingsSettingsSignature(
  fields: ReadonlyArray<GraphField>,
  settingsById: GraphFieldSettingsById,
): string {
  if (!Array.isArray(fields) || fields.length === 0) return hashSignatureParts(['resolved-field-settings-settings', 0])
  return hashSignatureParts([
    'resolved-field-settings-settings',
    hashArrayOfObjectsSignature(
      fields.map(field => {
        const settings = settingsById[field.id]
        return {
          id: field.id,
          displayName: String(settings?.displayName || ''),
          isHidden: settings?.isHidden === true,
          fieldType: String(settings?.fieldType || ''),
          isCustom: settings?.isCustom === true,
          description: String(settings?.description || ''),
          defaultValue: settings?.defaultValue === undefined ? '' : JSON.stringify(settings.defaultValue),
          selectOptions: Array.isArray(settings?.selectOptions) ? settings?.selectOptions.join('\u001f') : '',
          decimalPlaces:
            typeof settings?.decimalPlaces === 'number' && Number.isFinite(settings.decimalPlaces)
              ? settings.decimalPlaces
              : '',
          currencyCode: String(settings?.currencyCode || ''),
          urlProtocol: String(settings?.urlProtocol || ''),
          dateTimeFormat: String(settings?.dateTimeFormat || ''),
        }
      }),
      { maxItems: Math.max(24, fields.length), maxKeysPerItem: 11 },
    ),
  ])
}

function readCachedResolvedFieldSettings(
  cacheKey: string,
): Map<GraphFieldId, GraphFieldSettingsResolved> | null {
  const cached = resolvedFieldSettingsCache.get(cacheKey) || null
  if (!cached) return null
  resolvedFieldSettingsCache.delete(cacheKey)
  resolvedFieldSettingsCache.set(cacheKey, cached)
  return cached
}

function writeCachedResolvedFieldSettings(
  cacheKey: string,
  resolvedSettingsById: Map<GraphFieldId, GraphFieldSettingsResolved>,
): Map<GraphFieldId, GraphFieldSettingsResolved> {
  resolvedFieldSettingsCache.set(cacheKey, resolvedSettingsById)
  if (resolvedFieldSettingsCache.size > RESOLVED_FIELD_SETTINGS_CACHE_LIMIT) {
    const oldestKey = resolvedFieldSettingsCache.keys().next().value
    if (typeof oldestKey === 'string') resolvedFieldSettingsCache.delete(oldestKey)
  }
  return resolvedSettingsById
}

export function computeDerivedFields(graphData: GraphData): ReadonlyArray<GraphField> {
  type Accumulator = {
    scope: GraphFieldScope
    key: string
    kinds: Set<GraphFieldKindBase>
    hasUnknown: boolean
    samples: number
  }

  const byId = new Map<GraphFieldId, Accumulator>()
  const scanState = { count: 0 }

  const upsert = (scope: GraphFieldScope, key: string, value: unknown) => {
    const cleanedKey = String(key || '').trim()
    if (!cleanedKey) return
    if (value === undefined) return
    const id = `${scope}:${cleanedKey}` as const
    const current = byId.get(id)
    const kind = isJsonValue(value) ? toGraphFieldKindBase(value) : null
    if (!current) {
      byId.set(id, {
        scope,
        key: cleanedKey,
        kinds: kind ? new Set([kind]) : new Set(),
        hasUnknown: kind ? false : true,
        samples: 1,
      })
      return
    }
    if (kind) {
      current.kinds.add(kind)
    } else {
      current.hasUnknown = true
    }
    current.samples += 1
  }

  const walkNested = (
    scope: GraphFieldScope,
    prefix: string,
    value: JSONValue,
    depth: number,
    seen: Set<object>,
  ) => {
    if (scanState.count >= DERIVED_FIELD_NESTED_SCAN_LIMIT) return
    if (depth >= DERIVED_FIELD_NESTED_MAX_DEPTH) return
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return
    if (seen.has(value as object)) return
    seen.add(value as object)
    const rec = value as Record<string, unknown>
    for (const [childKey, childRaw] of Object.entries(rec)) {
      if (scanState.count >= DERIVED_FIELD_NESTED_SCAN_LIMIT) break
      const cleaned = String(childKey || '').trim()
      if (!cleaned) continue
      const nestedKey = `${prefix}.${cleaned}`
      upsert(scope, nestedKey, childRaw)
      scanState.count += 1
      if (!isJsonValue(childRaw)) continue
      walkNested(scope, nestedKey, childRaw, depth + 1, seen)
    }
    seen.delete(value as object)
  }

  for (const node of graphData.nodes || []) {
    const props = node?.properties || {}
    for (const [key, value] of Object.entries(props)) {
      upsert('node', key, value)
      if (isJsonValue(value)) {
        walkNested('node', key, value, 0, new Set<object>())
      }
    }
  }

  for (const edge of graphData.edges || []) {
    const props = edge?.properties || {}
    for (const [key, value] of Object.entries(props)) {
      upsert('edge', key, value)
      if (isJsonValue(value)) {
        walkNested('edge', key, value, 0, new Set<object>())
      }
    }
  }

  const fields: GraphField[] = []
  for (const [id, acc] of byId.entries()) {
    const kind: GraphFieldKind =
      acc.kinds.size === 0
        ? 'unknown'
        : acc.kinds.size === 1 && !acc.hasUnknown
          ? (Array.from(acc.kinds)[0] as GraphFieldKindBase)
          : 'mixed'
    fields.push({ id, scope: acc.scope, key: acc.key, kind, samples: acc.samples })
  }

  fields.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'node' ? -1 : 1
    return a.key.localeCompare(b.key)
  })

  return fields
}

export function getCachedDerivedFields(args: GetCachedDerivedFieldsArgs): ReadonlyArray<GraphField> {
  const graphData = args.graphData || null
  if (!graphData) return []
  const cacheKey = buildScopedGraphSemanticKey('graph-fields-derived', {
    graphData,
    graphRevision: args.graphRevision,
    graphSemanticKey: args.graphSemanticKey,
  })
  if (!cacheKey) return computeDerivedFields(graphData)
  const cached = readCachedDerivedFields(cacheKey)
  if (cached) return cached
  return writeCachedDerivedFields(cacheKey, computeDerivedFields(graphData))
}

export function defaultSettingsForField(field: GraphField): GraphFieldSettingsResolved {
  return {
    displayName: defaultDisplayNameForField(field),
    isHidden: false,
    fieldType: defaultFieldTypeForKind(field.kind),
    isCustom: false,
    description: '',
    defaultValue: null,
    selectOptions: [],
    decimalPlaces: 2,
    currencyCode: '',
    urlProtocol: 'any',
    dateTimeFormat: 'ISO',
  }
}

function normalizeSelectOptions(raw: unknown): ReadonlyArray<string> {
  if (!Array.isArray(raw)) return []
  const next: string[] = []
  const seen = new Set<string>()
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const cleaned = v.trim()
    if (!cleaned) continue
    if (seen.has(cleaned)) continue
    seen.add(cleaned)
    next.push(cleaned)
  }
  return next
}

export function normalizeSelectOptionsAndDefaultValue({
  fieldType,
  selectOptions,
  defaultValue,
}: {
  fieldType: GraphFieldType
  selectOptions: ReadonlyArray<string>
  defaultValue: JSONValue | null
}): { selectOptions: string[]; defaultValue: JSONValue | null } {
  const nextOptions: string[] = []
  const seen = new Set<string>()
  for (const raw of selectOptions) {
    const cleaned = String(raw || '').trim()
    if (!cleaned) continue
    if (seen.has(cleaned)) continue
    seen.add(cleaned)
    nextOptions.push(cleaned)
  }

  if (fieldType === 'Single-select') {
    if (typeof defaultValue !== 'string') return { selectOptions: nextOptions, defaultValue: null }
    return {
      selectOptions: nextOptions,
      defaultValue: nextOptions.includes(defaultValue) ? defaultValue : null,
    }
  }

  if (fieldType === 'Multi-select') {
    if (!Array.isArray(defaultValue)) return { selectOptions: nextOptions, defaultValue: null }
    const filtered = defaultValue.filter((v): v is string => typeof v === 'string' && nextOptions.includes(v))
    const stableUnique: string[] = []
    const stableSeen = new Set<string>()
    for (const v of filtered) {
      if (stableSeen.has(v)) continue
      stableSeen.add(v)
      stableUnique.push(v)
    }
    return { selectOptions: nextOptions, defaultValue: stableUnique.length > 0 ? stableUnique : null }
  }

  return { selectOptions: nextOptions, defaultValue }
}

export function normalizeSettingsForField(field: GraphField, settings: GraphFieldSettings | undefined): GraphFieldSettingsResolved {
  const base = defaultSettingsForField(field)
  if (!settings) return base
  const fieldType: GraphFieldType = GRAPH_FIELD_TYPES.includes(settings.fieldType as GraphFieldType)
    ? (settings.fieldType as GraphFieldType)
    : base.fieldType
  const description = typeof settings.description === 'string' ? settings.description : base.description
  const defaultValue = settings.defaultValue === null || isJsonValue(settings.defaultValue) ? settings.defaultValue : base.defaultValue
  const selectOptions = normalizeSelectOptions(settings.selectOptions)
  const decimalPlacesRaw = settings.decimalPlaces
  const decimalPlaces =
    typeof decimalPlacesRaw === 'number' && Number.isFinite(decimalPlacesRaw)
      ? Math.min(10, Math.max(0, Math.floor(decimalPlacesRaw)))
      : base.decimalPlaces
  const currencyCode = typeof settings.currencyCode === 'string' ? settings.currencyCode : base.currencyCode
  const urlProtocol = settings.urlProtocol === 'http' || settings.urlProtocol === 'https' || settings.urlProtocol === 'any'
    ? settings.urlProtocol
    : base.urlProtocol
  const dateTimeFormat = settings.dateTimeFormat === 'ISO' || settings.dateTimeFormat === 'Local' ? settings.dateTimeFormat : base.dateTimeFormat
  return {
    displayName: typeof settings.displayName === 'string' ? settings.displayName : base.displayName,
    isHidden: typeof settings.isHidden === 'boolean' ? settings.isHidden : base.isHidden,
    fieldType,
    isCustom: typeof settings.isCustom === 'boolean' ? settings.isCustom : base.isCustom,
    description,
    defaultValue,
    selectOptions,
    decimalPlaces,
    currencyCode,
    urlProtocol,
    dateTimeFormat,
  }
}

export function getCachedResolvedFieldSettingsById(args: {
  fields: ReadonlyArray<GraphField>
  settingsById: GraphFieldSettingsById
  graphSemanticKey?: string | null
}): Map<GraphFieldId, GraphFieldSettingsResolved> {
  const fields = Array.isArray(args.fields) ? args.fields : []
  if (fields.length === 0) return new Map<GraphFieldId, GraphFieldSettingsResolved>()
  const cacheKey = hashSignatureParts([
    'graph-fields-resolved-settings',
    String(args.graphSemanticKey || ''),
    buildResolvedFieldSettingsFieldSignature(fields),
    buildResolvedFieldSettingsSettingsSignature(fields, args.settingsById),
  ])
  const cached = readCachedResolvedFieldSettings(cacheKey)
  if (cached) return cached
  const resolvedSettingsById = new Map<GraphFieldId, GraphFieldSettingsResolved>()
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]
    resolvedSettingsById.set(field.id, normalizeSettingsForField(field, args.settingsById[field.id]))
  }
  return writeCachedResolvedFieldSettings(cacheKey, resolvedSettingsById)
}

export function defaultFieldTypeForKind(kind: GraphFieldKind): GraphFieldType {
  if (kind === 'string') return 'Single line text'
  if (kind === 'number') return 'Number'
  if (kind === 'boolean') return 'Checkbox'
  if (kind === 'null') return 'JSON'
  if (kind === 'array') return 'Multi-select'
  if (kind === 'object') return 'JSON'
  return 'Single line text'
}

export function fieldKindLabel(kind: GraphFieldKind): string {
  if (kind === 'string') return 'Single line text'
  if (kind === 'number') return 'Number'
  if (kind === 'boolean') return 'Checkbox'
  if (kind === 'null') return 'Null'
  if (kind === 'array') return 'Multi-select'
  if (kind === 'object') return 'JSON'
  if (kind === 'mixed') return 'Mixed'
  return 'Unknown'
}

export function inferFieldTypeFromGraphData(
  graphData: GraphData | null,
  field: GraphField | null,
): GraphFieldType | null {
  if (!graphData || !field) return null

  if (field.kind === 'boolean') return 'Checkbox'
  if (field.kind === 'null') return 'JSON'
  if (field.kind === 'object') return 'JSON'
  if (field.kind === 'mixed') return 'JSON'
  if (field.kind === 'array') return 'Multi-select'

  const keyHint = String(field.key || '').trim().toLowerCase()

  const ENTITY_SCAN_LIMIT = 5_000
  const scanNodes = (graphData.nodes || []).slice(0, ENTITY_SCAN_LIMIT)
  const scanEdges = (graphData.edges || []).slice(0, ENTITY_SCAN_LIMIT)

  const values: unknown[] = []
  const collectValue = (raw: unknown) => {
    if (raw === null || typeof raw === 'undefined') return
    values.push(raw)
  }

  if (field.scope === 'node') {
    for (const node of scanNodes) {
      const props = node?.properties || {}
      collectValue((props as Record<string, unknown>)[field.key])
    }
  } else {
    for (const edge of scanEdges) {
      const props = edge?.properties || {}
      collectValue((props as Record<string, unknown>)[field.key])
    }
  }

  if (field.kind === 'number') {
    let total = 0
    let integerCount = 0
    let decimalCount = 0

    for (const raw of values) {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
      total += 1
      if (Number.isInteger(raw)) integerCount += 1
      else decimalCount += 1
    }

    if (total === 0) return 'Number'

    const isCurrencyKey =
      keyHint.includes('currency') ||
      keyHint.includes('price') ||
      keyHint.includes('cost') ||
      keyHint.includes('amount') ||
      keyHint.endsWith('_usd') ||
      keyHint.endsWith('_eur') ||
      keyHint.endsWith('_gbp') ||
      keyHint.endsWith('_jpy')

    if (isCurrencyKey) return 'Currency'
    if (decimalCount > 0 && integerCount > 0) return 'Decimal'
    if (decimalCount > 0 && integerCount === 0) return 'Decimal'
    return 'Number'
  }

  if (field.kind === 'string') {
    const isUrlHint =
      keyHint.includes('url') ||
      keyHint.includes('uri') ||
      keyHint.includes('href') ||
      keyHint.includes('link')
    const isDateTimeHint =
      keyHint.includes('date') ||
      keyHint.includes('time') ||
      keyHint.includes('timestamp') ||
      keyHint.endsWith('_at')

    const isUrlValue = (v: string) => {
      const t = v.trim()
      if (!t) return false
      return /^https?:\/\//i.test(t) || /^www\./i.test(t) || /^mailto:/i.test(t)
    }

    const isDateTimeValue = (v: string) => {
      const t = v.trim()
      if (!t) return false
      if (/^\d{10,13}$/.test(t)) return true
      if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return false
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(t) ||
        /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(t)
      )
    }

    let total = 0
    let urlCount = 0
    let dateTimeCount = 0
    let maxLen = 0
    let lenSum = 0
    const unique = new Set<string>()
    const UNIQUE_LIMIT = 1_000

    for (const raw of values) {
      if (typeof raw !== 'string') continue
      const t = raw.trim()
      if (!t) continue
      total += 1
      const len = t.length
      lenSum += len
      if (len > maxLen) maxLen = len
      if (unique.size < UNIQUE_LIMIT) unique.add(t)
      if (isUrlValue(t)) urlCount += 1
      if (isDateTimeValue(t)) dateTimeCount += 1
    }

    if (total === 0) return 'Single line text'

    const urlRatio = urlCount / total
    const dateRatio = dateTimeCount / total
    const avgLen = lenSum / total

    if (urlRatio >= 0.6 || (isUrlHint && urlCount > 0)) return 'URL'
    if (dateRatio >= 0.6 || (isDateTimeHint && dateTimeCount > 0)) return 'Date Time'

    if (avgLen >= 80 || maxLen >= 200) return 'Long text'

    if (unique.size > 0 && unique.size <= 20 && total >= unique.size * 2 && maxLen <= 80) {
      return 'Single-select'
    }

    return 'Single line text'
  }

  return defaultFieldTypeForKind(field.kind)
}
