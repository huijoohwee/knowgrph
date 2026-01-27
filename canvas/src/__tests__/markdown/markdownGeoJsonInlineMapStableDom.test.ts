import React from 'react'
import { createRoot } from 'react-dom/client'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readMarkdownSlideDemo } from '@/tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '@/tests/lib/markdownFence'

export async function testMarkdownGeoJsonInlineMapRendersStableContainerDom() {
  const raw = readMarkdownSlideDemo()
  if (!raw) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const geojson = extractFirstFencedBlock(raw, 'geojson')
    if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)

    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(InlineMarkdownGeoJsonLayerMap, {
        geojsonText: geojson,
        datasetId: 'sandbox:geojson:stable-dom',
        className: 'w-full',
        heightPx: 320,
      }),
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

    const wrapper = container.firstElementChild as HTMLElement | null
    if (!wrapper) throw new Error('Expected InlineMarkdownGeoJsonLayerMap to render a wrapper element')
    if (wrapper.style.height !== '320px') {
      throw new Error(`Expected wrapper to set height style to 320px, got "${wrapper.style.height}"`)
    }

    const inner = wrapper.querySelector('[data-testid="geojson-map-container"]') as HTMLElement | null
    if (!inner) {
      throw new Error('Expected InlineMarkdownGeoJsonLayerMap to render a stable inner map container')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
