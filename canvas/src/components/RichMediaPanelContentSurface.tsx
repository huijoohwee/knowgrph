import { RichMediaPanelDirectMediaSurface } from './RichMediaPanelDirectMediaSurface'
import { RichMediaPanelIframeSurface } from './RichMediaPanelIframeSurface'
import { RichMediaPanelOpenOverlay } from './RichMediaPanelOpenOverlay'
import { RichMediaPanelTextSurface } from './RichMediaPanelTextSurface'
import { resolveRichMediaPanelSurfaceVariant } from './richMediaPanelSurfaceVariant'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelContentSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  const variant = resolveRichMediaPanelSurfaceVariant(model)
  return (
    <>
      {variant === 'text' ? <RichMediaPanelTextSurface model={model} props={props} /> : null}
      {variant === 'iframe' ? <RichMediaPanelIframeSurface model={model} /> : null}
      {variant === 'directMedia' ? <RichMediaPanelDirectMediaSurface model={model} props={props} /> : null}
      <RichMediaPanelOpenOverlay model={model} />
    </>
  )
}
