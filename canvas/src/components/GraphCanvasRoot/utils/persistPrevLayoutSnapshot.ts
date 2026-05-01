import { buildLayoutPositionCacheKey } from '@/components/GraphCanvas/layout/positioning'

export function persistPrevLayoutSnapshot(args: {
  prevPositions: Record<string, { x: number; y: number }>
  prevDatasetKey: string | null
  prevMode: 'radial' | 'block' | null
  prevFrontmatterMode: boolean | null
  prevSemanticMode: string | null
  prevViewKey: string | null
  prevRenderMode: '2d' | '3d'
  prevRenderVariant: string
  prevLayoutVariant: string | null
  setLayoutPositionsForMode: (key: string, positions: Record<string, { x: number; y: number }>) => void
}): void {
  if (Object.keys(args.prevPositions).length === 0) return
  if (!args.prevDatasetKey || !args.prevMode || args.prevFrontmatterMode == null || !args.prevSemanticMode) return

  const key = buildLayoutPositionCacheKey({
    datasetKey: args.prevDatasetKey,
    mode: args.prevMode,
    frontmatterMode: args.prevFrontmatterMode,
    semanticMode: args.prevSemanticMode,
    renderMode: args.prevRenderMode,
    renderVariant: args.prevRenderVariant || undefined,
    layoutVariant: args.prevLayoutVariant || undefined,
    viewKey: args.prevViewKey || undefined,
  })
  args.setLayoutPositionsForMode(key, args.prevPositions)
}
