import type React from 'react'
import type { RichMediaPanelMediaState } from './useRichMediaPanelMediaState'
import { useRichMediaPanelMediaState } from './useRichMediaPanelMediaState'
import type { RichMediaPanelSurfaceState } from './useRichMediaPanelSurfaceState'
import { useRichMediaPanelSurfaceState } from './useRichMediaPanelSurfaceState'
import type { RichMediaPanelProps } from './RichMediaPanel.types'

export type RichMediaPanelModel = RichMediaPanelMediaState & RichMediaPanelSurfaceState

export function useRichMediaPanelModel(
  props: RichMediaPanelProps,
  ref: React.ForwardedRef<HTMLElement>,
): RichMediaPanelModel {
  const mediaState = useRichMediaPanelMediaState(props)
  const surfaceState = useRichMediaPanelSurfaceState(props, ref, mediaState)
  return {
    ...mediaState,
    ...surfaceState,
  }
}
