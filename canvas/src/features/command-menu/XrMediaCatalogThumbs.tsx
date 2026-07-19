import type { LucideIcon } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export function XrCatalogThumb({ Icon, color }: { Icon: LucideIcon; color: string }) {
  return (
    <span
      className={cn('grid size-10 shrink-0 place-items-center rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
      style={{ color }}
      role="img"
      aria-label="Procedural grey-box preview"
    >
      <Icon className="size-5" strokeWidth={1.6} aria-hidden />
    </span>
  )
}
