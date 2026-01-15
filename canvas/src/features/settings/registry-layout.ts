import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const layoutSettingsRegistry: SettingMeta[] = [
  // Mermaid Layout Settings
  {
    key: 'layout.mermaid.orientation',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      return schema.layout?.mermaid?.orientation || 'vertical'
    },
    write: (v) => {
      const schema = s().schema
      const current = schema.layout || {}
      const mermaid = current.mermaid || {}
      s().setSchema({
        ...schema,
        layout: {
          ...current,
          mermaid: { ...mermaid, orientation: String(v) as 'vertical' | 'horizontal' },
        },
      })
    },
    docKey: 'layout.mermaid.orientation',
    default: () => 'vertical',
    options: ['vertical', 'horizontal'],
  },
  {
    key: 'layout.mermaid.direction',
    type: 'string',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      return schema.layout?.mermaid?.direction || 'source-target'
    },
    write: (v) => {
      const schema = s().schema
      const current = schema.layout || {}
      const mermaid = current.mermaid || {}
      s().setSchema({
        ...schema,
        layout: {
          ...current,
          mermaid: { ...mermaid, direction: String(v) as 'source-target' | 'target-source' },
        },
      })
    },
    docKey: 'layout.mermaid.direction',
    default: () => 'source-target',
    options: ['source-target', 'target-source'],
  },
  {
    key: 'layout.mermaid.separation',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      return schema.layout?.mermaid?.separation ?? 1.0
    },
    write: (v) => {
      const schema = s().schema
      const current = schema.layout || {}
      const mermaid = current.mermaid || {}
      s().setSchema({
        ...schema,
        layout: {
          ...current,
          mermaid: { ...mermaid, separation: Number(v) },
        },
      })
    },
    docKey: 'layout.mermaid.separation',
    default: () => 1.0,
  },
  {
    key: 'layout.fitPadding',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      return schema.layout?.fitPadding ?? 80
    },
    write: (v) => {
      const schema = s().schema
      const current = schema.layout || {}
      s().setSchema({
        ...schema,
        layout: {
          ...current,
          fitPadding: Number(v),
        },
      })
    },
    docKey: 'layout.fitPadding',
    default: () => 80,
  },
  {
    key: 'layout.mermaid.nodeRadius',
    type: 'number',
    source: 'store',
    read: () => {
      const schema = s().schema as GraphSchema
      return schema.layout?.mermaid?.nodeRadius ?? 0
    },
    write: (v) => {
      const schema = s().schema
      const current = schema.layout || {}
      const mermaid = current.mermaid || {}
      s().setSchema({
        ...schema,
        layout: {
          ...current,
          mermaid: { ...mermaid, nodeRadius: Number(v) },
        },
      })
    },
    docKey: 'layout.mermaid.nodeRadius',
    default: () => 0,
  },
]
