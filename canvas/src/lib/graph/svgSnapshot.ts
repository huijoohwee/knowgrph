const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

const DEFAULT_STYLE_PROPS: readonly string[] = [
  'color',
  'opacity',
  'display',
  'visibility',
  'pointer-events',
  'cursor',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'marker',
  'marker-start',
  'marker-mid',
  'marker-end',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  'text-rendering',
  'overflow',
  'clip-rule',
  'transform',
  'transform-origin',
  'transform-box',
  'animation',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-play-state',
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'baseline-shift',
  'filter',
  'mix-blend-mode',
  'clip-path',
  'mask',
  'stop-color',
  'stop-opacity',
] as const

const MARKDOWN_DESIGN_BLOCK_SELECTOR = '[data-md-id]'

const readMarkdownDesignBlockId = (el: Element): string => {
  return String(el.getAttribute('data-md-id') || '').trim()
}

export type SvgSnapshotOptions = {
  includeXmlDeclaration?: boolean
  paddingPx?: number
  inlineComputedStyles?: boolean
  removeCssClasses?: boolean
  removeDataAttributes?: boolean
  removeZoomTransformOnFirstGroup?: boolean
  styleProperties?: readonly string[]
}

const clampFinite = (n: unknown, min: number, max: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : NaN
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

const ensureSvgNamespaces = (svg: SVGSVGElement) => {
  try {
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', SVG_NS)
    if (!svg.getAttribute('xmlns:xlink')) svg.setAttribute('xmlns:xlink', XLINK_NS)
  } catch {
    void 0
  }
}

const removeDataAttrsDeep = (root: Element) => {
  const all = root.querySelectorAll('*')
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i] as Element
    const attrs = el.attributes
    for (let j = attrs.length - 1; j >= 0; j -= 1) {
      const a = attrs.item(j)
      const name = a?.name || ''
      if (name.startsWith('data-')) {
        try {
          el.removeAttribute(name)
        } catch {
          void 0
        }
      }
    }
  }
}

const removeClassesDeep = (root: Element) => {
  const all = root.querySelectorAll('*')
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i] as Element
    try {
      el.removeAttribute('class')
    } catch {
      void 0
    }
  }
}

export const inlineComputedStylesIntoClone = (srcSvg: Element, dstSvg: Element, props: readonly string[]) => {
  const srcAll = [srcSvg, ...Array.from(srcSvg.querySelectorAll('*'))]
  const dstAll = [dstSvg, ...Array.from(dstSvg.querySelectorAll('*'))]
  const len = Math.min(srcAll.length, dstAll.length)
  for (let i = 0; i < len; i += 1) {
    const src = srcAll[i] as Element
    const dst = dstAll[i] as Element
    let cs: CSSStyleDeclaration | null = null
    try {
      cs = getComputedStyle(src)
    } catch {
      cs = null
    }
    if (!cs) continue

    const kv: string[] = []
    for (let p = 0; p < props.length; p += 1) {
      const prop = props[p] || ''
      let v = ''
      try {
        v = String(cs.getPropertyValue(prop) || '').trim()
      } catch {
        v = ''
      }
      if (!v) continue
      kv.push(`${prop}:${v}`)
    }
    if (kv.length > 0) {
      try {
        dst.setAttribute('style', kv.join(';'))
      } catch {
        void 0
      }
    } else {
      try {
        dst.removeAttribute('style')
      } catch {
        void 0
      }
    }
  }
}

