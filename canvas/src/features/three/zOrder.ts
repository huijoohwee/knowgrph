type VisualProps = Record<string, unknown> | null | undefined

const readNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function readThreeRenderOrderOffset(props: VisualProps): number {
  if (!props) return 0

  const raw =
    readNumber(props['visual:zIndex']) ??
    readNumber(props['visual:depth']) ??
    readNumber(props['visual:z']) ??
    readNumber(props['zIndex']) ??
    readNumber(props['z'])

  if (raw == null) return 0

  const clamped = Math.max(-4, Math.min(4, Math.round(raw)))
  return clamped
}
