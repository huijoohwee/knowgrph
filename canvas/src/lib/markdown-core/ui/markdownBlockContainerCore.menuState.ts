export type SlashMenuState = {
  show: boolean
  leftPx: number
  topPx: number
}

export type VariableMenuState = {
  show: boolean
  leftPx: number
  topPx: number
  query: string
  keyInput: string
  valueInput: string
  fallbackInput: string
  mode: 'ref' | 'create' | 'update' | 'fallback'
}

export const toStableSlashMenuState = (
  prev: SlashMenuState,
  next: SlashMenuState,
): SlashMenuState => {
  if (
    prev.show === next.show &&
    Math.abs(prev.leftPx - next.leftPx) < 1 &&
    Math.abs(prev.topPx - next.topPx) < 1
  ) return prev
  return next
}

export const toStableVariableMenuState = (
  prev: VariableMenuState,
  next: {
    show: boolean
    leftPx: number
    topPx: number
    query?: string
    keyInput?: string
  },
): VariableMenuState => {
  const query = typeof next.query === 'string' ? next.query : prev.query
  const keyInput = typeof next.keyInput === 'string' ? next.keyInput : prev.keyInput
  if (
    prev.show === next.show &&
    Math.abs(prev.leftPx - next.leftPx) < 1 &&
    Math.abs(prev.topPx - next.topPx) < 1 &&
    prev.query === query &&
    prev.keyInput === keyInput
  ) return prev
  return { ...prev, show: next.show, leftPx: next.leftPx, topPx: next.topPx, query, keyInput }
}

