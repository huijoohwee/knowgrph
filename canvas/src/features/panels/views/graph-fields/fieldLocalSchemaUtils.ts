import type { GraphData, JSONValue } from '@/lib/graph/types'
import type { GraphSchema, PropertySpec } from '@/lib/graph/schema'

type PropertyType = PropertySpec['type']

export type FieldLocalSchemaPropertySuggestions = {
  keys: string[]
  typeByKey: Record<string, PropertyType>
  sampleByKey: Record<string, JSONValue | null>
  enumByKey: Record<string, string[]>
}

export function computeFieldLocalSchemaPropertySuggestions(args: {
  graphData: GraphData | null
  hasLocalSchemaOwner: boolean
  localSchemaFacet: 'properties' | 'validation' | 'template' | 'localRules' | null
  localSchemaOwnerKey: string
  localSchemaScope: 'node' | 'edge'
}): FieldLocalSchemaPropertySuggestions {
  type Acc = {
    typeCounts: Record<PropertyType, number>
    sample: JSONValue | null
    stringCounts?: Map<string, number>
    stringTotal: number
    stringTruncated: boolean
  }

  const empty: FieldLocalSchemaPropertySuggestions = {
    keys: [],
    typeByKey: {},
    sampleByKey: {},
    enumByKey: {},
  }

  const { graphData, hasLocalSchemaOwner, localSchemaFacet, localSchemaOwnerKey, localSchemaScope } = args

  if (!graphData) return empty
  if (!hasLocalSchemaOwner) return empty
  if (localSchemaFacet !== 'properties') return empty

  const acc: Record<string, Acc> = {}
  const MAX_ENUM_LEN = 40
  const MAX_ENUM_UNIQUE = 20

  const visit = (props: Record<string, unknown>) => {
    Object.entries(props).forEach(([rawKey, rawValue]) => {
      const key = String(rawKey || '').trim()
      if (!key) return
      const value = rawValue as JSONValue
      if (value === null || typeof value === 'undefined') return
      let t: PropertyType | null = null
      if (typeof value === 'string') t = 'string'
      else if (typeof value === 'number') t = 'number'
      else if (typeof value === 'boolean') t = 'boolean'
      else if (Array.isArray(value)) t = 'array'
      else if (typeof value === 'object') t = 'object'
      if (!t) return
      const current: Acc =
        acc[key] ||
        {
          typeCounts: {
            string: 0,
            number: 0,
            boolean: 0,
            array: 0,
            object: 0,
          },
          sample: null,
          stringCounts: undefined,
          stringTotal: 0,
          stringTruncated: false,
        }
      current.typeCounts[t] += 1
      if (current.sample == null) current.sample = value
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed && trimmed.length <= MAX_ENUM_LEN) {
          current.stringTotal += 1
          if (!current.stringTruncated) {
            const map = current.stringCounts || new Map<string, number>()
            const nextCount = (map.get(trimmed) || 0) + 1
            map.set(trimmed, nextCount)
            if (map.size > MAX_ENUM_UNIQUE) {
              current.stringCounts = undefined
              current.stringTruncated = true
            } else {
              current.stringCounts = map
            }
          }
        }
      }
      acc[key] = current
    })
  }

  if (localSchemaScope === 'node') {
    for (const node of graphData.nodes || []) {
      const typeKey = String(node.type || '').trim()
      if (!typeKey || typeKey !== localSchemaOwnerKey) continue
      const props = (node.properties || {}) as Record<string, unknown>
      visit(props)
    }
  } else {
    for (const edge of graphData.edges || []) {
      const label = String(edge.label || '').trim()
      if (!label || label !== localSchemaOwnerKey) continue
      const props = (edge.properties || {}) as Record<string, unknown>
      visit(props)
    }
  }

  const keys = Object.keys(acc).sort()
  const typeByKey: Record<string, PropertyType> = {}
  const sampleByKey: Record<string, JSONValue | null> = {}
  const enumByKey: Record<string, string[]> = {}

  keys.forEach(k => {
    const entry = acc[k]
    const counts = entry.typeCounts
    let best: PropertyType = 'string'
    let bestCount = -1
    ;(['string', 'number', 'boolean', 'array', 'object'] as PropertyType[]).forEach(pt => {
      const c = counts[pt] || 0
      if (c > bestCount) {
        best = pt
        bestCount = c
      }
    })
    typeByKey[k] = best
    sampleByKey[k] = entry.sample
    if (entry.stringCounts && entry.stringTotal > 0) {
      const entries = Array.from(entry.stringCounts.entries())
      entries.sort((a, b) => {
        const diff = b[1] - a[1]
        if (diff !== 0) return diff
        return a[0].localeCompare(b[0])
      })
      const candidates = entries.map(([v]) => v)
      const limited = candidates.slice(0, 12)
      if (
        limited.length > 0 &&
        limited.length <= MAX_ENUM_UNIQUE &&
        entry.stringTotal >= limited.length * 2
      ) {
        enumByKey[k] = limited
      }
    }
  })

  return { keys, typeByKey, sampleByKey, enumByKey }
}

