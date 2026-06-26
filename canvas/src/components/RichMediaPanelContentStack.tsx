import { RichMediaPanelDirectMediaSurface } from './RichMediaPanelDirectMediaSurface'
import { RichMediaPanelIframeSurface } from './RichMediaPanelIframeSurface'
import { RichMediaPanelOpenOverlay } from './RichMediaPanelOpenOverlay'
import { RichMediaPanelTextSurface } from './RichMediaPanelTextSurface'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelContentStack(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  return (
    <>
      <RichMediaPanelTextSurface model={model} props={props} />
      <RichMediaPanelOpenOverlay model={model} />
      <RichMediaPanelIframeSurface model={model} />
      <RichMediaPanelDirectMediaSurface model={model} props={props} />
    </>
  )
}
