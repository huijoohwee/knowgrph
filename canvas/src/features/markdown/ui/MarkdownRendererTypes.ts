import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

export type HighlightedLineRange = { start: number; end: number } | null

export type InlineRenderOpts = {
  activeDocumentPath: string
  uiPanelMonospaceTextClass: string
}

export type RenderOpts = InlineRenderOpts & {
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  uiPanelTextFontClass: string
  mermaidFrontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
}
