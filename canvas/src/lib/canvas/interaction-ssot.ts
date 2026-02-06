export type CanvasInteractionMode = 'navigate' | 'select' | 'multiSelect' | 'layout'

export type CanvasShortcutCategory = 'Universal' | 'Navigate' | 'Select' | 'Multi-select' | 'Layout'

export type CanvasShortcut = {
  id: string
  category: CanvasShortcutCategory
  action: string
  input: string
  modes: CanvasInteractionMode[]
  notes?: string
}

export const CANVAS_INTERACTION_MODES: readonly CanvasInteractionMode[] = [
  'navigate',
  'select',
  'multiSelect',
  'layout',
] as const

export const CANVAS_INTERACTION_MODE_LABELS: Readonly<Record<CanvasInteractionMode, string>> = {
  navigate: 'Navigate',
  select: 'Select',
  multiSelect: 'Multi-select',
  layout: 'Layout',
} as const

export const CANVAS_PRECEDENCE_RULES: readonly { id: string; rule: string; detail: string }[] = [
  {
    id: 'space-pan',
    rule: 'Space + drag pans regardless of selection mode.',
    detail: 'When Space is held, pointer drag pans the viewport and selection actions are suppressed.',
  },
  {
    id: 'wheel-zoom',
    rule: 'Wheel / pinch zoom anchors at the pointer when possible.',
    detail: 'Zoom uses the pointer location as focal point; if unavailable, it falls back to viewport center.',
  },
  {
    id: 'modifiers-marquee',
    rule: 'Selection modifiers choose add/remove/replace semantics.',
    detail: 'Shift adds to selection; Alt removes; no modifier replaces.',
  },
] as const

export const CANVAS_SHORTCUTS: readonly CanvasShortcut[] = [
  {
    id: 'pan-drag',
    category: 'Navigate',
    action: 'Pan viewport',
    input: 'Drag empty space (or background) when available',
    modes: ['navigate'],
  },
  {
    id: 'pan-space-drag',
    category: 'Universal',
    action: 'Pan viewport (temporary override)',
    input: 'Hold Space + drag',
    modes: ['navigate', 'select', 'multiSelect', 'layout'],
  },
  {
    id: 'zoom-wheel',
    category: 'Universal',
    action: 'Zoom around pointer',
    input: 'Wheel / trackpad pinch',
    modes: ['navigate', 'select', 'multiSelect', 'layout'],
  },
  {
    id: 'zoom-fit-to-view',
    category: 'Universal',
    action: 'Fit to view',
    input: 'Toolbar → Fit to View',
    modes: ['navigate', 'select', 'multiSelect', 'layout'],
  },
  {
    id: 'zoom-fit-to-screen',
    category: 'Universal',
    action: 'Fit to screen (auto)',
    input: 'Toolbar → Fit to Screen',
    modes: ['navigate', 'select', 'multiSelect', 'layout'],
  },
  {
    id: 'zoom-pin-to-view',
    category: 'Universal',
    action: 'Pin to view (lock viewport)',
    input: 'Toolbar → Pin to View',
    modes: ['navigate', 'select', 'multiSelect', 'layout'],
  },
  {
    id: 'zoom-to-selection',
    category: 'Select',
    action: 'Zoom to selection',
    input: 'Toolbar → Zoom to Selection',
    modes: ['select', 'multiSelect'],
  },
  {
    id: 'select-click',
    category: 'Select',
    action: 'Select item',
    input: 'Click a node/edge/group',
    modes: ['select'],
  },
  {
    id: 'select-shift-toggle',
    category: 'Multi-select',
    action: 'Toggle item in selection',
    input: 'Shift + click',
    modes: ['multiSelect'],
  },
  {
    id: 'select-marquee',
    category: 'Multi-select',
    action: 'Marquee select',
    input: 'Drag empty space',
    modes: ['multiSelect'],
    notes: 'Use modifiers for add/remove/replace.',
  },
  {
    id: 'layout-apply',
    category: 'Layout',
    action: 'Apply layout',
    input: 'Toolbar / panel → Layout presets',
    modes: ['layout'],
    notes: 'Layouts should be deterministic for a stable selection snapshot.',
  },
] as const

export const CANVAS_SHORTCUT_CATEGORIES: readonly CanvasShortcutCategory[] = [
  'Universal',
  'Navigate',
  'Select',
  'Multi-select',
  'Layout',
] as const

export function getCanvasShortcutSearchText(s: CanvasShortcut): string {
  const parts: string[] = [s.category, s.action, s.input]
  if (s.notes) parts.push(s.notes)
  parts.push(s.modes.map(m => CANVAS_INTERACTION_MODE_LABELS[m]).join(' '))
  return parts.join(' | ')
}

export function formatCanvasShortcutCopyLine(s: CanvasShortcut): string {
  const base = `${s.action} — ${s.input}`
  return s.notes ? `${base} (${s.notes})` : base
}

export const CANVAS_SHORTCUT_COPY_LINES: readonly string[] = CANVAS_SHORTCUTS.map(formatCanvasShortcutCopyLine)

