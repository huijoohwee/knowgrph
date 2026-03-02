const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function readCanvasLocalPoint(args: {
  canvasEl: HTMLCanvasElement
  event: { offsetX?: unknown; offsetY?: unknown; clientX?: unknown; clientY?: unknown; target?: unknown; currentTarget?: unknown }
}): { sx: number; sy: number; inBounds: boolean } | null {
  const { canvasEl, event } = args

  const offsetX = event.offsetX
  const offsetY = event.offsetY
  const target = (event as unknown as { target?: unknown }).target
  const currentTarget = (event as unknown as { currentTarget?: unknown }).currentTarget
  const allowOffsetXY = target === canvasEl || currentTarget === canvasEl
  if (allowOffsetXY && isFiniteNumber(offsetX) && isFiniteNumber(offsetY)) {
    const w = canvasEl.clientWidth
    const h = canvasEl.clientHeight
    const inBounds = offsetX >= 0 && offsetY >= 0 && offsetX <= w && offsetY <= h
    return { sx: offsetX, sy: offsetY, inBounds }
  }

  const clientX = event.clientX
  const clientY = event.clientY
  if (!isFiniteNumber(clientX) || !isFiniteNumber(clientY)) return null
  const rect = canvasEl.getBoundingClientRect()
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  const inBounds = sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height
  return { sx, sy, inBounds }
}

export function readElementLocalPoint(args: {
  el: Element
  event: { clientX?: unknown; clientY?: unknown }
}): { sx: number; sy: number; inBounds: boolean } | null {
  const { el, event } = args
  const clientX = event.clientX
  const clientY = event.clientY
  if (!isFiniteNumber(clientX) || !isFiniteNumber(clientY)) return null
  const rect = el.getBoundingClientRect()
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  const inBounds = sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height
  return { sx, sy, inBounds }
}