const computeContentBBoxFromClone = (
  svgClone: SVGSVGElement,
  opts: { removeZoomTransformOnFirstGroup?: boolean },
): { x: number; y: number; width: number; height: number } | null => {
  if (typeof document === 'undefined') return null
  const host = document.createElement('section')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '-100000px'
  host.style.width = '0'
  host.style.height = '0'
  host.style.overflow = 'hidden'
  host.style.opacity = '0'
  host.style.pointerEvents = 'none'

  const g = svgClone.querySelector('g')
  if (opts.removeZoomTransformOnFirstGroup !== false && g) {
    try {
      g.removeAttribute('transform')
    } catch {
      void 0
    }
  }

  try {
    document.body.appendChild(host)
    host.appendChild(svgClone)
    const target = (g || svgClone) as unknown as SVGGraphicsElement
    if (typeof target.getBBox !== 'function') return null
    const bbox = target.getBBox()
    const x = bbox && Number.isFinite(bbox.x) ? bbox.x : NaN
    const y = bbox && Number.isFinite(bbox.y) ? bbox.y : NaN
    const width = bbox && Number.isFinite(bbox.width) ? bbox.width : NaN
    const height = bbox && Number.isFinite(bbox.height) ? bbox.height : NaN
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null
    if (width <= 0 || height <= 0) return null
    return { x, y, width, height }
  } catch {
    return null
  } finally {
    try {
      host.remove()
    } catch {
      void 0
    }
  }
}

export const HTML_STYLE_PROPS: readonly string[] = [
  ...DEFAULT_STYLE_PROPS,
  'background', 'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat',
  'border', 'border-radius', 'border-top', 'border-bottom', 'border-left', 'border-right',
  'border-color', 'border-width', 'border-style',
  'border-top-color', 'border-top-width', 'border-top-style',
  'border-right-color', 'border-right-width', 'border-right-style',
  'border-bottom-color', 'border-bottom-width', 'border-bottom-style',
  'border-left-color', 'border-left-width', 'border-left-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'overflow', 'overflow-wrap', 'white-space', 'text-overflow', 'word-break',
  'text-decoration', 'text-transform', 'line-height', 'list-style', 'position',
  'top', 'left', 'right', 'bottom', 'z-index', 'transform', 'transform-origin',
  'align-items', 'justify-content', 'flex-direction', 'flex-wrap', 'display', 'gap',
  'flex', 'flex-grow', 'flex-shrink', 'flex-basis',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'grid-area', 'grid-template-areas', 'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-align', 'vertical-align',
  'box-shadow', 'backdrop-filter', 'outline', 'outline-color', 'outline-width', 'outline-style', 'outline-offset',
  'text-indent', 'text-shadow', 'border-collapse', 'border-spacing', 'table-layout', 'empty-cells'
]

