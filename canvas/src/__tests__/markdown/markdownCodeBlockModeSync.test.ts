import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '@/tests/lib/markdownFence'
import type { MarkdownGeoDatasetIntegration } from 'curagrph/features/markdown/ui/MarkdownRendererTypes.ts'

export async function testMarkdownCodeBlockModeGlobalPerBlockSync() {
  const demo = readMarkdownSlideDemo()
  if (!demo) return

  const json = extractFirstFencedBlock(demo, 'json')
  const geojson = extractFirstFencedBlock(demo, 'geojson')
  if (!json) throw new Error('Expected sandbox slide demo to include a fenced json code block')
  if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

  const markdown = [
    '# Demo',
    '',
    '```json',
    json,
    '```',
    '',
    '```geojson',
    geojson,
    '```',
    '',
  ].join('\n')
  const docPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const geoDatasetIntegration: MarkdownGeoDatasetIntegration = {
      renderGeoJsonFeatureCollection: () =>
        React.createElement('div', { 'data-testid': 'geojson-map', className: 'w-full h-[320px]' }),
      registerGeoJsonFeatureCollection: async () => ({ ok: true }),
      requestOpenGeoPanel: () => {},
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

    const render = (annotateDisplayMode: 'inline' | 'beside' | 'render') => {
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
          annotateDisplayMode,
          previewOverlayScope: 'viewport',
          previewOverlayPortalTarget: null,
          previewScrollable: true,
          geoDatasetIntegration,
        } as never),
      )
    }

    render('inline')
    await tick()
    await tick()

    const firstCodeBlock = doc.querySelector('figure[data-start-line]') as HTMLElement | null
    if (!firstCodeBlock) throw new Error('Expected a code block figure to be rendered')

    const besideBtn = firstCodeBlock.querySelector(
      'button[aria-label="Show annotations beside code"]',
    ) as HTMLButtonElement | null
    if (!besideBtn) throw new Error('Expected per-block Beside toggle button')

    besideBtn.click()
    await tick()
    await tick()

    const besideActive = firstCodeBlock
      .querySelector('button[aria-label="Show annotations beside code"]')
      ?.getAttribute('aria-current')
    if (besideActive !== 'true') {
      throw new Error('Expected per-block Beside to be active after clicking')
    }

    render('beside')
    await tick()
    await tick()

    render('render')
    await tick()
    await tick()

    const renderActive = firstCodeBlock
      .querySelector('button[aria-label="Render code block output"]')
      ?.getAttribute('aria-current')
    if (renderActive !== 'true') {
      throw new Error(
        'Expected code block to re-sync to global Render after global mode changes (override should clear when matching global)',
      )
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
