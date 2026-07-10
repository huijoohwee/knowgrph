import type { RichMediaPanelModel } from './useRichMediaPanelModel'

export type RichMediaPanelSurfaceVariant = 'directMedia' | 'iframe' | 'none' | 'text'

export function resolveRichMediaPanelSurfaceVariant(model: RichMediaPanelModel): RichMediaPanelSurfaceVariant {
  if (model.showPanelTextSurface || model.panelIsLoading || model.isEmptyPanel) return 'text'
  if (model.kind === 'iframe') return 'iframe'
  if (model.mediaSrc || model.kind === 'audio' || model.kind === 'image' || model.kind === 'svg' || model.kind === 'video') return 'directMedia'
  return 'none'
}
