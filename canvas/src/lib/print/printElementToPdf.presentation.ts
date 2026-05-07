// Extracted helpers from printElementToPdf.ts
export const markMarkdownDividerPageBreaks = (root: Element): void => {
  const hrs = root.querySelectorAll('hr')
  const hasFollowingContent = (node: Element): boolean => {
    let cursor: Element | null = node
    while (cursor && cursor !== root) {
      if (cursor.nextElementSibling) return true
      cursor = cursor.parentElement
    }
    return false
  }
  for (let i = 0; i < hrs.length; i += 1) {
    const hr = hrs[i] as HTMLElement
    if (!hasFollowingContent(hr)) continue
    try {
      hr.setAttribute('data-kg-hr', '1')
      const next = hr.nextElementSibling as HTMLElement | null
      if (!next || next.getAttribute('data-kg-page-break') !== '1') {
        const marker = document.createElement('div')
        marker.setAttribute('data-kg-page-break', '1')
        hr.insertAdjacentElement('afterend', marker)
      }
    } catch {
      void 0
    }
  }
}

const resolvePresentationDeckElement = (root: Element): HTMLElement | null => {
  return (
    root.matches('[data-testid="markdown-presentation-print-deck"]')
      ? root
      : root.querySelector('[data-testid="markdown-presentation-print-deck"]')
  ) as HTMLElement | null
}

export const ensurePresentationPrintDeck = (root: HTMLElement): void => {
  const existingDeck = resolvePresentationDeckElement(root)
  if (existingDeck) return

  const slideDocs = Array.from(root.querySelectorAll('[aria-label="Slide Document"]')) as HTMLElement[]
  const seen = new Set<HTMLElement>()
  const sections: HTMLElement[] = []
  for (let i = 0; i < slideDocs.length; i += 1) {
    const doc = slideDocs[i]
    const section = doc.closest('section') as HTMLElement | null
    if (!section) continue
    if (!root.contains(section)) continue
    if (seen.has(section)) continue
    seen.add(section)
    sections.push(section)
  }

  if (sections.length === 0) {
    const loneArticle = (root.matches('article') ? root : root.querySelector('article')) as HTMLElement | null
    if (loneArticle) {
      const section = document.createElement('section')
      section.appendChild(loneArticle)
      sections.push(section)
    }
  }
  if (sections.length === 0) return

  const deck = document.createElement('section')
  deck.setAttribute('data-testid', 'markdown-presentation-print-deck')
  deck.className = 'w-full'
  for (let i = 0; i < sections.length; i += 1) {
    deck.appendChild(sections[i])
  }

  const presentationRoot = root.matches('[data-testid="markdown-presentation-root"]')
    ? root
    : (root.querySelector('[data-testid="markdown-presentation-root"]') as HTMLElement | null)
  const presentationMain = presentationRoot?.querySelector(':scope > main') as HTMLElement | null
  if (presentationMain) {
    try {
      presentationMain.replaceChildren(deck)
      return
    } catch {
      void 0
    }
  }
  try {
    root.replaceChildren(deck)
  } catch {
    void 0
  }
}

export const normalizePresentationDeckForPrint = (root: Element): void => {
  const deck = resolvePresentationDeckElement(root)
  if (!deck) return
  const sections = Array.from(deck.querySelectorAll(':scope > section')) as HTMLElement[]
  try {
    deck.replaceChildren(...sections)
  } catch {
    void 0
  }
  const isMeaningful = (section: HTMLElement): boolean => {
    const article = section.querySelector(':scope > article') as HTMLElement | null
    const probe = article || section
    if (
      probe.querySelector(
        'img,video,iframe,svg,canvas,table,pre,code,blockquote,h1,h2,h3,h4,h5,h6,p,li,[data-kg-video-snapshot="1"],[data-kg-webpage-snapshot="1"]',
      )
    ) {
      return true
    }
    const text = String(probe.textContent || '').replace(/\u200B/g, '').trim()
    return text.length > 0
  }

  for (let i = sections.length - 1; i >= 0; i -= 1) {
    const section = sections[i]
    if (isMeaningful(section)) break
    try {
      section.remove()
    } catch {
      void 0
    }
  }
}

export const materializePresentationPages = (root: HTMLElement): void => {
  const deck = resolvePresentationDeckElement(root)
  if (!deck) return
  const sections = Array.from(deck.querySelectorAll(':scope > section')) as HTMLElement[]
  if (sections.length === 0) return
  const pages: HTMLElement[] = []
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i]
    const page = document.createElement('div')
    page.setAttribute('data-kg-presentation-page', '1')
    page.appendChild(section)
    pages.push(page)
  }
  try {
    deck.replaceChildren(...pages)
  } catch {
    void 0
  }
}

