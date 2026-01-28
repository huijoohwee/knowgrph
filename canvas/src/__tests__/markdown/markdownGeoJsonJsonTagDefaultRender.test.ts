import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '@/tests/lib/markdownFence'
import type { MarkdownGeoDatasetIntegration } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'

export async function testMarkdownGeoJsonJsonTagDefaultsToInlineInViewerAndRenderInPresentation() {
  const demo = readMarkdownSlideDemo()
  if (!demo) return

  const geojson = extractFirstFencedBlock(demo, 'geojson')
  if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

  const markdown = ['# Demo', '', '```json', geojson, '```', ''].join('\n')
  const docPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const geoDatasetIntegration: MarkdownGeoDatasetIntegration = {
      isGeoJsonCodeBlock: req => String(req?.codeBlock?.text || '').includes('"FeatureCollection"'),
      renderGeoJsonFeatureCollection: () => React.createElement('div', { 'data-testid': 'geojson-map' }),
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolvePromise => raf(() => resolvePromise()))

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: docPath,
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        annotateDisplayMode: 'inline',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        geoDatasetIntegration,
      } as never),
    )

    await tick()
    await tick()

    if (!doc.querySelector('[data-testid="geojson-map"]')) {
      throw new Error('Expected GeoJSON content tagged as json to default to Render in viewer mode')
    }

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: docPath,
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: true,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        annotateDisplayMode: 'inline',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        geoDatasetIntegration,
      } as never),
    )

    await tick()
    await tick()

    if (!doc.querySelector('[data-testid="geojson-map"]')) {
      throw new Error('Expected GeoJSON content tagged as json to default to Render in presentation mode')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
