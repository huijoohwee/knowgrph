import React from 'react'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import type { MarkdownGeoDatasetIntegration } from '@/features/markdown/ui/MarkdownRendererTypes'
import type { HighlightedLineRange, MarkdownPresentationApi } from '../../markdownWorkspaceTypes'

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
      <section className="flex-1 min-h-0 flex" aria-label="Webpage Slides Gallery">
        <iframe
          className="flex-1 min-h-0 w-full border-0"
          title={props.webpageUrl || 'Webpage'}
          src={props.iframeSrc || undefined}
          srcDoc={props.iframeSrcDoc || undefined}
          sandbox="allow-scripts"
          loading="lazy"
          allow="geolocation 'none'; microphone 'none'; camera 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'"
          referrerPolicy="no-referrer"
        />
      </section>
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

