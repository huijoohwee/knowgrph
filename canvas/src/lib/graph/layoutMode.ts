import type { GraphSchema } from '@/lib/graph/schema'

export type LayoutMode2d = 'force' | 'radial' | 'stratify'

export function readLayoutMode2d(schema: GraphSchema): LayoutMode2d {
  const m = schema.layout?.mode
  return m === 'radial' || m === 'stratify' ? m : 'force'
}

export function layoutModeRequires2d(mode: LayoutMode2d): boolean {
  return mode === 'radial' || mode === 'stratify'
}

