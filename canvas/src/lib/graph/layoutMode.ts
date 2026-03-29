import type { GraphSchema } from '@/lib/graph/schema'

export type LayoutMode2d = 'radial' | 'block'

export function readLayoutMode2d(schema: GraphSchema): LayoutMode2d {
  const m = schema.layout?.mode
  if (m === 'block') return 'block'
  return 'radial'
}

export function layoutModeRequires2d(mode: LayoutMode2d): boolean {
  return mode === 'block'
}
