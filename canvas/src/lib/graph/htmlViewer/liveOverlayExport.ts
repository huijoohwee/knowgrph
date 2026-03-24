import { HTML_STYLE_PROPS, inlineComputedStylesIntoClone } from '@/lib/graph/svgSnapshot'

const LIVE_OVERLAY_INLINE_STYLE_PROPS: readonly string[] = HTML_STYLE_PROPS.filter(
  (p) => p !== 'pointer-events',
)

const stripCanvasIgnoreAttrsDeep = (el: Element) => {
  const all: Element[] = [el, ...Array.from(el.querySelectorAll('*'))]
  for (let i = 0; i < all.length; i += 1) {
    const n = all[i]
    try {
      n.removeAttribute('data-kg-canvas-pointer-ignore')
      n.removeAttribute('data-kg-canvas-wheel-ignore')
    } catch {
      void 0
    }
  }
}

const stripInlineInteractionStylesDeep = (el: Element) => {
  const all: Element[] = [el, ...Array.from(el.querySelectorAll('*'))]
  for (let i = 0; i < all.length; i += 1) {
    const n = all[i] as HTMLElement
    if (!n || !n.style) continue
    try {
      n.style.removeProperty('pointer-events')
      n.style.removeProperty('touch-action')
      n.style.removeProperty('user-select')
      n.style.removeProperty('-webkit-user-select')
    } catch {
      void 0
    }
  }
}

const ensureMediaAttrs = (src: Element, dst: Element) => {
  const srcAll = src.querySelectorAll('img,video,source,iframe')
  const dstAll = dst.querySelectorAll('img,video,source,iframe')
  const len = Math.min(srcAll.length, dstAll.length)
  for (let i = 0; i < len; i += 1) {
    const s = srcAll[i] as Element
    const d = dstAll[i] as Element
    const tag = String(s.tagName || '').toLowerCase()
    if (tag === 'img') {
      const si = s as HTMLImageElement
      const di = d as HTMLImageElement
      const url = String(si.currentSrc || si.src || di.getAttribute('src') || '').trim()
      if (url) {
        try {
          di.setAttribute('src', url)
        } catch {
          void 0
        }
      }
      try {
        di.style.removeProperty('pointer-events')
      } catch {
        void 0
      }
      continue
    }
    if (tag === 'video' || tag === 'source') {
      const url = String((s as HTMLMediaElement).currentSrc || (s as HTMLMediaElement).src || d.getAttribute('src') || '').trim()
      if (url) {
        try {
          d.setAttribute('src', url)
        } catch {
          void 0
        }
      }
      try {
        ;(d as HTMLElement).style.removeProperty('pointer-events')
      } catch {
        void 0
      }
      continue
    }
    if (tag === 'iframe') {
      const si = s as HTMLIFrameElement
      const di = d as HTMLIFrameElement
      const srcDoc = typeof si.srcdoc === 'string' ? si.srcdoc : ''
      if (srcDoc) {
        try {
          di.removeAttribute('src')
        } catch {
          void 0
        }
        try {
          di.setAttribute('srcdoc', srcDoc)
        } catch {
          void 0
        }
        continue
      }
      const url = String(si.src || d.getAttribute('src') || '').trim()
      if (url) {
        try {
          di.setAttribute('src', url)
        } catch {
          void 0
        }
      }
      try {
        di.style.removeProperty('pointer-events')
      } catch {
        void 0
      }
    }
  }
}

export const captureLiveRichMediaOverlayHtmlForHtmlViewerExport = (args: {
  overlayRootEl: Element | null
}): string => {
  try {
    const overlayRootEl = args.overlayRootEl
    if (!overlayRootEl) return ''

    const panels = Array.from(overlayRootEl.querySelectorAll('[data-kg-rich-media-panel="1"][data-node-id]'))
    if (panels.length === 0) return ''

    const wrap = document.createElement('div')
    for (let i = 0; i < panels.length; i += 1) {
      const srcPanel = panels[i] as Element
      const clone = srcPanel.cloneNode(true) as Element
      inlineComputedStylesIntoClone(srcPanel, clone, LIVE_OVERLAY_INLINE_STYLE_PROPS)
      try {
        ensureMediaAttrs(srcPanel, clone)
      } catch {
        void 0
      }
      stripCanvasIgnoreAttrsDeep(clone)
      stripInlineInteractionStylesDeep(clone)
      wrap.appendChild(clone)
    }
    return wrap.innerHTML
  } catch {
    return ''
  }
}

export const captureLiveMarkdownDesignOverlayHtmlForHtmlViewerExport = (args: {
  overlayRootEl: Element | null
}): string => {
  try {
    const overlayRootEl = args.overlayRootEl
    if (!overlayRootEl) return ''

    const blocks = Array.from(overlayRootEl.querySelectorAll('[data-kg-markdown-design-block]'))
    if (blocks.length === 0) return ''

    const wrap = document.createElement('div')
    for (let i = 0; i < blocks.length; i += 1) {
      const srcBlock = blocks[i] as Element
      const clone = srcBlock.cloneNode(true) as Element
      inlineComputedStylesIntoClone(srcBlock, clone, LIVE_OVERLAY_INLINE_STYLE_PROPS)
      stripCanvasIgnoreAttrsDeep(clone)
      stripInlineInteractionStylesDeep(clone)

      try {
        const id = String(srcBlock.getAttribute('data-kg-markdown-design-block') || '').trim()
        if (id) clone.setAttribute('data-md-id', id)
      } catch {
        void 0
      }
      wrap.appendChild(clone)
    }

    return wrap.innerHTML
  } catch {
    return ''
  }
}

export const captureLiveOverlayHtmlForHtmlViewerExport = (): string => {
  try {
    const mediaHtml = captureLiveRichMediaOverlayHtmlForHtmlViewerExport({
      overlayRootEl: document.querySelector('section[aria-label="D3 rich media overlay"]'),
    })
    const mdHtml = captureLiveMarkdownDesignOverlayHtmlForHtmlViewerExport({
      overlayRootEl: document.querySelector('section[aria-label="Design markdown overlay"]'),
    })
    return `${mediaHtml}${mdHtml}`
  } catch {
    return ''
  }
}
