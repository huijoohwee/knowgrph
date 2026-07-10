import { RichMediaPanelContentSurface } from './RichMediaPanelContentSurface'
import { RichMediaPanelShell } from './RichMediaPanelShell'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export function RichMediaPanelSurface(args: {
  model: RichMediaPanelModel
  props: RichMediaPanelProps
}) {
  const { model, props } = args
  return (
    <RichMediaPanelShell model={model} props={props}>
      <RichMediaPanelContentSurface model={model} props={props} />
    </RichMediaPanelShell>
  )
}
