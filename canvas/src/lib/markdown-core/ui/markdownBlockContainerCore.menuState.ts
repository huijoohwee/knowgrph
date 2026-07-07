export type SlashMenuKind = 'slash' | 'semantic'

export type SlashMenuState = {
  show: boolean
  leftPx: number
  topPx: number
  kind?: SlashMenuKind
  query?: string
  triggerRange?: { startOffset: number; endOffset: number } | null
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
  const kind = next.kind || 'slash'
  const query = typeof next.query === 'string' ? next.query : ''
  const triggerRange = next.triggerRange || null
  if (
    prev.show === next.show &&
    Math.abs(prev.leftPx - next.leftPx) < 1 &&
    Math.abs(prev.topPx - next.topPx) < 1 &&
    (prev.kind || 'slash') === kind &&
    (prev.query || '') === query &&
    (prev.triggerRange?.startOffset ?? -1) === (triggerRange?.startOffset ?? -1) &&
    (prev.triggerRange?.endOffset ?? -1) === (triggerRange?.endOffset ?? -1)
  ) return prev
  return { ...next, kind, query, triggerRange }
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
