import type { MermaidInitConfig } from '@/features/panels/views/preview-panel/ui/mermaidConfig'
import type { ReactNode } from 'react'

export type HighlightedLineRange = { start: number; end: number } | null

export type InlineRenderOpts = {
  activeDocumentPath: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  markdownPresentationMode: boolean
  fragmentOptions?: {
    enabled: boolean
    currentStep: number
    classNames: string[]
    tags: string[]
  } | null
}

export type MarkdownGeoDatasetRegistrationRequest = {
  sourceDocumentPath: string
  codeBlock: {
    lang: 'geojson' | 'json'
    text: string
    startLine: number
    endLine: number
  }
}

export type MarkdownGeoDatasetRegistrationResult = {
  ok: boolean
  error?: string
}

export type MarkdownGeoDatasetIntegration = {
  isGeospatialModeEnabled?: () => boolean
  isGeoJsonCodeBlock?: (req: MarkdownGeoDatasetRegistrationRequest) => boolean
  registerGeoJsonFeatureCollection?: (
    req: MarkdownGeoDatasetRegistrationRequest,
  ) => Promise<MarkdownGeoDatasetRegistrationResult> | MarkdownGeoDatasetRegistrationResult
  loadGeoJsonAsGraphData?: (
    req: MarkdownGeoDatasetRegistrationRequest,
  ) => Promise<MarkdownGeoDatasetRegistrationResult> | MarkdownGeoDatasetRegistrationResult
  renderGeoJsonFeatureCollection?: (req: MarkdownGeoDatasetRegistrationRequest) => ReactNode | null
  requestOpenGeoPanel?: () => void
}

export type RenderOpts = InlineRenderOpts & {
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  stickyHeadingTopClass?: string
  stickyHeadingTopPx?: number
  stickyHeadingCascadeBaseDepth?: number
  codeAnnotations?: Record<string, string> | null
  mermaidFrontmatterConfig: MermaidInitConfig | null
  rootThemeMode: 'light' | 'dark'
  previewOverlayScope: 'viewport' | 'container'
  previewOverlayPortalTarget?: HTMLElement | null
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  viewerBlockEditingEnabled?: boolean
  onMoveHeadingSection?: (id: string, direction: 'up' | 'down') => void
  onReorderHeadingSection?: (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => void
  onReorderLineBlock?: (
    source: { startLine: number; endLine: number },
    target: { startLine: number; endLine: number },
    position: 'before' | 'after',
  ) => void
  onInsertLineAfter?: (afterLine: number) => void
  onReplaceLineRange?: (args: { startLine: number; endLine: number; replacementLines: string[] }) => void
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration
  markdownBlockControlsEnabled?: boolean
  markdownBlockGutterEnabled?: boolean
  markdownForcePlainTables?: boolean
  webpageLayoutWireframeAscii?: string | null
  markdownSourceLines?: string[]
  forbidCopy?: boolean
}