export const buildStandaloneSvgMarkupFromElement = (svgEl: SVGSVGElement, options?: SvgSnapshotOptions): string | null => {
  try {
    const opts: SvgSnapshotOptions = options || {}
    const paddingPx = clampFinite(opts.paddingPx, 0, 2000)
    const includeXmlDeclaration = opts.includeXmlDeclaration !== false
    const inlineComputedStyles = opts.inlineComputedStyles !== false
    const removeCssClasses = opts.removeCssClasses !== false
    const removeDataAttributes = opts.removeDataAttributes === true
    const removeZoomTransformOnFirstGroup = opts.removeZoomTransformOnFirstGroup !== false
    const styleProps = Array.isArray(opts.styleProperties) && opts.styleProperties.length > 0 ? opts.styleProperties : DEFAULT_STYLE_PROPS

    const clone = svgEl.cloneNode(true) as SVGSVGElement
    try {
      clone.removeAttribute('style')
    } catch {
      void 0
    }
    ensureSvgNamespaces(clone)

    if (removeCssClasses) removeClassesDeep(clone)
    if (removeDataAttributes) removeDataAttrsDeep(clone)

    if (inlineComputedStyles) {
      inlineComputedStylesIntoClone(svgEl, clone, styleProps)
    }

    const bbox = computeContentBBoxFromClone(clone, { removeZoomTransformOnFirstGroup })

    const applyFallbackSize = () => {
      const vb = clone.viewBox && clone.viewBox.baseVal ? clone.viewBox.baseVal : null
      const w = vb && vb.width > 0 ? vb.width : svgEl.clientWidth || 800
      const h = vb && vb.height > 0 ? vb.height : svgEl.clientHeight || 600
      const width = Math.max(1, Math.floor(w))
      const height = Math.max(1, Math.floor(h))
      try {
        if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
        clone.setAttribute('width', String(width))
        clone.setAttribute('height', String(height))
      } catch {
        void 0
      }
    }

    if (bbox) {
      const x = bbox.x - paddingPx
      const y = bbox.y - paddingPx
      const w = bbox.width + paddingPx * 2
      const h = bbox.height + paddingPx * 2
      const width = Math.max(1, Math.ceil(w))
      const height = Math.max(1, Math.ceil(h))
      try {
        clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
        clone.setAttribute('width', String(width))
        clone.setAttribute('height', String(height))
        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      } catch {
        void 0
      }
    } else {
      applyFallbackSize()
    }

    const markup = new XMLSerializer().serializeToString(clone)
    const trimmed = String(markup || '').trim()
    if (!trimmed) return null
    return includeXmlDeclaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${trimmed}\n` : trimmed
  } catch {
    return null
  }
}

export const buildViewportSvgMarkupFromElement = (svgEl: SVGSVGElement, options?: SvgSnapshotOptions): string | null => {
  try {
    const opts: SvgSnapshotOptions = options || {}
    const includeXmlDeclaration = opts.includeXmlDeclaration !== false
    const inlineComputedStyles = opts.inlineComputedStyles !== false
    const removeCssClasses = opts.removeCssClasses !== false
    const removeDataAttributes = opts.removeDataAttributes === true
    const styleProps = Array.isArray(opts.styleProperties) && opts.styleProperties.length > 0 ? opts.styleProperties : DEFAULT_STYLE_PROPS

    const clone = svgEl.cloneNode(true) as SVGSVGElement
    try {
      clone.removeAttribute('style')
    } catch {
      void 0
    }
    ensureSvgNamespaces(clone)

    if (removeCssClasses) removeClassesDeep(clone)
    if (removeDataAttributes) removeDataAttrsDeep(clone)

    if (inlineComputedStyles) {
      inlineComputedStylesIntoClone(svgEl, clone, styleProps)
    }

    try {
      const findScopeEl = (): Element | null => {
        let cur: Element | null = svgEl
        for (let i = 0; i < 24 && cur; i += 1) {
          const id = String((cur as any).id || '')
          if (id === 'kg-root') return cur
          cur = cur.parentElement
        }
        return svgEl.ownerDocument?.body ?? null
      }

      const scopeEl = findScopeEl()
      const blocks = scopeEl ? scopeEl.querySelectorAll(MARKDOWN_DESIGN_BLOCK_SELECTOR) : null
      if (blocks && blocks.length > 0) {
        const zoomRoot = (() => {
          const kids = Array.from(clone.children)
          for (let i = 0; i < kids.length; i += 1) {
            const el = kids[i] as Element
            if (String((el as any).tagName || '').toLowerCase() === 'g') return el as SVGGElement
          }
          return null
        })()
        if (zoomRoot) {
          let mdLayer = zoomRoot.querySelector('g[data-kg-layer="markdown-design-blocks"]')
          if (!mdLayer) {
            mdLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
            mdLayer.setAttribute('data-kg-layer', 'markdown-design-blocks')
            zoomRoot.appendChild(mdLayer)
          }
          for (let i = 0; i < blocks.length; i += 1) {
            const block = blocks[i] as HTMLElement
            const wx = Number(block.getAttribute('data-kg-world-x'))
            const wy = Number(block.getAttribute('data-kg-world-y'))
            const ww = Number(block.getAttribute('data-kg-world-w'))
            const wh = Number(block.getAttribute('data-kg-world-h'))
            if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(ww) || !Number.isFinite(wh)) continue

            const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
            fo.setAttribute('x', String(wx))
            fo.setAttribute('y', String(wy))
            fo.setAttribute('width', String(ww))
            fo.setAttribute('height', String(wh))
            fo.style.overflow = 'visible'

            const content = block.cloneNode(true) as HTMLElement
            content.removeAttribute('style')
            content.style.margin = '0'
            content.style.padding = '0'
            content.style.width = '100%'
            content.style.height = '100%'
            content.style.overflow = 'hidden'
            content.style.pointerEvents = 'none'

            if (inlineComputedStyles) {
              inlineComputedStylesIntoClone(block, content, HTML_STYLE_PROPS)
            }

            content.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
            fo.appendChild(content)
            mdLayer.appendChild(fo)
          }
        }
      }
    } catch (err) {
      console.warn('Failed to snapshot markdown design blocks', err)
    }

    const rect = (() => {
      try {
        return svgEl.getBoundingClientRect()
      } catch {
        return null
      }
    })()
    const w = rect && Number.isFinite(rect.width) && rect.width > 0 ? Math.floor(rect.width) : svgEl.clientWidth || 800
    const h = rect && Number.isFinite(rect.height) && rect.height > 0 ? Math.floor(rect.height) : svgEl.clientHeight || 600
    const width = Math.max(1, Math.floor(w))
    const height = Math.max(1, Math.floor(h))

    try {
      const viewBox = String(svgEl.getAttribute('viewBox') || '').trim()
      if (viewBox) clone.setAttribute('viewBox', viewBox)
      clone.setAttribute('width', String(width))
      clone.setAttribute('height', String(height))
      const par = String(svgEl.getAttribute('preserveAspectRatio') || '').trim()
      if (par) clone.setAttribute('preserveAspectRatio', par)
    } catch {
      void 0
    }

    const markup = new XMLSerializer().serializeToString(clone)
    const trimmed = String(markup || '').trim()
    if (!trimmed) return null
    return includeXmlDeclaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${trimmed}\n` : trimmed
  } catch {
    return null
  }
}

