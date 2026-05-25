export type AnimaticTimelineHotkeyAction =
  | 'toggle-playback'
  | 'step-prev-beat'
  | 'step-next-beat'
  | 'reset-playhead'
  | 'duplicate-beat'
  | 'split-beat'
  | 'edit-beat-label'
  | 'edit-beat-note'
  | 'edit-beat-summary'
  | 'edit-beat-tags'
  | 'toggle-lane-hidden'
  | 'toggle-lane-muted'
  | 'toggle-lane-solo'
  | 'move-lane-up'
  | 'move-lane-down'
  | 'move-selected-item-prev-beat'
  | 'move-selected-item-next-beat'

type ResolveAnimaticTimelineHotkeyActionArgs = {
  code?: string | null
  key?: string | null
}

type ShouldIgnoreAnimaticTimelineHotkeysArgs = {
  defaultPrevented?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  editingBeat?: boolean
  dragging?: boolean
  targetTagName?: string | null
  targetRole?: string | null
  targetContentEditable?: boolean
}

const HOTKEY_TAG_BLOCKLIST = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'])
const HOTKEY_ROLE_BLOCKLIST = new Set(['button', 'link', 'textbox'])

export function resolveAnimaticTimelineHotkeyAction(
  args: ResolveAnimaticTimelineHotkeyActionArgs,
): AnimaticTimelineHotkeyAction | null {
  const code = String(args.code || '').trim()
  if (code === 'Space') return 'toggle-playback'
  if (code === 'ArrowLeft') return 'step-prev-beat'
  if (code === 'ArrowRight') return 'step-next-beat'
  if (code === 'KeyR') return 'reset-playhead'
  if (code === 'KeyD') return 'duplicate-beat'
  if (code === 'KeyS') return 'split-beat'
  if (code === 'KeyL') return 'edit-beat-label'
  if (code === 'KeyN') return 'edit-beat-note'
  if (code === 'KeyM') return 'edit-beat-summary'
  if (code === 'KeyT') return 'edit-beat-tags'
  if (code === 'KeyH') return 'toggle-lane-hidden'
  if (code === 'KeyU') return 'toggle-lane-muted'
  if (code === 'KeyO') return 'toggle-lane-solo'
  if (code === 'BracketLeft') return 'move-lane-up'
  if (code === 'BracketRight') return 'move-lane-down'
  if (code === 'Comma') return 'move-selected-item-prev-beat'
  if (code === 'Period') return 'move-selected-item-next-beat'

  const key = String(args.key || '').trim().toLowerCase()
  if (key === ' ') return 'toggle-playback'
  if (key === 'arrowleft') return 'step-prev-beat'
  if (key === 'arrowright') return 'step-next-beat'
  if (key === 'r') return 'reset-playhead'
  if (key === 'd') return 'duplicate-beat'
  if (key === 's') return 'split-beat'
  if (key === 'l') return 'edit-beat-label'
  if (key === 'n') return 'edit-beat-note'
  if (key === 'm') return 'edit-beat-summary'
  if (key === 't') return 'edit-beat-tags'
  if (key === 'h') return 'toggle-lane-hidden'
  if (key === 'u') return 'toggle-lane-muted'
  if (key === 'o') return 'toggle-lane-solo'
  if (key === '[') return 'move-lane-up'
  if (key === ']') return 'move-lane-down'
  if (key === ',') return 'move-selected-item-prev-beat'
  if (key === '.') return 'move-selected-item-next-beat'
  return null
}

export function isAnimaticTimelineMutationHotkeyAction(action: AnimaticTimelineHotkeyAction): boolean {
  return (
    action === 'duplicate-beat' ||
    action === 'split-beat' ||
    action === 'toggle-lane-hidden' ||
    action === 'toggle-lane-muted' ||
    action === 'toggle-lane-solo' ||
    action === 'move-lane-up' ||
    action === 'move-lane-down' ||
    action === 'move-selected-item-prev-beat' ||
    action === 'move-selected-item-next-beat'
  )
}

export function shouldIgnoreAnimaticTimelineHotkeys(args: ShouldIgnoreAnimaticTimelineHotkeysArgs): boolean {
  if (args.defaultPrevented) return true
  if (args.ctrlKey || args.metaKey || args.altKey) return true
  if (args.editingBeat || args.dragging) return true
  if (args.targetContentEditable) return true
  const targetTagName = String(args.targetTagName || '').trim().toUpperCase()
  if (HOTKEY_TAG_BLOCKLIST.has(targetTagName)) return true
  const targetRole = String(args.targetRole || '').trim().toLowerCase()
  if (HOTKEY_ROLE_BLOCKLIST.has(targetRole)) return true
  return false
}
