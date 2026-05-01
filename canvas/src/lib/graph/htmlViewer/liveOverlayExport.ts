import { HTML_STYLE_PROPS, inlineComputedStylesIntoClone } from '@/lib/graph/svgSnapshot'

const stripOverlayTransformStyles = (el: Element) => {
  const node = el as HTMLElement
  if (!node || !node.style) return
  try {
    node.style.removeProperty('transform')
    node.style.removeProperty('transform-origin')
    node.style.removeProperty('translate')
    node.style.removeProperty('left')
    node.style.removeProperty('top')
    node.style.removeProperty('right')
    node.style.removeProperty('bottom')
    node.style.removeProperty('inset')
    node.style.removeProperty('position')
    node.style.removeProperty('width')
    node.style.removeProperty('height')
    node.style.removeProperty('z-index')
  } catch {
    void 0
  }
}

const hideOverlayUntilRuntimePositions = (el: Element) => {
  const node = el as HTMLElement
  if (!node || !node.style) return
  try {
    node.style.display = 'none'
  } catch {
    void 0
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
    }
  }
}

const collectOverlayRootsBySelectors = (selectors: readonly string[]): Element[] => {
  if (typeof document === 'undefined') return []
  const out: Element[] = []
  const seen = new Set<Element>()
  for (let i = 0; i < selectors.length; i += 1) {
    const selector = String(selectors[i] || '').trim()
    if (!selector) continue
    const list = Array.from(document.querySelectorAll(selector))
    for (let j = 0; j < list.length; j += 1) {
      const el = list[j] as Element
      if (!el || seen.has(el)) continue
      seen.add(el)
      out.push(el)
    }
  }
  return out
}

const toOverlayRoots = (el: Element | null, selectors: readonly string[]): Element[] => {
  if (el) return [el]
  return collectOverlayRootsBySelectors(selectors)
}

const overlaySourcePriority = (el: Element): number => {
  try {
    const h = el as HTMLElement
    const style = getComputedStyle(h)
    if (style.display === 'none') return 0
    if (style.visibility === 'hidden') return 0
    const opacity = Number(style.opacity)
    const rects = h.getClientRects().length
    if (rects > 0 && Number.isFinite(opacity) && opacity > 0.01) return 3
    if (rects > 0) return 2
    return 1
  } catch {
    return 1
  }
}

const pickCanonicalSourceByKey = (map: Map<string, Element>, key: string, candidate: Element): void => {
  if (!key) return
  const prev = map.get(key)
  if (!prev) {
    map.set(key, candidate)
    return
  }
  if (overlaySourcePriority(candidate) >= overlaySourcePriority(prev)) {
    map.set(key, candidate)
  }
}

const readMarkdownOverlayId = (el: Element): string => String(el.getAttribute('data-md-id') || '').trim()

const readMarkdownOverlayAnchorNodeId = (el: Element): string => {
  return String(el.getAttribute('data-kg-anchor-node-id') || '').trim()
}

const canonicalizeMarkdownOverlayAttrs = (el: Element, args: { id: string; anchorNodeId?: string }): void => {
  try {
    el.setAttribute('data-md-id', args.id)
  } catch {
    void 0
  }
  try {
    if (args.anchorNodeId) el.setAttribute('data-kg-anchor-node-id', args.anchorNodeId)
    else el.removeAttribute('data-kg-anchor-node-id')
  } catch {
    void 0
  }
}

export const captureLiveRichMediaOverlayHtmlForHtmlViewerExport = (args: {
  overlayRootEl: Element | null
}): string => {
  try {
    const roots = toOverlayRoots(args.overlayRootEl, [
      'section[aria-label="D3 rich media overlay"]',
      'section[aria-label="Flow media overlay"]',
      'section[aria-label="Design media overlay"]',
      'section[aria-label="3D media overlay"]',
      '#kg-overlay',
      '[data-kg-rich-media-overlay="1"]',
      '[data-kg-rich-media-panel="1"]',
    ])
    if (roots.length === 0) return ''

    const panelByNodeId = new Map<string, Element>()
    for (let i = 0; i < roots.length; i += 1) {
      const root = roots[i]
      const rootPanels = root.matches?.('[data-kg-rich-media-panel="1"][data-node-id]')
        ? [root]
        : Array.from(root.querySelectorAll('[data-kg-rich-media-panel="1"][data-node-id]'))
      for (let j = 0; j < rootPanels.length; j += 1) {
        const panel = rootPanels[j] as Element
        const nodeId = String(panel.getAttribute('data-node-id') || '').trim()
        if (!nodeId) continue
        pickCanonicalSourceByKey(panelByNodeId, nodeId, panel)
      }
    }
    const panels = Array.from(panelByNodeId.values())
    if (panels.length === 0) return ''

    const wrap = document.createElement('div')
    for (let i = 0; i < panels.length; i += 1) {
      const srcPanel = panels[i] as Element
      const clone = srcPanel.cloneNode(true) as Element
      inlineComputedStylesIntoClone(srcPanel, clone, HTML_STYLE_PROPS)
      stripOverlayTransformStyles(clone)
      hideOverlayUntilRuntimePositions(clone)
      try {
        ensureMediaAttrs(srcPanel, clone)
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

export const captureLiveMarkdownDesignOverlayHtmlForHtmlViewerExport = (args: {
  overlayRootEl: Element | null
}): string => {
  try {
    const roots = toOverlayRoots(args.overlayRootEl, [
      'section[aria-label="Design markdown overlay"]',
      'section[aria-label="Flow media overlay"]',
      '#kg-overlay',
      '[data-kg-markdown-design-overlay="1"]',
      '[data-md-id]',
    ])
    if (roots.length === 0) return ''

    const blockById = new Map<string, Element>()
    for (let i = 0; i < roots.length; i += 1) {
      const root = roots[i]
      const rootBlocks = root.matches?.('[data-md-id]')
        ? [root]
        : Array.from(root.querySelectorAll('[data-md-id]'))
      for (let j = 0; j < rootBlocks.length; j += 1) {
        const block = rootBlocks[j] as Element
        const id = readMarkdownOverlayId(block)
        if (!id) continue
        pickCanonicalSourceByKey(blockById, id, block)
      }
    }
    const blocks = Array.from(blockById.values())
    if (blocks.length === 0) return ''

    const wrap = document.createElement('div')
    for (let i = 0; i < blocks.length; i += 1) {
      const srcBlock = blocks[i] as Element
      const clone = srcBlock.cloneNode(true) as Element
      inlineComputedStylesIntoClone(srcBlock, clone, HTML_STYLE_PROPS)
      stripOverlayTransformStyles(clone)
      hideOverlayUntilRuntimePositions(clone)

      try {
        const id = readMarkdownOverlayId(srcBlock)
        const anchorNodeId = readMarkdownOverlayAnchorNodeId(srcBlock)
        if (id) canonicalizeMarkdownOverlayAttrs(clone, { id, anchorNodeId })
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
      overlayRootEl: null,
    })
    const mdHtml = captureLiveMarkdownDesignOverlayHtmlForHtmlViewerExport({
      overlayRootEl: null,
    })
    return `${mediaHtml}${mdHtml}`
  } catch {
    return ''
  }
}
