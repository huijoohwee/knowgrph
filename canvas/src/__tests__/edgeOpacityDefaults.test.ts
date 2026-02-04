import { readEdgeOpacity2d } from '@/lib/graph/layoutDefaults'
import { defaultSchema } from '@/lib/graph/schema'

export const testEdgeOpacityUsesUnderGroupOpacityWhenGroupsEnabled = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      edges: { opacity: 0.9, opacityUnderGroups: 0.3 },
      groups: { ...(defaultSchema.layout?.groups || {}), enabled: true },
    },
  }
  const v = readEdgeOpacity2d(schema)
  if (Math.abs(v - 0.3) > 1e-6) {
    throw new Error(`expected 0.3, got ${String(v)}`)
  }
}

export const testEdgeOpacityUsesBaseOpacityWhenGroupsDisabled = () => {
  const schema = {
    ...defaultSchema,
    layout: {
      ...(defaultSchema.layout || {}),
      edges: { opacity: 0.8, opacityUnderGroups: 0.1 },
      groups: { ...(defaultSchema.layout?.groups || {}), enabled: false },
    },
  }
  const v = readEdgeOpacity2d(schema)
  if (Math.abs(v - 0.8) > 1e-6) {
    throw new Error(`expected 0.8, got ${String(v)}`)
  }
}

