import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import { validateSchema } from './validation'

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const sortStrings = (value: unknown): string[] => {
  return Array.isArray(value)
    ? value.map(v => String(v || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
    : []
}

const canonicalizeValidationRules = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) {
      out[key] = raw
      continue
    }
    const next: Record<string, unknown> = { ...raw }
    if ('required' in next) next.required = sortStrings(next.required)
    if ('uniqueness' in next) next.uniqueness = sortStrings(next.uniqueness)
    out[key] = next
  }
  return out
}

const deepSortJson = (value: unknown): JsonLike => {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map(item => deepSortJson(item))
  if (typeof value !== 'object') return value as JsonLike
  const obj = value as Record<string, unknown>
  const out: Record<string, JsonLike> = {}
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]
    const next = deepSortJson(obj[key])
    if (next === null && (obj[key] === undefined || (isRecord(obj[key]) && Object.keys(obj[key] as Record<string, unknown>).length === 0))) continue
    out[key] = next
  }
  return out
}

const stripDefaults = (value: unknown, base: unknown): unknown => {
  if (Array.isArray(value)) {
    if (Array.isArray(base) && value.length === base.length && value.every((item, idx) => JSON.stringify(item) === JSON.stringify(base[idx]))) {
      return undefined
    }
    return value.map(item => stripDefaults(item, undefined)).filter(item => item !== undefined)
  }
  if (!isRecord(value)) {
    if (base !== undefined && JSON.stringify(value) === JSON.stringify(base)) return undefined
    return value
  }
  const baseRecord = isRecord(base) ? base : {}
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value)) {
    const next = stripDefaults(value[key], baseRecord[key])
    if (next === undefined) continue
    if (isRecord(next) && Object.keys(next).length === 0) continue
    if (Array.isArray(next) && next.length === 0) continue
    out[key] = next
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const stripPersistedLabelStyleDefaults = (schema: GraphSchema): GraphSchema => {
  const labelStyles = schema.labelStyles
  if (!isRecord(labelStyles)) return schema
  const normalizeHex = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '')
  const nextLabelStyles: Record<string, unknown> = { ...(labelStyles as Record<string, unknown>) }
  const color = normalizeHex(nextLabelStyles.color)
  if (color === '#111111' || color === '#111') {
    delete nextLabelStyles.color
  }
  const halo = isRecord(nextLabelStyles.halo) ? { ...(nextLabelStyles.halo as Record<string, unknown>) } : null
  if (halo) {
    const haloColor = normalizeHex(halo.color)
    if (haloColor === '#ffffff' || haloColor === '#fff') {
      delete halo.color
    }
    if (Object.keys(halo).length > 0) nextLabelStyles.halo = halo
    else delete nextLabelStyles.halo
  }
  return { ...schema, labelStyles: nextLabelStyles as GraphSchema['labelStyles'] }
}

export const canonicalizeSchemaForPersistence = (schema: GraphSchema | null | undefined): GraphSchema | null => {
  if (!schema) return null
  const validated = validateSchema(schema)
  const next: GraphSchema = {
    ...stripPersistedLabelStyleDefaults(validated),
    catalog: {
      ...(validated.catalog || {}),
      nodeTypes: sortStrings(validated.catalog?.nodeTypes),
      edgeLabels: sortStrings(validated.catalog?.edgeLabels),
    },
    validation: deepSortJson({
      node: canonicalizeValidationRules(validated.validation?.node),
      edge: canonicalizeValidationRules(validated.validation?.edge),
    }) as GraphSchema['validation'],
    endpointMatrix: deepSortJson(validated.endpointMatrix) as GraphSchema['endpointMatrix'],
  }
  return deepSortJson(stripDefaults(next, defaultSchema) ?? {}) as GraphSchema
}

export const stringifyCanonicalSchema = (schema: GraphSchema | null | undefined): string => {
  const canonical = canonicalizeSchemaForPersistence(schema)
  return JSON.stringify(canonical || null)
}
