import React from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readMarkdownSlideDemo } from '@/tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '@/tests/lib/markdownFence'

export async function testGeoJsonMapPreviewRendersMapContainerAboveSvgFallback() {
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
        datasetId: 'sandbox:geojson:zindex-guard',
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

    const mapContainer = wrapper.querySelector('[data-testid="geojson-map-container"]') as HTMLElement | null
    if (!mapContainer) throw new Error('Expected InlineMarkdownGeoJsonLayerMap to render a map container')
    if (!String(mapContainer.className || '').includes('z-[1]')) {
      throw new Error(`Expected map container to include z-[1], got "${mapContainer.className}"`)
    }

    const svgLayer = wrapper.querySelector('div.absolute.inset-0.z-0') as HTMLElement | null
    if (!svgLayer) throw new Error('Expected SVG fallback layer to include z-0 and sit below map container')

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testGeoJsonMapPreviewSupportsContainerHeightMode() {
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
        datasetId: 'sandbox:geojson:container-height',
        className: 'w-full h-full',
        useContainerHeight: true,
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
    if (wrapper.style.height !== '100%') {
      throw new Error(`Expected wrapper to use container height (100%), got "${wrapper.style.height}"`)
    }
    if (!wrapper.style.minHeight || wrapper.style.minHeight === '0px') {
      throw new Error(`Expected wrapper to set a non-zero minHeight, got "${wrapper.style.minHeight}"`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export function testInlineMarkdownGeoJsonMapReusesSharedBasemapHook() {
  const inlinePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'InlineMarkdownGeoJsonLayerMap.tsx')
  const text = readFileSync(inlinePath, 'utf8')

  if (!text.includes('useMapLibreBasemap')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to reuse useMapLibreBasemap()')
  }
  if (text.includes('createMapLibreMapWithBasemap')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to not use createMapLibreMapWithBasemap()')
  }
}

export function testMapLibreBasemapBootTimeoutDoesNotRequireStrictStyleLoadedOnly() {
  const p = resolve(process.cwd(), '..', '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readFileSync(p, 'utf8')

  const requiredSnippets = [
    'probe.tilesLoaded',
    'probe.sourceLoaded',
    "Basemap did not load. Check style URL, CORS, or network.",
    'args.containerRef.current',
  ]
  const missing = requiredSnippets.filter(s => !text.includes(s))
  if (missing.length) {
    const msg = missing.map(s => `missing: ${s}`).join('\n')
    throw new Error(`useMapLibreBasemap regression guard failed:\n${msg}`)
  }
}

export function testHostImportsMapLibreCssForMarkdownGeoJsonPreviews() {
  const p = resolve(process.cwd(), 'src', 'main.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("import 'maplibre-gl/dist/maplibre-gl.css'")) {
    throw new Error('Expected host app to import maplibre-gl CSS so Markdown GeoJSON previews can render')
  }
}
