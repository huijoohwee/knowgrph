import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export const getStoryboardWidgetPanelChromeClassName = (panelTextClass?: string): string => cn(
  'rounded-md border shadow-md flex flex-col relative',
  UI_THEME_TOKENS.panel.bg,
  UI_THEME_TOKENS.input.border,
  UI_THEME_TOKENS.text.primary,
  panelTextClass || '',
)