export const injectLiveMarkdownDesignBlocksIntoSvgMarkup = (svgMarkup: string): string => {
  const raw = String(svgMarkup || '').trim()
  if (!raw) return ''
  if (typeof document === 'undefined') return raw
  const noXml = raw.replace(/^<\?xml[^>]*>\s*/i, '')

  let parsedDoc: Document
  try {
    const parser = new DOMParser()
    parsedDoc = parser.parseFromString(noXml, 'image/svg+xml')
  } catch {
    return raw
  }

  const parsedSvg = parsedDoc.querySelector('svg') as unknown as SVGSVGElement | null
  if (!parsedSvg) return raw

  const svg = (() => {
    try {
      return document.importNode(parsedSvg, true) as unknown as SVGSVGElement
    } catch {
      return parsedSvg.cloneNode(true) as SVGSVGElement
    }
  })()

  const doc = svg.ownerDocument
  if (!doc) return raw

  ensureSvgNamespaces(svg)

  const findScopeEl = (): Element | null => {
    try {
      const root = typeof document !== 'undefined' ? document.getElementById('kg-root') : null
      if (root) return root
    } catch {
      void 0
    }
    try {
      return typeof document !== 'undefined' ? document.body : null
    } catch {
      return null
    }
  }

  const scopeEl = findScopeEl()
  const blocks = scopeEl ? scopeEl.querySelectorAll(MARKDOWN_DESIGN_BLOCK_SELECTOR) : null
  if (!blocks || blocks.length === 0) return raw

  const zoomRoot = (svg.querySelector('g') as unknown as SVGGElement | null) || null
  if (!zoomRoot) return raw

  let mdLayer = zoomRoot.querySelector('g[data-kg-layer="markdown-design-blocks"]') as SVGGElement | null
  if (!mdLayer) {
    mdLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g') as unknown as SVGGElement
    mdLayer.setAttribute('data-kg-layer', 'markdown-design-blocks')
    zoomRoot.appendChild(mdLayer)
  }
  while (mdLayer.firstChild) mdLayer.removeChild(mdLayer.firstChild)

  for (let i = 0; i < blocks.length; i += 1) {
    try {
      const block = blocks[i] as HTMLElement
      const wx = Number(block.getAttribute('data-kg-world-x'))
      const wy = Number(block.getAttribute('data-kg-world-y'))
      const ww = Number(block.getAttribute('data-kg-world-w'))
      const wh = Number(block.getAttribute('data-kg-world-h'))
      if (!Number.isFinite(wx) || !Number.isFinite(wy) || !Number.isFinite(ww) || !Number.isFinite(wh) || ww <= 0 || wh <= 0) continue

      const fo = doc.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') as unknown as SVGForeignObjectElement
      fo.setAttribute('x', String(wx))
      fo.setAttribute('y', String(wy))
      fo.setAttribute('width', String(ww))
      fo.setAttribute('height', String(wh))
      try {
        ;(fo.style as any).overflow = 'visible'
      } catch {
        void 0
      }

      const content = block.cloneNode(true) as HTMLElement
      try {
        content.removeAttribute('style')
      } catch {
        void 0
      }
      content.style.margin = '0'
      content.style.padding = '0'
      content.style.width = '100%'
      content.style.height = '100%'
      content.style.overflow = 'hidden'
      content.style.pointerEvents = 'none'

      try {
        inlineComputedStylesIntoClone(block, content, HTML_STYLE_PROPS)
      } catch {
        void 0
      }

      content.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
      fo.appendChild(content)
      mdLayer.appendChild(fo)
    } catch {
      void 0
    }
  }

  try {
    const out = new XMLSerializer().serializeToString(svg)
    const trimmed = String(out || '').trim()
    if (!trimmed) return raw
    return raw.startsWith('<?xml') ? `<?xml version="1.0" encoding="UTF-8"?>\n${trimmed}\n` : trimmed
  } catch {
    try {
      const alt = String((svg as unknown as { outerHTML?: unknown }).outerHTML || '').trim()
      if (alt) return alt
    } catch {
      void 0
    }
    return raw
  }
}

