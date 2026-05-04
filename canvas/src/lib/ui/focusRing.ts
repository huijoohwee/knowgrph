import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const UI_FOCUS_RING = [
  'focus-visible:outline-none',
  UI_THEME_TOKENS.focus.primaryStrongRing,
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--kg-focus-ring-offset)]',
].join(' ')
