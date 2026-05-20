import React from 'react'
import { createRoot } from 'react-dom/client'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownPreviewRendersInlineHtmlRichMedia() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const state = useGraphStore.getState()
  const prevMode = state.richMediaPanelMode
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'Before <img src="https://example.com/a.webp" alt="WebP" /> After',
      '',
      'Before <iframe src="https://example.com/"></iframe> After',
      '',
      '<blockquote class="reddit-embed-bq" data-embed-height="969">',
      '<a href=" `https://www.reddit.com/r/Trae_ai/comments/1ovcca2/comment/nojw5gz/` ">Comment</a><br> by',
      '<a href="https://www.reddit.com/user/Trae_AI/">u/Trae_AI</a> from discussion',
      '<a href="https://www.reddit.com/r/Trae_ai/comments/1ovcca2/join_the_parade_win_show_us_your_trae_solo/"></a><br> in',
      '<a href="https://www.reddit.com/r/Trae_ai/">Trae_ai</a>',
      '</blockquote><script async="" src=" `https://embed.reddit.com/widgets.js` " charset="UTF-8"></script>',
      '',
    ].join('\n')

    state.setRichMediaPanelMode('snapshot')

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

    for (let i = 0; i < 12; i += 1) await tick()

    const img = container.querySelector('img[alt="WebP"]') as HTMLImageElement | null
    if (!img) throw new Error('expected inline HTML img to render')
    const src = String(img.getAttribute('src') || '')
    if (!src) throw new Error('expected inline HTML img src to be set')
    if (!/a\.webp/i.test(decodeURIComponent(src))) throw new Error(`expected inline HTML img to reference .webp, got: ${src}`)

    const snapshot = container.querySelector('[data-kg-webpage-snapshot="1"][data-src*="example.com"]') as HTMLElement | null
    if (!snapshot) throw new Error(`expected inline HTML iframe to render as snapshot by default; html=${container.innerHTML}`)

    const iframe0 = container.querySelector('iframe') as HTMLIFrameElement | null
    if (iframe0) throw new Error(`expected no iframe in snapshot mode; html=${container.innerHTML}`)

    const redditSnap = container.querySelector('[data-kg-webpage-snapshot="1"][data-src*="reddit.com"]') as HTMLElement | null
    if (!redditSnap) throw new Error(`expected reddit embed to render as a snapshot preview card; html=${container.innerHTML}`)
    const thumb = redditSnap.querySelector('[data-kg-media-thumbnail="1"]') as HTMLElement | null
    if (!thumb) throw new Error('expected reddit snapshot to include thumbnail-click surface')

    state.setRichMediaPanelMode('embed')
    for (let i = 0; i < 10; i += 1) await tick()
    const iframe1 = container.querySelector('iframe') as HTMLIFrameElement | null
    if (!iframe1) throw new Error(`expected inline HTML iframe to render in embed mode; html=${container.innerHTML}`)

    root.unmount()
  } finally {
    state.setRichMediaPanelMode(prevMode)
    restoreDom()
  }
}

export async function testMarkdownPreviewRendersNestedInlineHtmlWrappers() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'Before <a href="https://example.com/docs"><strong>Read docs</strong></a> After',
      '',
      'Before <span style="color:#EF4444"><em>hot</em></span> After',
      '',
      'Before <abbr title="Application Programming Interface"><strong>API</strong></abbr> After',
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

    for (let i = 0; i < 12; i += 1) await tick()

    const anchor = container.querySelector('a[href="https://example.com/docs"]') as HTMLAnchorElement | null
    if (!anchor) throw new Error(`expected inline HTML anchor wrapper to render; html=${container.innerHTML}`)
    const strong = anchor.querySelector('strong')
    if (!strong || String(strong.textContent || '') !== 'Read docs') {
      throw new Error(`expected inline HTML anchor to preserve nested strong content; html=${container.innerHTML}`)
    }

    const styledSpan = Array.from(container.querySelectorAll('span')).find(
      element => element.querySelector('em') && String(element.textContent || '').includes('hot'),
    ) as HTMLSpanElement | undefined
    if (!styledSpan) throw new Error(`expected inline HTML span wrapper to render; html=${container.innerHTML}`)
    if (!String(styledSpan.style.color || '').trim()) {
      throw new Error(`expected inline HTML span wrapper to preserve safe inline style; html=${container.innerHTML}`)
    }

    const abbr = container.querySelector('abbr[title="Application Programming Interface"]') as HTMLElement | null
    if (!abbr) throw new Error(`expected inline HTML abbr wrapper to render; html=${container.innerHTML}`)
    if (!abbr.querySelector('strong') || String(abbr.textContent || '') !== 'API') {
      throw new Error(`expected inline HTML abbr to preserve nested inline children; html=${container.innerHTML}`)
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}

