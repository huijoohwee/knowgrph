import { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'

type PropertyType = 'string' | 'number' | 'boolean' | 'array' | 'object'

export function getSchemaBaseForUiApply(fallback: GraphSchema): GraphSchema {
  try {
    const current = useGraphStore.getState().schema
    return current || fallback
  } catch {
    return fallback
  }
}

export function buildMergedValidation(
  parsed: Record<string, unknown>,
  required: Set<string>,
  types: Record<string, PropertyType>,
): { required: string[]; types: Record<string, PropertyType> } & Record<string, unknown> {
  return { ...parsed, required: Array.from(required), types }
}

export function withLayoutNumbers(schema: GraphSchema, charge: number, centerStrength: number, alphaDecay: number, fitPadding: number) {
  return {
    ...schema,
    layout: {
      ...(schema.layout ?? {}),
      forces: {
        ...(schema.layout?.forces ?? {}),
        charge,
        centerStrength,
        alphaDecay,
        linkDistanceByLabel: schema.layout?.forces?.linkDistanceByLabel ?? {},
        collisionByType: schema.layout?.forces?.collisionByType ?? {},
      },
      fitPadding,
    },
  } as GraphSchema
}

export function withLinkDistances(schema: GraphSchema, linkDistances: Record<string, number>) {
  return {
    ...schema,
    layout: {
      ...(schema.layout ?? {}),
      forces: {
        ...(schema.layout?.forces ?? {}),
        linkDistanceByLabel: linkDistances,
      },
    },
  } as GraphSchema
}

export function withCollisionByType(schema: GraphSchema, collision: Record<string, number>) {
  return {
    ...schema,
    layout: {
      ...(schema.layout ?? {}),
      forces: {
        ...(schema.layout?.forces ?? {}),
        collisionByType: collision,
      },
    },
  } as GraphSchema
}

export function resolveSelectedKey(availableKeys: string[], selectedKey: string): string {
  if (availableKeys.length === 0) return ''
  const cleaned = typeof selectedKey === 'string' ? selectedKey.trim() : ''
  if (cleaned && availableKeys.includes(cleaned)) return cleaned
  return availableKeys[0]
}
