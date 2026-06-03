export type ArrangeAction =
  | 'align-left'
  | 'align-center-x'
  | 'align-right'
  | 'align-top'
  | 'align-center-y'
  | 'align-bottom'
  | 'distribute-x'
  | 'distribute-y'

export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  const tag = String(el?.tagName || '').toUpperCase()
  if (!tag) return false
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el?.isContentEditable) return true
  return false
}

export const readArrangeShortcut = (e: KeyboardEvent): ArrangeAction | null => {
  if (!(e.altKey && e.shiftKey)) return null
  if (e.metaKey || e.ctrlKey) return null
  const k = String(e.key || '').toLowerCase()
  switch (k) {
    case 'l':
      return 'align-left'
    case 'h':
      return 'align-center-x'
    case 'r':
      return 'align-right'
    case 't':
      return 'align-top'
    case 'v':
      return 'align-center-y'
    case 'b':
      return 'align-bottom'
    case 'x':
      return 'distribute-x'
    case 'y':
      return 'distribute-y'
    default:
      return null
  }
}

export const readNudgeDelta = (args: {
  e: KeyboardEvent
  snapGridEnabled: boolean
  snapGridSize: number
  snapGridSizeY?: number
}): { dx: number; dy: number } | null => {
  const { e } = args
  if (e.metaKey || e.ctrlKey) return null
  const key = String(e.key || '')
  if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return null

  const gridSizeX = Math.max(1, Math.floor(args.snapGridSize || 1))
  const gridSizeY = Math.max(1, Math.floor(args.snapGridSizeY || args.snapGridSize || 1))
  const canSnap = args.snapGridEnabled && !e.altKey
  const mult = e.shiftKey ? 10 : 1
  const stepX = canSnap ? gridSizeX * (e.shiftKey ? 5 : 1) : mult
  const stepY = canSnap ? gridSizeY * (e.shiftKey ? 5 : 1) : mult

  if (key === 'ArrowLeft') return { dx: -stepX, dy: 0 }
  if (key === 'ArrowRight') return { dx: stepX, dy: 0 }
  if (key === 'ArrowUp') return { dx: 0, dy: -stepY }
  if (key === 'ArrowDown') return { dx: 0, dy: stepY }
  return null
}
