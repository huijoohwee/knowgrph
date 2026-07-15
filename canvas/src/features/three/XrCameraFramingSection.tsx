import { StrybldrCameraFramingSection } from '@/features/strybldr/StrybldrCameraFramingSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export function XrCameraFramingSection() {
  return (
    <section
      className={cn('space-y-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
      aria-label="XR camera framing"
      data-kg-xr-camera-framing="1"
    >
      <header className="min-w-0">
        <h3 className="text-[11px] font-semibold uppercase">Camera framing</h3>
        <p className={cn('text-[11px]', UI_THEME_TOKENS.text.tertiary)}>
          Keep the Canvas XR camera and both FloatingPanel camera projections on one shared draft.
        </p>
      </header>
      <StrybldrCameraFramingSection />
    </section>
  )
}
