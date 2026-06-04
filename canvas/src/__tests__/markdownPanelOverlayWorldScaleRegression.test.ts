import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { startMarkdownPanelOverlayLoop2d } from '@/features/markdown-edgeless/markdownPanelOverlayLoop2d'

export async function testMarkdownPanelOverlayUsesWorldSizeAndScaleForCardLayout() {
  const { dom, restore } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  try {
    const root = dom.window.document.getElementById('root')
    if (!root) throw new Error('expected root container')
    const el = dom.window.document.createElement('section')
    root.appendChild(el)

    const loop = startMarkdownPanelOverlayLoop2d({
      enabled: true,
      loop: 'onDemand',
      getItems: () => [{ id: 'table-1', cx: 260, cy: 210, w: 520, h: 420 }],
      getViewport: () => ({ w: 960, h: 540 }),
      readTransform: () => ({
        k: 0.4,
        x: 0,
        y: 0,
        applyX: (v: number) => v * 0.4,
        applyY: (v: number) => v * 0.4,
      }) as any,
      getElementForId: id => (id === 'table-1' ? el : null),
      getDensity: () => 'default',
      getSizingConfig: () => ({ widthRatio: 0.2, widthMinPx: 210, widthMaxPx: 360 }),
      clampToViewport: null,
    })

    loop.schedule()
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    if (el.style.width !== '520px' || el.style.height !== '420px') {
      throw new Error(`expected markdown overlay panel to preserve world card size before zoom scaling, got ${el.style.width}x${el.style.height}`)
    }
    if (!String(el.style.transform || '').includes('scale(0.4)')) {
      throw new Error(`expected markdown overlay panel transform to scale with renderer zoom, got ${el.style.transform}`)
    }
    if (el.style.getPropertyValue('--kg-media-panel-header-h') !== '28px') {
      throw new Error(`expected zoom-scaled world panel to avoid double-scaling shared chrome vars, got ${el.style.getPropertyValue('--kg-media-panel-header-h')}`)
    }
    if ((el as unknown as { dataset?: Record<string, string> }).dataset?.kgOverlayHasPos !== '1') {
      throw new Error('expected markdown overlay panel to remain positioned through the shared overlay loop')
    }

    loop.stop()
  } finally {
    restore()
  }
}

export function testMarkdownCardPreviewTablesUseCardWidthContract() {
  const tablePath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownTableBlock.tsx')
  const text = readFileSync(tablePath, 'utf8')

  for (const snippet of [
    'const cardPreviewMode = opts.markdownCardPreviewMode === true',
    "const cardPreviewTableFrameClassName = 'overflow-auto max-h-full'",
    "const blockSpacingClassName = cardPreviewMode ? 'm-0' : 'mt-4 mb-4'",
    "cardPreviewMode ? 'w-full table-fixed' : 'min-w-full table-auto'",
    "cardPreviewMode ? 'px-2 py-1.5 break-words whitespace-normal'",
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected markdown card preview tables to use Storyboard-card-width table layout: ${snippet}`)
    }
  }

  if (text.includes('cardPreviewMode\n    ? `overflow-auto max-h-full rounded-lg border')) {
    throw new Error('expected markdown card preview tables to avoid nested rounded border frames inside shared card panels')
  }
}
