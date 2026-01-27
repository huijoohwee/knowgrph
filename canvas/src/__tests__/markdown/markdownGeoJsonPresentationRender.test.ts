import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '@/tests/lib/markdownFence'
import type { MarkdownGeoDatasetIntegration } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'

export async function testMarkdownGeoJsonRendersInPresentationAfterPerBlockOverride() {
  const raw = readMarkdownSlideDemo()
  if (!raw) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const json = extractFirstFencedBlock(raw, 'json')
    const geojson = extractFirstFencedBlock(raw, 'geojson')
    if (!json) throw new Error('Expected sandbox slide demo to include a fenced json code block')
    if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

    const markdown = [
      '# Slide 1',
      '',
      '```json',
      json,
      '```',
      '',
      '---',
      '',
      '# Slide 2',
      '',
      '```geojson',
      geojson,
      '```',
      '',
    ].join('\n')
    const docPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'

    const geoDatasetIntegration: MarkdownGeoDatasetIntegration = {
      renderGeoJsonFeatureCollection: () => React.createElement('div', { 'data-testid': 'geojson-map', className: 'w-full h-[320px]' }),
      registerGeoJsonFeatureCollection: async () => ({ ok: true }),
      requestOpenGeoPanel: () => {},
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)

    const root = createRoot(container as unknown as HTMLElement)
    const presentationApiRef = React.createRef<{
      next?: () => void
    }>()

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
        presentationApiRef,
        geoDatasetIntegration,
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

    const inlineBtn = doc.querySelector('button[aria-label="Show annotations inline"]') as HTMLButtonElement | null
    if (!inlineBtn) throw new Error('Expected per-block Inline toggle button on slide 1')
    inlineBtn.click()

    await tick()
    await tick()

    const api = (presentationApiRef as unknown as { current?: { next?: () => void } }).current
    if (!api || typeof api.next !== 'function') {
      throw new Error('Expected presentation API ref to be registered')
    }
    api.next()
    await tick()
    await tick()

    const map = doc.querySelector('[data-testid="geojson-map"]')
    if (!map) {
      throw new Error('Expected GeoJSON code block to render using geoDatasetIntegration in presentation mode')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