export const injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored = (args: {
  svgMarkup: string
  anchorNodeIdByBlockId?: Record<string, string> | null
  nodePosById?: Record<string, { x: number; y: number }> | null
}): string => {
  const raw = String(args.svgMarkup || '').trim()
  if (!raw) return ''
  if (typeof document === 'undefined') return raw
  const noXml = raw.replace(/^<\?xml[^>]*>\s*/i, '')

  let parsedDoc: Document
  try {
    const parser = new DOMParser()
    parsedDoc = parser.parseFromString(noXml, 'image/svg+xml')
  } catch {
    return raw
  }

  const parsedSvg = parsedDoc.querySelector('svg') as unknown as SVGSVGElement | null
  if (!parsedSvg) return raw

  const svg = (() => {
    try {
      return document.importNode(parsedSvg, true) as unknown as SVGSVGElement
    } catch {
      return parsedSvg.cloneNode(true) as SVGSVGElement
    }
  })()

  const doc = svg.ownerDocument
  if (!doc) return raw

  ensureSvgNamespaces(svg)

  const scopeEl = (() => {
    try {
      const root = document.getElementById('kg-root')
      if (root) return root
    } catch {
      void 0
    }
    try {
      return document.body
    } catch {
      return null
    }
  })()

  const blocks = scopeEl ? scopeEl.querySelectorAll(MARKDOWN_DESIGN_BLOCK_SELECTOR) : null
  if (!blocks || blocks.length === 0) return raw

  const zoomRoot = (svg.querySelector('g') as unknown as SVGGElement | null) || null
  if (!zoomRoot) return raw

  let mdLayer = zoomRoot.querySelector('g[data-kg-layer="markdown-design-blocks"]') as SVGGElement | null
  if (!mdLayer) {
    mdLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g') as unknown as SVGGElement
    mdLayer.setAttribute('data-kg-layer', 'markdown-design-blocks')
    zoomRoot.appendChild(mdLayer)
  }
  while (mdLayer.firstChild) mdLayer.removeChild(mdLayer.firstChild)

  const anchorMap = args.anchorNodeIdByBlockId || null
  const nodePosById = args.nodePosById || null

  for (let i = 0; i < blocks.length; i += 1) {
    try {
      const block = blocks[i] as HTMLElement
      const blockId = readMarkdownDesignBlockId(block)
      const ww = Number(block.getAttribute('data-kg-world-w'))
      const wh = Number(block.getAttribute('data-kg-world-h'))
      if (!Number.isFinite(ww) || !Number.isFinite(wh) || ww <= 0 || wh <= 0) continue

      const wx0 = Number(block.getAttribute('data-kg-world-x'))
      const wy0 = Number(block.getAttribute('data-kg-world-y'))
      const baseX = Number.isFinite(wx0) ? wx0 : 0
      const baseY = Number.isFinite(wy0) ? wy0 : 0

      const anchorId = blockId && anchorMap && anchorMap[blockId] ? String(anchorMap[blockId] || '').trim() : blockId
      const nodePos = anchorId && nodePosById ? nodePosById[anchorId] : null
      const cx = nodePos && Number.isFinite(nodePos.x) ? nodePos.x : baseX + ww / 2
      const cy = nodePos && Number.isFinite(nodePos.y) ? nodePos.y : baseY + wh / 2
      const x = cx - ww / 2
      const y = cy - wh / 2

      const fo = doc.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') as unknown as SVGForeignObjectElement
      fo.setAttribute('x', String(x))
      fo.setAttribute('y', String(y))
      fo.setAttribute('width', String(ww))
      fo.setAttribute('height', String(wh))
      if (anchorId) fo.setAttribute('data-kg-anchor-node-id', anchorId)
      if (blockId) fo.setAttribute('data-kg-markdown-block-id', blockId)
      try {
        ;(fo.style as any).overflow = 'visible'
      } catch {
        void 0
      }

      const content = block.cloneNode(true) as HTMLElement
      try {
        content.removeAttribute('style')
      } catch {
        void 0
      }
      content.style.margin = '0'
      content.style.padding = '0'
      content.style.width = '100%'
      content.style.height = '100%'
      content.style.overflow = 'hidden'
      content.style.pointerEvents = 'none'

      try {
        inlineComputedStylesIntoClone(block, content, HTML_STYLE_PROPS)
      } catch {
        void 0
      }

      content.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
      fo.appendChild(content)
      mdLayer.appendChild(fo)
    } catch {
      void 0
    }
  }

  try {
    const out = new XMLSerializer().serializeToString(svg)
    const trimmed = String(out || '').trim()
    if (!trimmed) return raw
    return raw.startsWith('<?xml') ? `<?xml version="1.0" encoding="UTF-8"?>\n${trimmed}\n` : trimmed
  } catch {
    try {
      const alt = String((svg as unknown as { outerHTML?: unknown }).outerHTML || '').trim()
      if (alt) return alt
    } catch {
      void 0
    }
    return raw
  }
}