export const collectEmbeddableCssText = (): string => {
  if (typeof document === 'undefined') return ''
  const chunks: string[] = []
  const sheets = Array.from(document.styleSheets || [])
  for (let i = 0; i < sheets.length; i += 1) {
    const sheet = sheets[i] as CSSStyleSheet
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    if (!rules || rules.length === 0) continue
    for (let j = 0; j < rules.length; j += 1) {
      const rule = rules[j]
      const cssText = String(rule?.cssText || '').trim()
      if (!cssText) continue
      chunks.push(cssText)
    }
  }
  return chunks.join('\n')
}

export const flattenPresentationPagesToSlideSurfaces = (root: HTMLElement): void => {
  const deck = resolvePresentationDeckElement(root)
  if (!deck) return
  const pages = Array.from(deck.querySelectorAll(':scope > [data-kg-presentation-page="1"]')) as HTMLElement[]
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i]
    const existingFrame = page.querySelector(':scope > [data-kg-presentation-page-frame="1"]') as HTMLElement | null
    if (existingFrame) continue
    const surface = page.querySelector('[data-kg-presentation-slide-surface="1"]') as HTMLElement | null
    const section = page.querySelector(':scope > section') as HTMLElement | null
    const article = page.querySelector(':scope > article') as HTMLElement | null
    const frameContent = surface || section || article
    if (!frameContent) continue
    try {
      const frame = document.createElement('div')
      frame.setAttribute('data-kg-presentation-page-frame', '1')
      frame.appendChild(frameContent)
      page.replaceChildren(frame)
    } catch {
      void 0
    }
  }
}

export const forceRenderPendingMermaidGates = (el: HTMLElement): Promise<void> => {
  const pendingGates = el.querySelectorAll('[data-kg-mermaid-visibility-gate="pending"]')
  if (pendingGates.length === 0) return Promise.resolve()
  for (let i = 0; i < pendingGates.length; i += 1) {
    try {
      (pendingGates[i] as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' })
    } catch {
      void 0
    }
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 2_000)
  })
}

export const waitForImagesToLoad = (root: HTMLElement, timeoutMs: number): Promise<void> => {
  const imgs = root.querySelectorAll('img')
  if (imgs.length === 0) return Promise.resolve()
  const pending = new Set<HTMLImageElement>()
  for (let i = 0; i < imgs.length; i += 1) {
    const img = imgs[i] as HTMLImageElement
    if (img.complete && img.naturalWidth > 0) continue
    pending.add(img)
  }
  if (pending.size === 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const onEach = (img: HTMLImageElement) => {
      pending.delete(img)
      if (pending.size === 0) finish()
    }
    for (const img of pending) {
      img.addEventListener('load', () => onEach(img), { once: true })
      img.addEventListener('error', () => onEach(img), { once: true })
    }
    setTimeout(finish, timeoutMs)
  })
}

export const copyScrollableState = (src: HTMLElement, dst: HTMLElement): void => {
  try {
    dst.scrollTop = src.scrollTop
    dst.scrollLeft = src.scrollLeft
  } catch {
    void 0
  }
  const srcNodes = src.querySelectorAll('*')
  const dstNodes = dst.querySelectorAll('*')
  const len = Math.min(srcNodes.length, dstNodes.length)
  for (let i = 0; i < len; i += 1) {
    const srcNode = srcNodes[i] as HTMLElement
    const dstNode = dstNodes[i] as HTMLElement
    try {
      dstNode.scrollTop = srcNode.scrollTop
      dstNode.scrollLeft = srcNode.scrollLeft
    } catch {
      void 0
    }
  }
}

export const copyPresentationScrollableState = (src: HTMLElement, dst: HTMLElement): void => {
  const SCROLLER_SELECTORS = ['[aria-label="Slide Content"]', '[aria-label="Slide Left Column"]', '[aria-label="Slide Right Column"]']
  for (let i = 0; i < SCROLLER_SELECTORS.length; i += 1) {
    const selector = SCROLLER_SELECTORS[i]
    const srcScrollers = src.querySelectorAll(selector)
    const dstScrollers = dst.querySelectorAll(selector)
    const len = Math.min(srcScrollers.length, dstScrollers.length)
    for (let j = 0; j < len; j += 1) {
      const srcScroller = srcScrollers[j] as HTMLElement
      const dstScroller = dstScrollers[j] as HTMLElement
      try {
        dstScroller.scrollLeft = srcScroller.scrollLeft
        dstScroller.scrollTop = srcScroller.scrollTop
      } catch {
        void 0
      }
    }
  }
}

