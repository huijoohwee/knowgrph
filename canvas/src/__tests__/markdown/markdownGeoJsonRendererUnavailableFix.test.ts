import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initWindowHarness } from '../../tests/lib/windowHarness'
import { initJsdomHarness } from '../../tests/lib/jsdomHarness'
import { MemoryStorage } from '../../tests/lib/memoryStorage'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '../../tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '../../tests/lib/markdownFence'
import type { MarkdownGeoDatasetIntegration } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'

export async function testMarkdownGeoJsonRenderUpdatesWhenGeoRendererBecomesAvailable() {
  const raw = readMarkdownSlideDemo()
  if (!raw) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const geojson = extractFirstFencedBlock(raw, 'geojson')
    if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

    const markdown = ['# Demo', '', '```geojson', geojson, '```', ''].join('\n')

    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)

    const root = createRoot(container as unknown as HTMLElement)

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: resolveMarkdownSlideDemoDocumentPath() ?? 'markdown-slide-demo.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        annotateDisplayMode: 'render',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        geoDatasetIntegration: undefined,
      } as never),
    )

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolvePromise => raf(() => resolvePromise()))
    await tick()
    await tick()

    const initialText = String(container.textContent || '')
    if (!initialText.toLowerCase().includes('geojson render failed')) {
      throw new Error('Expected initial GeoJSON render to show an error when renderer is unavailable')
    }

    const geoDatasetIntegration: MarkdownGeoDatasetIntegration = {
      renderGeoJsonFeatureCollection: () =>
        React.createElement('section', { 'data-testid': 'geojson-map', className: 'w-full h-[320px]' }),
      registerGeoJsonFeatureCollection: async () => ({ ok: true }),
      requestOpenGeoPanel: () => {},
    }

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText: markdown,
        activeDocumentPath: resolveMarkdownSlideDemoDocumentPath() ?? 'markdown-slide-demo.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        annotateDisplayMode: 'render',
        previewOverlayScope: 'viewport',
        previewOverlayPortalTarget: null,
        previewScrollable: true,
        geoDatasetIntegration,
      } as never),
    )

    await tick()
    await tick()

    const map = doc.querySelector('[data-testid="geojson-map"]')
    if (!map) {
      throw new Error('Expected GeoJSON to render after geoDatasetIntegration becomes available')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
