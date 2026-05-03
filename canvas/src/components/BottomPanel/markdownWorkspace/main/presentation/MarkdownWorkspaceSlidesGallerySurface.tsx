import React from 'react'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import type { HighlightedLineRange, MarkdownPresentationApi } from '../../markdownWorkspaceTypes'
import { MarkdownWorkspaceWebpageSurface } from './MarkdownWorkspaceWebpageSurface'

export function MarkdownWorkspaceSlidesGallerySurface(props: {
  showWebpageHtml: boolean
  webpageUrl: string
  iframeSrc: string | null
  iframeSrcDoc: string | null
  viewerText: string
  activeDocumentKey: string
  highlightedLineRange: HighlightedLineRange
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  webpageLayoutWireframeAscii: string
  geoDatasetIntegration?: MarkdownGeoDatasetIntegration
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>
  showInViewer: (line: number) => void
  revealLineInEditor: (line: number) => void
  showInPresentation: (line: number) => void
  showInSlidesGallery: (line: number) => void
}) {
  if (props.showWebpageHtml) {
    return (
      <MarkdownWorkspaceWebpageSurface
        ariaLabel="Webpage Slides Gallery"
        webpageUrl={props.webpageUrl}
        iframeSrc={props.iframeSrc}
        iframeSrcDoc={props.iframeSrcDoc}
      />
    )
  }

  return (
    <section className="flex-1 min-h-0 flex" aria-label="Slides Gallery">
      <MarkdownPreview
        markdownText={props.viewerText}
        activeDocumentPath={props.activeDocumentKey}
        highlightedLineRange={props.highlightedLineRange}
        markdownWordWrap={props.markdownWordWrap}
        markdownPresentationMode={false}
        markdownTextHighlight={props.markdownTextHighlight}
        selectionKind={null}
        uiPanelTextFontClass={props.uiPanelTextFontClass}
        uiPanelMonospaceTextClass={props.uiPanelMonospaceTextClass}
        webpageLayoutWireframeAscii={props.webpageLayoutWireframeAscii}
        geoDatasetIntegration={props.geoDatasetIntegration}
        previewOverlayScope="container"
        previewOverlayPortalTarget={null}
        previewScrollable={true}
        presentationApiRef={props.presentationApiRef as unknown as React.MutableRefObject<MarkdownPresentationApi | null>}
        viewMode="gallery"
        showSidebar={false}
        onShowInViewer={props.showInViewer}
        onShowInEditor={(line: number) => props.revealLineInEditor(line)}
        onShowInPresentation={props.showInPresentation}
        onShowInSlidesGallery={props.showInSlidesGallery}
      />
    </section>
  )
}
