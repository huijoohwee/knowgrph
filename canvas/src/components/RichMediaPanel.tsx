import React from 'react'
import { RichMediaPanelSurface } from './RichMediaPanelSurface'
import type { RichMediaPanelProps } from './RichMediaPanel.types'
import { useRichMediaPanelModel } from './useRichMediaPanelModel'

export type { RichMediaKind, RichMediaPanelProps } from './RichMediaPanel.types'
export {
  beginRichMediaPanelResizeDrag,
  RichMediaPanelResizeHandle,
  type RichMediaPanelResizeHandlers,
} from './RichMediaPanelResizeHandle'

const RichMediaPanel = React.forwardRef<HTMLElement, RichMediaPanelProps>(function RichMediaPanel(props, ref) {
  const model = useRichMediaPanelModel(props, ref)
  return <RichMediaPanelSurface model={model} props={props} />
})

export default React.memo(RichMediaPanel)
