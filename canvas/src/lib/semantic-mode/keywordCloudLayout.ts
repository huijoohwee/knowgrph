export type KeywordCloudInput = {
  id: string
  label: string
  weight: number
  rank: number
}

export type KeywordCloudPlacement = {
  xIndex: number
  yIndex: number
  fontSizePx: number
  rotateDeg: number
  opacity: number
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

const hash01 = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

const estimateWordBox = (label: string, fontSizePx: number, rotateDeg: number): { w: number; h: number } => {
  const textW = Math.max(fontSizePx * 1.4, String(label || '').length * fontSizePx * 0.56)
  const textH = Math.max(fontSizePx, fontSizePx * 1.18)
  const a = Math.abs(rotateDeg % 180)
  if (a > 72 && a < 108) return { w: textH + 10, h: textW + 10 }
  if (a > 4) return { w: textW * 1.08 + textH * 0.2, h: textH * 1.08 + textW * 0.12 }
  return { w: textW + 10, h: textH + 10 }
}

export const computeKeywordCloudPlacements = (
  input: KeywordCloudInput[],
  opts?: { maxItems?: number },
): Map<string, KeywordCloudPlacement> => {
  const maxItems = Math.max(12, Math.min(220, Math.floor(opts?.maxItems ?? 180)))
  const items = input
    .map(item => ({
      id: String(item.id || '').trim(),
      label: String(item.label || '').trim(),
      weight: typeof item.weight === 'number' && Number.isFinite(item.weight) ? Math.max(0, item.weight) : 0,
      rank: typeof item.rank === 'number' && Number.isFinite(item.rank) ? Math.max(1, Math.floor(item.rank)) : 9999,
    }))
    .filter(item => item.id && item.label)
    .sort((a, b) => b.weight - a.weight || a.rank - b.rank || a.id.localeCompare(b.id))
    .slice(0, maxItems)

  const out = new Map<string, KeywordCloudPlacement>()
  if (items.length === 0) return out
  const maxWeight = Math.max(1, ...items.map(item => item.weight))
  const minWeight = Math.min(...items.map(item => item.weight))
  const span = Math.max(1e-6, maxWeight - minWeight)
  const occupied = new Set<string>()
  const cell = 8

  const rectCells = (cx: number, cy: number, w: number, h: number): string[] => {
    const minX = Math.floor((cx - w / 2) / cell)
    const maxX = Math.ceil((cx + w / 2) / cell)
    const minY = Math.floor((cy - h / 2) / cell)
    const maxY = Math.ceil((cy + h / 2) / cell)
    const cells: string[] = []
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) cells.push(`${x}:${y}`)
    }
    return cells
  }

  const canPlace = (cells: string[]): boolean => !cells.some(key => occupied.has(key))
  const occupy = (cells: string[]): void => {
    for (let i = 0; i < cells.length; i += 1) occupied.add(cells[i]!)
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!
    const weightNorm = clamp((item.weight - minWeight) / span, 0, 1)
    const fontSizePx = Math.round(15 + Math.sqrt(weightNorm) * 31)
    const rotateDeg = (() => {
      const h = hash01(`${item.id}:rotate`)
      if (item.label.length > 18) return h < 0.18 ? -12 : h > 0.82 ? 12 : 0
      if (h < 0.08) return -24
      if (h > 0.92) return 24
      if (h > 0.74 && item.label.length <= 10) return 90
      return 0
    })()
    const box = estimateWordBox(item.label, fontSizePx, rotateDeg)
    let placed: { x: number; y: number } | null = null
    const maxSteps = 1400 + i * 8
    for (let step = 0; step < maxSteps; step += 1) {
      const theta = step * 0.46
      const radius = step === 0 ? 0 : 3.1 * theta
      const dir = hash01(`${item.id}:dir`) < 0.5 ? -1 : 1
      const x = Math.cos(theta * dir) * radius
      const y = Math.sin(theta * dir) * radius * 0.72
      const cells = rectCells(x, y, box.w, box.h)
      if (!canPlace(cells)) continue
      occupy(cells)
      placed = { x, y }
      break
    }
    if (!placed) {
      const angle = i * 2.399963229728653
      const radius = 120 + Math.sqrt(i + 1) * 64
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * 0.72
      occupy(rectCells(x, y, box.w, box.h))
      placed = { x, y }
    }
    out.set(item.id, {
      xIndex: Number((placed.x / 110).toFixed(4)),
      yIndex: Number((placed.y / 110).toFixed(4)),
      fontSizePx,
      rotateDeg,
      opacity: Number((0.62 + weightNorm * 0.38).toFixed(3)),
    })
  }
  return out
}
