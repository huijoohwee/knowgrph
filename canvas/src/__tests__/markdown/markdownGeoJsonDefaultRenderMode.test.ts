import React from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownCodeBlock } from 'curagrph/features/markdown/ui/MarkdownCodeBlock.tsx'
import type { TokenWithLines } from 'curagrph/features/markdown/ui/markdownPreviewLex.ts'
import type { RenderOpts } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownGeoJsonDefaultsToInlineInViewerMode() {
  const { dom, restore } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    doc.body.appendChild(container)

    const token: TokenWithLines = {
      type: 'code',
      raw: '{"type":"FeatureCollection","features":[]}',
      text: '{"type":"FeatureCollection","features":[]}',
      lang: 'geojson',
      info: 'geojson',
      startLine: 1,
      endLine: 1,
    } as unknown as TokenWithLines

    const opts: RenderOpts = {
      activeDocumentPath: 'test.md',
      highlightedLineRange: null,
      markdownWordWrap: true,
      markdownPresentationMode: false,
      uiPanelTextFontClass: 'font-sans',
      uiPanelMonospaceTextClass: 'font-mono',
      codeAnnotations: null,
      collapsedIds: new Set<string>(),
      onToggleCollapse: () => void 0,
      mermaidFrontmatterConfig: null,
      rootThemeMode: 'light',
      previewOverlayScope: null,
      previewOverlayPortalTarget: null,
      geoDatasetIntegration: undefined,
    } as unknown as RenderOpts

    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(MarkdownCodeBlock, {
        token,
        highlightClass: '',
        highlightStyle: undefined,
        wrapClass: 'whitespace-pre',
        opts,
        annotateDisplayMode: 'inline',
      }),
    )

    const tick = () =>
      new Promise<void>(resolve =>
        dom.window.requestAnimationFrame
          ? dom.window.requestAnimationFrame(() => resolve())
          : setTimeout(() => resolve(), 0),
      )
    await tick()
    await tick()

    const renderBtn = doc.querySelector('button[aria-label="Render code block output"][aria-current="true"]')
    if (!renderBtn) throw new Error('expected GeoJSON code block to default to Render mode in viewer')
    root.unmount()
  } finally {
    restore()
  }
}
