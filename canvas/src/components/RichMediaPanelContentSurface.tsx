import { RichMediaPanelDirectMediaSurface } from './RichMediaPanelDirectMediaSurface'
import { RichMediaPanelIframeSurface } from './RichMediaPanelIframeSurface'
import { RichMediaPanelOpenOverlay } from './RichMediaPanelOpenOverlay'
import { RichMediaPanelTextSurface } from './RichMediaPanelTextSurface'
import { resolveRichMediaPanelSurfaceVariant } from './richMediaPanelSurfaceVariant'
import { UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES, UI_VIEW_EDIT_SURFACE_SHELL_CLASS_NAME } from '@/lib/ui/surfaceClasses'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelContentSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  const variant = resolveRichMediaPanelSurfaceVariant(model)
  return (
    <section
      aria-label={`${model.title} view and edit surface`}
      className={UI_VIEW_EDIT_SURFACE_SHELL_CLASS_NAME}
      {...UI_VIEW_EDIT_SURFACE_DATA_ATTRIBUTES}
    >
      {variant === 'text' ? <RichMediaPanelTextSurface model={model} props={props} /> : null}
      {variant === 'iframe' ? <RichMediaPanelIframeSurface model={model} /> : null}
      {variant === 'directMedia' ? <RichMediaPanelDirectMediaSurface model={model} props={props} /> : null}
      <RichMediaPanelOpenOverlay model={model} />
    </section>
  )
}
