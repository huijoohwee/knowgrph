export function formatZoomPercent(k: number | null | undefined): string {
  const safe = typeof k === 'number' && Number.isFinite(k) && k > 0 ? k : 1
  return `${Math.round(safe * 100)}%`
}

export function formatSignedPx(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0
  return v >= 0 ? `+${v}` : String(v)
}
