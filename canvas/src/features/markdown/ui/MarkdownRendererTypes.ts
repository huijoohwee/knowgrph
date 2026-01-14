import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'

export type HighlightedLineRange = { start: number; end: number } | null

export type InlineRenderOpts = {
  activeDocumentPath: string
  uiPanelMonospaceTextClass: string
  fragmentOptions?: {
    enabled: boolean
    currentStep: number
    classNames: string[]
    tags: string[]
  } | null
}

export type RenderOpts = InlineRenderOpts & {
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownPresentationMode: boolean
  uiPanelTextFontClass: string
  codeAnnotations?: Record<string, string> | null
  mermaidFrontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
}
