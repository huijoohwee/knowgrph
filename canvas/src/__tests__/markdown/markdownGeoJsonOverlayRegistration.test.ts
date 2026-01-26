import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { BottomPanelMarkdownSection } from '../../components/BottomPanel/BottomPanelMarkdownSection'
import { useGympgrphStore } from 'gympgrph'
import { useGraphStore } from '@/hooks/useGraphStore'

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

    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const renderBtn = buttons.find(b => (b.textContent || '').trim() === 'Render') || null
    if (!renderBtn) throw new Error('Render toggle button not found')
    renderBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    await tick()
    await new Promise<void>(resolve => setTimeout(() => resolve(), 250))
    const buttonsAfterClick = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const renderBtnAfterClick = buttonsAfterClick.find(b => (b.textContent || '').trim() === 'Render') || null
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
    const hasOpenGeo = afterButtons.some(b => (b.textContent || '').trim() === 'Open Geo')
    if (!hasOpenGeo) {
      throw new Error(
        `expected GeoJSON code block to show Geo panel render UI (Open Geo). hasGeoRegisterText=${hasGeoRegisterText} uploadCalls=${uploadCalls} previewText=${JSON.stringify(previewText.slice(0, 240))} previewHtml=${JSON.stringify(previewHtml.slice(0, 240))}`,
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
