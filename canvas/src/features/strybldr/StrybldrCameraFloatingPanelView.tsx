import { Camera } from 'lucide-react'
import { UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { StrybldrCameraFramingSection } from './StrybldrCameraFramingSection'
import { XrShootCameraSection } from './XrShootCameraSection'

export function StrybldrCameraFloatingPanelView() {
  return (
    <section className="flex h-full flex-col" aria-label="Camera panel" data-kg-camera-panel-surface="floatingPanel">
      <header className={cn('flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.divider)}>
        <section className="flex min-w-0 items-center gap-2">
          <Camera className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden={true} />
          <section className="min-w-0 text-xs font-semibold">Camera</section>
        </section>
      </header>
      <section className={`${UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME} px-1 pb-2`}>
        <section className="py-1">
          <StrybldrCameraFramingSection />
        </section>
        <XrShootCameraSection />
      </section>
    </section>
  )
}