export async function testMarkdownPreviewRendersMasterSigilSemanticInlineTokens() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)

    const markdownText = [
      'Refs: `@comment:c-42` `@node:callout-alert-1` `@node:m-hero` `@edge:n-a:out→n-b:in`',
      '',
      'Range: Before `@comment:c-001`AI`@comment:c-001` after',
      '',
      'Typed: `@key:status` `@ui:viewer.toolbar` `$id:ABC-42` `$url:https://example.com/docs` `$enum:pending` `$date:2026-05-20` `$hash:#EF4444`',
      '',
      'Invalid: `@ui:File > Export` `$url:example.com/docs` `@key:{{draft}}`',
      '',
      'Footnote ref[^1]',
      '',
      '[^1]: Citation body',
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

    for (let i = 0; i < 12; i += 1) await tick()

    const commentRef = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="comment"]') as HTMLElement | null
    if (!commentRef || !String(commentRef.textContent || '').includes('c-42')) {
      throw new Error(`expected comment reference sigil to render as semantic inline token; html=${container.innerHTML}`)
    }
    const commentRange = container.querySelector('[data-kg-comment-range="1"]') as HTMLElement | null
    if (!commentRange || String(commentRange.textContent || '').trim() !== 'AI') {
      throw new Error(`expected paired comment range markers to render as a non-literal comment indicator around wrapped text; html=${container.innerHTML}`)
    }
    if (String(container.textContent || '').includes('@comment:c-001')) {
      throw new Error(`expected paired comment range markers not to leak raw sigils in static Viewer preview; text=${JSON.stringify(container.textContent || '')}`)
    }
    const calloutRef = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="callout"]') as HTMLElement | null
    if (!calloutRef || !String(calloutRef.textContent || '').includes('callout-alert-1')) {
      throw new Error(`expected callout reference sigil to render as semantic inline token; html=${container.innerHTML}`)
    }

    const mediaRef = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="media"]') as HTMLElement | null
    if (!mediaRef || !String(mediaRef.textContent || '').includes('m-hero')) {
      throw new Error(`expected media reference sigil to render as semantic inline token; html=${container.innerHTML}`)
    }

    const edgeRef = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="edge"]') as HTMLElement | null
    if (!edgeRef || !String(edgeRef.textContent || '').includes('n-a:out')) {
      throw new Error(`expected edge reference sigil to render as semantic inline token; html=${container.innerHTML}`)
    }

    const keyValue = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="key"]') as HTMLElement | null
    if (!keyValue || !String(keyValue.textContent || '').includes('status')) {
      throw new Error(`expected @key inline semantic token to render; html=${container.innerHTML}`)
    }

    const urlValue = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="url"] a[href="https://example.com/docs"]') as HTMLAnchorElement | null
    if (!urlValue) {
      throw new Error(`expected $url inline semantic token to render a safe anchor; html=${container.innerHTML}`)
    }

    const hashValue = container.querySelector('[data-kg-inline-code-token="1"][data-kg-inline-code-badge="hash"]') as HTMLElement | null
    if (!hashValue || !String(hashValue.textContent || '').includes('#EF4444')) {
      throw new Error(`expected $hash inline semantic token to render; html=${container.innerHTML}`)
    }

    const rawSemanticCode = Array.from(container.querySelectorAll('code')).find(node => {
      const text = String(node.textContent || '')
      return text.includes('@comment:c-42') || text.includes('$url:https://example.com/docs') || text.includes('$hash:#EF4444')
    })
    if (rawSemanticCode) {
      throw new Error(`expected Master Sigil semantic tokens not to fall back to raw inline code; html=${container.innerHTML}`)
    }

    const invalidUiCode = Array.from(container.querySelectorAll('code')).find(node => String(node.textContent || '').includes('@ui:File > Export'))
    if (!invalidUiCode) {
      throw new Error(`expected invalid @ui sigil using ">" to stay raw inline code; html=${container.innerHTML}`)
    }
    const invalidUrlCode = Array.from(container.querySelectorAll('code')).find(node => String(node.textContent || '').includes('$url:example.com/docs'))
    if (!invalidUrlCode) {
      throw new Error(`expected invalid $url sigil without scheme to stay raw inline code; html=${container.innerHTML}`)
    }
    const invalidKeyCode = Array.from(container.querySelectorAll('code')).find(node => String(node.textContent || '').includes('@key:{{draft}}'))
    if (!invalidKeyCode) {
      throw new Error(`expected invalid @key sigil with interpolation to stay raw inline code; html=${container.innerHTML}`)
    }

    const footnoteRef = container.querySelector('sup a[title="Footnote 1"]') as HTMLAnchorElement | null
    if (!footnoteRef) throw new Error(`expected footnote reference to render; html=${container.innerHTML}`)
    if (!String(footnoteRef.getAttribute('href') || '').startsWith('#fn')) {
      throw new Error(`expected footnote reference to point at a footnote anchor; html=${container.innerHTML}`)
    }
    if (String(footnoteRef.getAttribute('title') || '') !== 'Footnote 1') {
      throw new Error(`expected footnote reference to expose caption title; html=${container.innerHTML}`)
    }

    root.unmount()
  } finally {
    restoreDom()
  }
}
