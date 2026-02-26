import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testMarkdownPreviewRendersSvgAndIframeHtmlBlocks() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      '<svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" /></svg>',
      '',
      '<iframe srcdoc="<!doctype html><html><body><h1>Hi</h1></body></html>"></iframe>',
      '',
      '<iframe src="//example.com/embed"></iframe>',
      '',
      '![webp-proxy](/__webpage_asset_proxy?url=https%3A%2F%2Fimages.ctfassets.net%2Fkftzwdyauwt9%2Fid%2Ffile.png%3Fw%3D3840%26amp%3Bq%3D90%26amp%3Bfm%3Dwebp)',
      '',
      '![webp-proxy-abs](https://openai.com/__webpage_asset_proxy?url=https%3A%2F%2Fimages.ctfassets.net%2Fkftzwdyauwt9%2Fid%2Ffile.png%3Fw%3D3840%26amp%3Bq%3D90%26amp%3Bfm%3Dwebp)',
      '',
      '![webp-entity](https://images.ctfassets.net/kftzwdyauwt9/id/file.png?w=3840&amp;q=90&amp;fm=webp)',
      '',
      '<details open><summary>More</summary><p>Details body</p></details>',
      '',
      '<audio controls src="/audio.mp3"></audio>',
      '',
      '<img srcset="https://example.com/a.webp 1x, https://example.com/b.webp 2x" width="10" height="10" alt="webp" />',
      '',
      '<picture><source type="image/webp" srcset="https://example.com/p.webp 1x"><img src="https://example.com/fallback.png" width="12" height="12" alt="pic" /></picture>',
      '',
    ].join('\n')

    root.render(
      React.createElement(MarkdownPreview, {
        markdownText,
        activeDocumentPath: '/test.md',
        highlightedLineRange: null,
        markdownWordWrap: true,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        uiPanelTextFontClass: 'font-sans',
        uiPanelMonospaceTextClass: 'font-mono',
        previewOverlayScope: 'container',
        previewOverlayPortalTarget: null,
        previewScrollable: false,
        showSidebar: false,
      }),
    )

    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
    const tick = () =>
      new Promise<void>(resolve => {
        const raf = anyWindow.requestAnimationFrame
        if (raf) {
          raf(() => resolve())
          return
        }
        setTimeout(() => resolve(), 0)
      })

    for (let i = 0; i < 16; i += 1) await tick()

    const svg = container.querySelector('svg')
    if (!svg) throw new Error('expected svg to be rendered')
    const iframe = container.querySelector('iframe')
    if (!iframe) throw new Error('expected iframe to be rendered')
    const protocolIframe = (Array.from(container.querySelectorAll('iframe')) as unknown as HTMLIFrameElement[]).find(el =>
      String(el.getAttribute('src') || '').includes('example.com/embed'),
    )
    if (!protocolIframe) throw new Error('expected protocol-relative iframe to be rendered')
    if (!String(protocolIframe.getAttribute('src') || '').startsWith('https://')) {
      throw new Error('expected protocol-relative iframe src to be normalized to https://')
    }
    const details = container.querySelector('details')
    if (!details) throw new Error('expected details to be rendered')
    const audio = container.querySelector('audio')
    if (!audio) throw new Error('expected audio to be rendered')
    const img = (Array.from(container.querySelectorAll('img')) as unknown as HTMLImageElement[]).find(el => (el.getAttribute('alt') || '') === 'webp')
    if (!img) throw new Error('expected webp img to be rendered')
    const imgSrc = String(img.getAttribute('src') || '')
    if (!imgSrc.includes('/__fetch_remote') && !imgSrc.includes('example.com/a.webp')) {
      throw new Error(`expected img src to resolve from srcset, got: ${imgSrc}`)
    }
    const pictureImg = (Array.from(container.querySelectorAll('img')) as unknown as HTMLImageElement[]).find(el => (el.getAttribute('alt') || '') === 'pic')
    if (!pictureImg) throw new Error('expected picture img to be rendered')
    const proxiedWebpImg = (Array.from(container.querySelectorAll('img')) as unknown as HTMLImageElement[]).find(el => (el.getAttribute('alt') || '') === 'webp-proxy')
    if (!proxiedWebpImg) throw new Error('expected proxied webp markdown image to be rendered')
    const proxiedWebpSrc = String(proxiedWebpImg.getAttribute('src') || '')
    if (!proxiedWebpSrc.includes('/__webpage_asset_proxy?url=')) {
      throw new Error(`expected proxied webp src to use asset proxy, got: ${proxiedWebpSrc}`)
    }
    if (proxiedWebpSrc.includes('amp%3B')) {
      throw new Error(`expected proxied webp src to normalize &amp; entities, got: ${proxiedWebpSrc}`)
    }
    const absProxyImg = (Array.from(container.querySelectorAll('img')) as unknown as HTMLImageElement[]).find(el => (el.getAttribute('alt') || '') === 'webp-proxy-abs')
    if (!absProxyImg) throw new Error('expected absolute proxy markdown image to be rendered')
    const absProxySrc = String(absProxyImg.getAttribute('src') || '')
    if (!absProxySrc.startsWith('/__webpage_asset_proxy?url=')) {
      throw new Error(`expected absolute proxy href to be rewritten to local proxy, got: ${absProxySrc}`)
    }
    const entityImg = (Array.from(container.querySelectorAll('img')) as unknown as HTMLImageElement[]).find(el => (el.getAttribute('alt') || '') === 'webp-entity')
    if (!entityImg) throw new Error('expected html-entity url markdown image to be rendered')
    const entitySrc = String(entityImg.getAttribute('src') || '')
    if (entitySrc.includes('amp;')) {
      throw new Error(`expected markdown image src to normalize &amp; entities, got: ${entitySrc}`)
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}
