import type { GraphSchema } from '@/lib/graph/schema'

export function buildStratifyLayoutVariant(schema: GraphSchema | null | undefined): string {
  const stratify = schema?.layout?.stratify || null
  const orientation = stratify?.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  const groupRoots = stratify?.groupRoots !== false ? '1' : '0'
  const grid = stratify?.grid || null
  const gridEnabled = grid?.enabled !== false ? '1' : '0'
  const gridSize = typeof grid?.size === 'number' && Number.isFinite(grid.size) ? String(Math.floor(grid.size)) : ''
  const antiLine = stratify?.antiLine || null
  const antiLineEnabled = antiLine?.enabled !== false ? '1' : '0'
  const wrapRows = typeof antiLine?.wrapRows === 'number' && Number.isFinite(antiLine.wrapRows) ? String(Math.floor(antiLine.wrapRows)) : ''
  const maxAspectRatio =
    typeof antiLine?.maxAspectRatio === 'number' && Number.isFinite(antiLine.maxAspectRatio)
      ? String(Math.round(antiLine.maxAspectRatio * 100) / 100)
      : ''
  return [
    `o=${orientation}`,
    `gr=${groupRoots}`,
    `g=${gridEnabled}${gridSize ? `:${gridSize}` : ''}`,
    `al=${antiLineEnabled}${wrapRows || maxAspectRatio ? `:${wrapRows || ''}:${maxAspectRatio || ''}` : ''}`,
  ].join('|')
}