const blobToDataUrl = async (blob: Blob): Promise<string | null> => {
  try {
    const res = await new Promise<string | null>(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
    return res
  } catch {
    return null
  }
}

export const readImageSizeFromBlob = async (blob: Blob): Promise<{ w: number; h: number } | null> => {
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob)
        const w = bitmap && Number.isFinite(bitmap.width) ? bitmap.width : NaN
        const h = bitmap && Number.isFinite(bitmap.height) ? bitmap.height : NaN
        try {
          bitmap.close()
        } catch {
          void 0
        }
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w: Math.floor(w), h: Math.floor(h) }
      } catch {
        void 0
      }
    }

    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image load failed'))
        img.src = url
      })
      const w = Number.isFinite(img.naturalWidth) ? img.naturalWidth : NaN
      const h = Number.isFinite(img.naturalHeight) ? img.naturalHeight : NaN
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w: Math.floor(w), h: Math.floor(h) }
      return null
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    return null
  }
}

export const wrapPngBlobAsSvgMarkup = async (
  pngBlob: Blob,
  options?: { includeXmlDeclaration?: boolean; width?: number; height?: number },
): Promise<string | null> => {
  try {
    const dataUrl = await blobToDataUrl(pngBlob)
    if (!dataUrl) return null

    const size = await readImageSizeFromBlob(pngBlob)
    const w = Math.max(1, Math.floor(options?.width && options.width > 0 ? options.width : size?.w || 0))
    const h = Math.max(1, Math.floor(options?.height && options.height > 0 ? options.height : size?.h || 0))
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null

    const includeXmlDeclaration = options?.includeXmlDeclaration !== false
    const svg =
      `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<image href="${dataUrl}" xlink:href="${dataUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>` +
      `</svg>`
    return includeXmlDeclaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n` : svg
  } catch {
    return null
  }
}

export const readCanvasViewportSizeFromDom = (): { w: number; h: number } => {
  const pickRect = (): DOMRect | null => {
    const candidate =
      (document.querySelector('section[aria-label="Canvas viewport"]') as HTMLElement | null) ||
      (document.querySelector('section[aria-label="Canvas Preview Only"]') as HTMLElement | null) ||
      (document.querySelector('main[aria-label="Graph Canvas"]') as HTMLElement | null) ||
      (document.querySelector('section[aria-label="Design Canvas"]') as HTMLElement | null) ||
      (document.querySelector('section[aria-label="Flow Canvas"]') as HTMLElement | null) ||
      (document.querySelector('section[aria-label="Storyboard Widget"]') as HTMLElement | null)
    if (!candidate) return null
    try {
      return candidate.getBoundingClientRect()
    } catch {
      return null
    }
  }
  const rect = pickRect()
  const w = rect && rect.width ? Math.max(1, Math.floor(rect.width)) : 1280
  const h = rect && rect.height ? Math.max(1, Math.floor(rect.height)) : 720
  return { w, h }
}

export const captureVisibleCanvasPngBlobFromDom = async (): Promise<Blob | null> => {
  try {
    const root =
      (document.querySelector('section[aria-label="Canvas viewport"]') as HTMLElement | null) ||
      (document.querySelector('section[aria-label="Canvas Preview Only"]') as HTMLElement | null) ||
      document.body
    const candidates = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[]
    if (candidates.length === 0) return null

    const isVisible = (el: HTMLCanvasElement): { ok: boolean; area: number } => {
      if (!el.isConnected) return { ok: false, area: 0 }
      let rect: DOMRect | null = null
      try {
        rect = el.getBoundingClientRect()
      } catch {
        rect = null
      }
      const w = rect && Number.isFinite(rect.width) ? rect.width : 0
      const h = rect && Number.isFinite(rect.height) ? rect.height : 0
      if (!(w > 2 && h > 2)) return { ok: false, area: 0 }
      try {
        const cs = getComputedStyle(el)
        if (cs.display === 'none') return { ok: false, area: 0 }
        if (cs.visibility === 'hidden') return { ok: false, area: 0 }
        const op = Number(cs.opacity)
        if (Number.isFinite(op) && op <= 0.01) return { ok: false, area: 0 }
      } catch {
        void 0
      }
      return { ok: true, area: w * h }
    }

    const prefer = (el: HTMLCanvasElement): number => {
      const cls = String(el.className || '')
      if (cls.includes('maplibregl-canvas') || cls.includes('mapboxgl-canvas')) return 10_000_000
      return 0
    }

    let best: HTMLCanvasElement | null = null
    let bestScore = -1
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i]!
      const vis = isVisible(c)
      if (!vis.ok) continue
      const score = vis.area + prefer(c)
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    if (!best) return null

    const blob = await new Promise<Blob | null>(resolve => best!.toBlob(b => resolve(b), 'image/png'))
    return blob || null
  } catch {
    return null
  }
}
