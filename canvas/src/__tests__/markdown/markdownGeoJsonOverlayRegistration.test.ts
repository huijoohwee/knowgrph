import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { BottomPanelMarkdownSection } from '../../components/BottomPanel/BottomPanelMarkdownSection'
import { useGympgrphStore } from 'gympgrph'
import { useGraphStore } from '@/hooks/useGraphStore'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import type { MarkdownGeoDatasetIntegration } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'

export async function testMarkdownGeoJsonCodeBlockRegistersAsGeospatialDataset() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()

  const originalFetch = globalThis.fetch
  let uploadCalls = 0
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) => setTimeout(() => cb(Date.now()), 0) as unknown as number
    }

    if (!dom.window.ResizeObserver) {
      dom.window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
    if (!global.ResizeObserver) {
      global.ResizeObserver = dom.window.ResizeObserver
    }

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = (() => {
        if (typeof input === 'string') return input
        if (input instanceof URL) return input.toString()
        if (typeof (input as Request).url === 'string') return (input as Request).url
        return ''
      })()
      if (url === '/__geo_upload') {
        uploadCalls += 1
        const body = JSON.stringify({ ok: true, url: '/__geo_local/test.geojson', name: 'test.geojson' })
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (typeof originalFetch === 'function') {
        return originalFetch(input, init)
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)

    try {
      useGympgrphStore.setState({ geospatialDatasets: [] })
    } catch {
      void 0
    }

    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )

    await tick()
    await tick()

    const markdown = [
      '# Demo',
      '',
      '```geojson',
      '{"type":"FeatureCollection","features":[]}',
      '```',
      '',
    ].join('\n')

    const store = useGraphStore.getState()
    store.setMarkdownDocument('test.md', markdown)

    await tick()
    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 250))

    const renderBtn = doc.querySelector('button[name="annotate-display"][value="render"]') as HTMLButtonElement | null
    if (!renderBtn) throw new Error('Render toggle button not found')
    renderBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 250))
    const renderBtnAfterClick = doc.querySelector('button[name="annotate-display"][value="render"]') as HTMLButtonElement | null
    const ariaCurrent = renderBtnAfterClick ? renderBtnAfterClick.getAttribute('aria-current') : null
    if (ariaCurrent !== 'true') {
      throw new Error('expected Render toggle to become active (aria-current=true)')
    }

    for (let i = 0; i < 10; i += 1) {
      await tick()
    }

    const previewRoot = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!previewRoot) {
      throw new Error('expected markdown preview root to exist')
    }

    const previewText = String(previewRoot.textContent || '')
    const previewHtml = String(previewRoot.innerHTML || '')
    const hasGeoRegisterText = previewText.includes('Registering GeoJSON') || previewText.includes('GeoJSON is registered')

    const afterButtons = Array.from(previewRoot.querySelectorAll('button')) as HTMLButtonElement[]
    const hasGeospatialModeButton = afterButtons.some(
      b => String(b.getAttribute('aria-label') || '').trim() === 'Geospatial Mode (On)',
    )
    if (!hasGeospatialModeButton) {
      throw new Error(
        `expected GeoJSON code block to show Geo panel render UI (Geospatial Mode). hasGeoRegisterText=${hasGeoRegisterText} uploadCalls=${uploadCalls} previewText=${JSON.stringify(
          previewText.slice(0, 240),
        )} previewHtml=${JSON.stringify(previewHtml.slice(0, 240))}`,
      )
    }

    for (let i = 0; i < 40; i += 1) {
      await tick()
      const datasets = useGympgrphStore.getState().geospatialDatasets || []
      const hasUploaded = datasets.some(d => d.source?.kind === 'url' && d.source.url === '/__geo_local/test.geojson')
      if (hasUploaded) {
        root.unmount()
        return
      }
    }
    throw new Error('expected GeoJSON code block to register as a geospatial dataset')
  } finally {
    globalThis.fetch = originalFetch
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownGeoJsonRenderFailureShowsVisibleError() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const geoDatasetIntegration: MarkdownGeoDatasetIntegration = {
      renderGeoJsonFeatureCollection: () => {
        throw new Error('boom')
      },
      requestOpenGeoPanel: () => {},
    }

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
        markdownText: ['# Demo', '', '```geojson', '{"type":"FeatureCollection","features":[]}', '```', ''].join('\n'),
        activeDocumentPath: 'test.md',
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

    const text = String(container.textContent || '')
    if (!text.includes('GeoJSON render failed')) {
      throw new Error(`expected GeoJSON render failure to be visible. text=${JSON.stringify(text.slice(0, 240))}`)
    }
    const geoBtn = container.querySelector('button[aria-label="Geospatial Mode (On)"]') as HTMLButtonElement | null
    if (!geoBtn) {
      throw new Error('expected GeoJSON render failure UI to include Geospatial Mode button')
    }
    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