export const freezePresentationScrollViewports = (root: HTMLElement): void => {
  const SCROLLER_SELECTORS = ['[aria-label="Slide Content"]', '[aria-label="Slide Left Column"]', '[aria-label="Slide Right Column"]']
  for (let i = 0; i < SCROLLER_SELECTORS.length; i += 1) {
    const selector = SCROLLER_SELECTORS[i]
    const scrollers = root.querySelectorAll(selector)
    for (let j = 0; j < scrollers.length; j += 1) {
      const scroller = scrollers[j] as HTMLElement
      if (!scroller) continue
      const viewportHeightPx = Math.max(0, Math.floor(scroller.clientHeight))
      if (viewportHeightPx <= 0) continue
      try {
        // Lock the print clone to the same viewport seen in Workspace Presentation.
        scroller.style.height = `${viewportHeightPx}px`
        scroller.style.minHeight = `${viewportHeightPx}px`
        scroller.style.maxHeight = `${viewportHeightPx}px`
        scroller.style.overflow = 'clip'
        scroller.style.display = 'block'
        scroller.style.position = 'relative'
        scroller.style.contain = 'layout paint'
        scroller.style.breakInside = 'avoid'
        scroller.style.pageBreakInside = 'avoid'
      } catch {
        void 0
      }
    }
  }
}

export const convertPresentationSectionsToSingleSlideSvg = (
  root: HTMLElement,
  slideWidthPx: number,
  slideHeightPx: number,
  embeddedCssText: string,
): void => {
  const deck = resolvePresentationDeckElement(root)
  if (!deck) return
  const sections = deck.querySelectorAll(':scope > section')
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i] as HTMLElement
    const article = section.querySelector(':scope > article') as HTMLElement | null
    if (!article) continue
    let replaced = false
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const clipId = `kg-slide-clip-${i}`
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svg.setAttribute('viewBox', `0 0 ${slideWidthPx} ${slideHeightPx}`)
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', '100%')
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      svg.setAttribute('overflow', 'hidden')
      svg.style.overflow = 'hidden'
      svg.style.width = '100%'
      svg.style.height = '100%'
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
      const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
      clipPath.setAttribute('id', clipId)
      clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse')
      const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      clipRect.setAttribute('x', '0')
      clipRect.setAttribute('y', '0')
      clipRect.setAttribute('width', String(slideWidthPx))
      clipRect.setAttribute('height', String(slideHeightPx))
      clipPath.appendChild(clipRect)
      defs.appendChild(clipPath)
      svg.appendChild(defs)
      if (embeddedCssText) {
        const styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style')
        styleTag.textContent = embeddedCssText
        svg.appendChild(styleTag)
      }
      svg.setAttribute('data-kg-presentation-slide-svg', '1')

      const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
      fo.setAttribute('x', '0')
      fo.setAttribute('y', '0')
      fo.setAttribute('width', '100%')
      fo.setAttribute('height', '100%')
      fo.setAttribute('clip-path', `url(#${clipId})`)
      fo.setAttribute('overflow', 'hidden')
      fo.style.overflow = 'hidden'

      const xhtmlRoot = document.createElementNS('http://www.w3.org/1999/xhtml', 'div')
      xhtmlRoot.style.width = `${slideWidthPx}px`
      xhtmlRoot.style.height = `${slideHeightPx}px`
      xhtmlRoot.style.maxWidth = `${slideWidthPx}px`
      xhtmlRoot.style.maxHeight = `${slideHeightPx}px`
      xhtmlRoot.style.display = 'block'
      xhtmlRoot.style.overflow = 'hidden'
      xhtmlRoot.style.boxSizing = 'border-box'
      xhtmlRoot.style.background = 'transparent'
      const articleClone = article.cloneNode(true) as HTMLElement
      articleClone.style.width = '100%'
      articleClone.style.height = '100%'
      articleClone.style.maxWidth = '100%'
      articleClone.style.maxHeight = '100%'
      articleClone.style.display = 'block'
      articleClone.style.overflow = 'hidden'
      articleClone.style.boxSizing = 'border-box'
      xhtmlRoot.appendChild(articleClone)

      fo.appendChild(xhtmlRoot)
      svg.appendChild(fo)
      // Keep a live inline SVG+foreignObject slide surface to preserve rich media fidelity.
      // Serialized SVG image surfaces can degrade to text-only output in this environment.
      svg.setAttribute('data-kg-presentation-slide-surface', '1')
      section.replaceChildren(svg)
      replaced = true
    } catch {
      void 0
    }
    if (!replaced) {
      try {
        // Keep page-surface invariants even when SVG conversion fails.
        article.setAttribute('data-kg-presentation-slide-surface', '1')
      } catch {
        void 0
      }
    }
  }
}
