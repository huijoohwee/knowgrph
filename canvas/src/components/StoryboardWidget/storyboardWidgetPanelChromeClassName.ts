import { cn } from '@/lib/utils'

export const getStoryboardWidgetPanelChromeClassName = (panelTextClass?: string): string => cn(
  'rounded-md border flex flex-col relative bg-[var(--kg-media-panel-bg)] border-[color:var(--kg-border)] text-[color:var(--kg-text-primary)]',
  panelTextClass || '',
)

export const getStoryboardWidgetPanelSelectionChromeClassName = (selected: boolean): string => (
  selected ? 'outline outline-2 outline-blue-500/80 outline-offset-0' : ''
)