export function computeFieldLocalSchemaValidationWarnings(args: {
  schema: GraphSchema | null
  hasLocalSchemaOwner: boolean
  localSchemaFacet: 'properties' | 'validation' | 'template' | 'localRules' | null
  localSchemaOwnerKey: string
  localSchemaScope: 'node' | 'edge'
  localValidationRequiredSet: Set<string>
  localValidationTypesMap: Record<string, PropertySpec['type']>
}): Array<
  | { kind: 'requiredMissingSchema'; keys: string[] }
  | {
      kind: 'typeMismatch'
      items: {
        key: string
        schemaType: PropertySpec['type'] | undefined
        validationType: PropertySpec['type']
      }[]
    }
> {
  const {
    schema,
    hasLocalSchemaOwner,
    localSchemaFacet,
    localSchemaOwnerKey,
    localSchemaScope,
    localValidationRequiredSet,
    localValidationTypesMap,
  } = args

  if (localSchemaFacet !== 'validation') return []
  if (!schema || !hasLocalSchemaOwner) return []

  const ownerKey = String(localSchemaOwnerKey || '').trim()
  if (!ownerKey) return []

  const propsForOwner =
    localSchemaScope === 'node'
      ? schema.propertySchemas?.node?.[ownerKey] ?? {}
      : schema.propertySchemas?.edge?.[ownerKey] ?? {}

  const knownKeys = new Set(Object.keys(propsForOwner))
  const nextWarnings: Array<
    | { kind: 'requiredMissingSchema'; keys: string[] }
    | {
        kind: 'typeMismatch'
        items: {
          key: string
          schemaType: PropertySpec['type'] | undefined
          validationType: PropertySpec['type']
        }[]
      }
  > = []

  if (knownKeys.size === 0) return nextWarnings

  const unknownRequired: string[] = []
  localValidationRequiredSet.forEach(k => {
    if (!knownKeys.has(k)) unknownRequired.push(k)
  })
  if (unknownRequired.length > 0) {
    nextWarnings.push({
      kind: 'requiredMissingSchema',
      keys: unknownRequired,
    })
  }

  const mismatchItems: {
    key: string
    schemaType: PropertySpec['type'] | undefined
    validationType: PropertySpec['type']
  }[] = []
  Object.entries(localValidationTypesMap).forEach(([key, t]) => {
    if (!knownKeys.has(key)) return
    const spec = propsForOwner[key]
    const specType = spec ? spec.type : undefined
    if (specType && specType !== t) {
      mismatchItems.push({
        key,
        schemaType: specType,
        validationType: t,
      })
    }
  })
  if (mismatchItems.length > 0) {
    nextWarnings.push({
      kind: 'typeMismatch',
      items: mismatchItems,
    })
  }

  return nextWarnings
}

