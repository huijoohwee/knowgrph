import React from 'react'
import { parseAsciiBoxTable } from '@/features/markdown/ui/codeblock/asciiBoxTable'

type RenderOpts = {
  activeDocumentPath: string
  uiPanelTextFontClass: string
  uiPanelMonospaceTextClass: string
  markdownPresentationMode: boolean
  renderNodeText: (text: string, key: React.Key) => React.ReactNode
  fragmentOptions?: {
    enabled: boolean
    currentStep: number
    classNames: string[]
    tags: string[]
  } | null
}

type RenderDeps = {
  isSafeHref: (href: string) => boolean
  isSafeMediaSrc: (href: string) => boolean
  resolveHref: (href: string, activeDocumentPath: string) => string
  applyMediaProxySrc: (src: string) => string
  buildAnchorAttrs: (href: string) => { target?: string; rel?: string; className: string }
  sanitizeHtmlId: (raw: string) => string
  filterHtmlPreviewClassName: (raw: string) => string
  mergeSafeStyles: (base: React.CSSProperties | undefined, override: React.CSSProperties | undefined) => React.CSSProperties | undefined
  deriveSafeLayoutStyleFromClassAttr: (rawClass: string) => React.CSSProperties | undefined
  parseSafeInlineStyle: (raw: string) => React.CSSProperties | undefined
  parseHtmlNumberAttr: (raw: string) => number | null
  pickFirstSrcsetUrl: (raw: string) => string
  sanitizeSrcDocCached: (srcDoc: string) => string
}

const svgAllowedAttrs = new Set([
  'xmlns', 'xmlns:xlink', 'viewbox', 'width', 'height', 'preserveaspectratio',
  'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'd', 'points',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'transform',
  'role', 'aria-hidden', 'focusable', 'href', 'xlink:href', 'id', 'class',
])

const svgTagNames = new Set([
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient',
  'radialgradient', 'stop', 'clippath', 'mask', 'symbol', 'use', 'title', 'desc', 'text',
])

const toSvgPropName = (name: string): string => {
  const n = name.toLowerCase()
  if (n === 'viewbox') return 'viewBox'
  if (n === 'preserveaspectratio') return 'preserveAspectRatio'
  if (n === 'aria-hidden') return 'aria-hidden'
  if (n === 'xmlns:xlink') return 'xmlnsXlink'
  if (n === 'xlink:href') return 'xlinkHref'
  return n.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
}

const styleFromElement = (el: Element, deps: RenderDeps): React.CSSProperties | undefined =>
  deps.mergeSafeStyles(
    deps.deriveSafeLayoutStyleFromClassAttr(el.getAttribute('class') || ''),
    deps.parseSafeInlineStyle(el.getAttribute('style') || ''),
  )

const classFromElement = (el: Element, deps: RenderDeps): string => deps.filterHtmlPreviewClassName(el.getAttribute('class') || '')

const mediaSourceCandidate = (el: Element, deps: RenderDeps): string => {
  const srcRaw = el.getAttribute('src') || el.getAttribute('data-src') || ''
  const srcsetRaw = el.getAttribute('srcset') || el.getAttribute('data-srcset') || ''
  return srcRaw || deps.pickFirstSrcsetUrl(srcsetRaw)
}

export const renderSafeHtmlBlockImpl = (
  html: string,
  opts: RenderOpts,
  deps: RenderDeps,
): React.ReactNode | null => {
  const win = (globalThis as unknown as { window?: Window }).window
  if (!win) return null
  const DomParserCtor = (globalThis as unknown as { DOMParser?: typeof DOMParser }).DOMParser
  if (!DomParserCtor) return null
  const raw = String(html || '').trim()
  if (!raw || !raw.includes('<')) return null
  try {
    const NodeRef = (globalThis as unknown as { Node?: typeof Node }).Node || (win as unknown as { Node?: typeof Node }).Node
    const parser = new DomParserCtor()
    const doc = parser.parseFromString(`<body>${raw}</body>`, 'text/html')
    const root = doc.body
    const fragmentOpts = opts.fragmentOptions
    const fragmentEnabled = !!fragmentOpts?.enabled
    const fragmentClassNames = fragmentOpts?.classNames || []
    const fragmentTags = fragmentOpts?.tags || []
    let fragmentIndex = 0

    const renderNode = (node: ChildNode, key: React.Key): React.ReactNode => {
      if (node.nodeType === NodeRef.TEXT_NODE) {
        const text = node.textContent || ''
        if (!text || (text.trim() === '' && /[\r\n]/.test(text))) return <React.Fragment key={key}>{''}</React.Fragment>
        return opts.renderNodeText(text, key)
      }
      if (node.nodeType !== NodeRef.ELEMENT_NODE) return <React.Fragment key={key}>{''}</React.Fragment>
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return <React.Fragment key={key}>{''}</React.Fragment>
      const children = Array.from(el.childNodes).map((n, i) => renderNode(n, `${key}-${i}`))
      const safeClass = classFromElement(el, deps)
      const safeStyle = styleFromElement(el, deps)

      let shouldUnwrapAfterFragmentGate = false
      if (fragmentEnabled) {
        const tagMatch = tag !== 'v-clicks' && fragmentTags.some(name => name.toLowerCase() === tag)
        const classMatch = fragmentClassNames.length > 0 && (el.classList?.length || 0) > 0
          ? fragmentClassNames.some(name => el.classList.contains(name))
          : false
        if (tagMatch || classMatch) {
          const explicitIndexAttr = el.getAttribute('data-fragment-index') || (tag === 'v-click' ? el.getAttribute('at') : null)
          let idx: number
          if (explicitIndexAttr?.trim()) {
            const parsed = Number.parseInt(explicitIndexAttr.trim(), 10)
            idx = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
          } else {
            fragmentIndex += 1
            idx = fragmentIndex
          }
          const current = Number.isFinite(fragmentOpts?.currentStep) ? Math.max(0, fragmentOpts?.currentStep || 0) : 0
          if (idx <= 0 || current < idx) return <React.Fragment key={key}>{''}</React.Fragment>
          if (tagMatch) shouldUnwrapAfterFragmentGate = true
        }
      }

      if (tag === 'v-click') return <React.Fragment key={key}>{children}</React.Fragment>
      if (tag === 'v-mark') {
        const type = String(el.getAttribute('type') || '').trim().toLowerCase()
        const color = String(el.getAttribute('color') || '').trim().toLowerCase()
        const cls: string[] = []
        if (type === 'circle') cls.push('inline-block border border-current rounded-full px-1')
        if (type === 'underline') cls.push('underline decoration-2 underline-offset-2')
        if (type === 'strike-through') cls.push('line-through')
        if (color === 'red') cls.push('bg-red-200 text-red-900 px-1 rounded-sm')
        if (color === 'yellow') cls.push('bg-yellow-200 text-yellow-900 px-1 rounded-sm')
        return <span key={key} className={cls.join(' ') || undefined}>{children}</span>
      }

      if (tag === 'v-clicks') {
        const lines = String(el.textContent || '').split(/\r?\n/)
        const items: string[] = []
        let ordered = false
        for (const line of lines) {
          const mUn = line.match(/^\s*[-*+]\s+(.*)$/)
          if (mUn) { items.push(mUn[1] || ''); continue }
          const mOrd = line.match(/^\s*(\d+)\.\s+(.*)$/)
          if (mOrd) { ordered = true; items.push(mOrd[2] || '') }
        }
        if (!items.length) return <React.Fragment key={key}>{children}</React.Fragment>
        const current = Number.isFinite(fragmentOpts?.currentStep) ? Math.max(0, fragmentOpts?.currentStep || 0) : 0
        const explicitAt = el.getAttribute('at')
        const explicitStart = explicitAt?.trim() ? Number.parseInt(explicitAt.trim(), 10) : NaN
        const startIndex = fragmentEnabled && Number.isFinite(explicitStart) && explicitStart > 0 ? explicitStart : fragmentEnabled ? fragmentIndex + 1 : 1
        if (fragmentEnabled) fragmentIndex = Math.max(fragmentIndex, startIndex + items.length - 1)
        const visibleCount = fragmentEnabled ? Math.max(0, Math.min(items.length, current - startIndex + 1)) : items.length
        const ListTag = (ordered ? 'ol' : 'ul') as 'ol' | 'ul'
        return (
          <section key={key} className={['mt-2 mb-2', opts.uiPanelTextFontClass].filter(Boolean).join(' ')}>
            <ListTag className={[ordered ? 'list-decimal' : 'list-disc', 'pl-5'].join(' ')}>
              {items.slice(0, visibleCount).map((text, idx) => <li key={idx}>{text}</li>)}
            </ListTag>
          </section>
        )
      }

      if (tag === 'a') {
        const hrefRaw = el.getAttribute('href') || ''
        if (hrefRaw && deps.isSafeHref(hrefRaw)) {
          const href = deps.resolveHref(hrefRaw, opts.activeDocumentPath)
          const anchor = deps.buildAnchorAttrs(href)
          return <a key={key} href={href || undefined} target={anchor.target} rel={anchor.rel} className={anchor.className}>{children}</a>
        }
        const id = deps.sanitizeHtmlId(el.getAttribute('id') || '')
        if (!id) return <React.Fragment key={key}>{children}</React.Fragment>
        return <a key={key} id={id} className="block h-0 scroll-mt-16" aria-hidden={children.length ? undefined : true}>{children}</a>
      }

      if (tag === 'img') {
        const srcCandidate = mediaSourceCandidate(el, deps)
        if (!srcCandidate || !deps.isSafeHref(srcCandidate) || !deps.isSafeMediaSrc(srcCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const src = deps.applyMediaProxySrc(deps.resolveHref(srcCandidate, opts.activeDocumentPath))
        const width = deps.parseHtmlNumberAttr(el.getAttribute('width') || '')
        const height = deps.parseHtmlNumberAttr(el.getAttribute('height') || '')
        const style: React.CSSProperties = {}
        if (width) { style.width = `${Math.round(width)}px`; style.maxWidth = '100%' }
        if (height) style.height = `${Math.round(height)}px`
        return <img key={key} src={src || undefined} alt={el.getAttribute('alt') || ''} loading="lazy" decoding="async" style={Object.keys(style).length ? style : undefined} className="inline-block max-w-full h-auto rounded border border-gray-200" />
      }

      if (tag === 'picture') {
        const sources = Array.from(el.querySelectorAll('source')).map((s, i) => {
          const picked = deps.pickFirstSrcsetUrl(s.getAttribute('srcset') || s.getAttribute('data-srcset') || '')
          if (!picked || !deps.isSafeHref(picked) || !deps.isSafeMediaSrc(picked)) return null
          const resolved = deps.applyMediaProxySrc(deps.resolveHref(picked, opts.activeDocumentPath))
          const typeRaw = String(s.getAttribute('type') || '').trim()
          return <source key={`${key}-src-${i}`} srcSet={resolved} type={typeRaw && typeRaw.length <= 80 ? typeRaw : undefined} />
        }).filter(Boolean)
        const img = el.querySelector('img')
        const imgCandidate = img ? mediaSourceCandidate(img, deps) : ''
        if (!imgCandidate || !deps.isSafeHref(imgCandidate) || !deps.isSafeMediaSrc(imgCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const imgResolved = deps.applyMediaProxySrc(deps.resolveHref(imgCandidate, opts.activeDocumentPath))
        return <picture key={key} className={safeClass || undefined} style={safeStyle}>{sources as unknown as React.ReactNode}<img src={imgResolved || undefined} alt={img?.getAttribute('alt') || ''} loading="lazy" decoding="async" className="inline-block max-w-full h-auto rounded border border-gray-200" /></picture>
      }

      if (tag === 'video' || tag === 'audio') {
        const sources = Array.from(el.querySelectorAll('source'))
        const directSrc = el.getAttribute('src') || el.getAttribute('data-src') || ''
        const sourceCandidate = directSrc.trim() || (sources.map(s => (s.getAttribute('src') || s.getAttribute('data-src') || '').trim()).find(Boolean) || '')
        if (!sourceCandidate || !deps.isSafeHref(sourceCandidate) || !deps.isSafeMediaSrc(sourceCandidate)) return <React.Fragment key={key}>{''}</React.Fragment>
        const src = deps.applyMediaProxySrc(deps.resolveHref(sourceCandidate, opts.activeDocumentPath))
        const renderedSources = sources.map((s, i) => {
          const rawSrc = s.getAttribute('src') || s.getAttribute('data-src') || ''
          if (!rawSrc || !deps.isSafeHref(rawSrc) || !deps.isSafeMediaSrc(rawSrc)) return null
          const typeRaw = String(s.getAttribute('type') || '').trim()
          return <source key={`${key}-src-${i}`} src={deps.applyMediaProxySrc(deps.resolveHref(rawSrc, opts.activeDocumentPath))} type={typeRaw && typeRaw.length <= 80 ? typeRaw : undefined} />
        }).filter(Boolean)
        if (tag === 'audio') {
          return <audio key={key} controls src={src} className={['w-full max-w-2xl', safeClass].filter(Boolean).join(' ') || undefined} style={safeStyle}>{renderedSources as unknown as React.ReactNode}</audio>
        }
        const posterRaw = el.getAttribute('poster') || el.getAttribute('data-poster') || ''
        const poster = posterRaw && deps.isSafeHref(posterRaw) && deps.isSafeMediaSrc(posterRaw) ? deps.applyMediaProxySrc(deps.resolveHref(posterRaw, opts.activeDocumentPath)) : undefined
        const controls = el.hasAttribute('controls') ? true : el.hasAttribute('autoplay') || el.hasAttribute('loop') ? false : true
        return (
          <video key={key} src={src} poster={poster} controls={controls} autoPlay={el.hasAttribute('autoplay') || undefined} muted={el.hasAttribute('muted') || undefined} loop={el.hasAttribute('loop') || undefined} playsInline={el.hasAttribute('playsinline') || undefined} className={['max-w-full rounded border border-gray-200', safeClass].filter(Boolean).join(' ') || undefined} style={safeStyle}>
            {renderedSources as unknown as React.ReactNode}
          </video>
        )
      }

      if (tag === 'iframe') {
        const srcRaw = el.getAttribute('src') || el.getAttribute('data-src') || ''
        if (srcRaw && deps.isSafeHref(srcRaw) && deps.isSafeMediaSrc(srcRaw)) {
          const src = deps.resolveHref(srcRaw, opts.activeDocumentPath)
          return (
            <section key={key} className={opts.markdownPresentationMode ? 'aspect-video w-full' : 'aspect-video w-full max-w-xl'}>
              <iframe src={src} title={el.getAttribute('title') || 'Embedded content'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" loading="lazy" className={['w-full h-full rounded border border-gray-200', safeClass].filter(Boolean).join(' ') || undefined} style={safeStyle} />
            </section>
          )
        }
        const srcDoc = String(el.getAttribute('srcdoc') || '').trim()
        if (!srcDoc) return <React.Fragment key={key}>{''}</React.Fragment>
        const heightClass = opts.markdownPresentationMode ? 'h-[220px]' : 'h-[140px]'
        return <section key={key} className={`w-full ${heightClass}`}><iframe title={el.getAttribute('title') || 'Embedded content'} sandbox="" referrerPolicy="no-referrer" srcDoc={deps.sanitizeSrcDocCached(srcDoc)} className="w-full h-full rounded border border-gray-200" /></section>
      }

      if (svgTagNames.has(tag)) {
        const props: Record<string, unknown> = { key }
        for (const name of el.getAttributeNames()) {
          const low = String(name || '').toLowerCase()
          if (!svgAllowedAttrs.has(low) || low.startsWith('on') || low === 'style') continue
          if (low === 'id') {
            const v = deps.sanitizeHtmlId(el.getAttribute(name) || '')
            if (v) props.id = v
            continue
          }
          if (low === 'class') {
            if (safeClass) props.className = safeClass
            continue
          }
          if (low === 'href' || low === 'xlink:href') {
            const v = String(el.getAttribute(name) || '').trim()
            if (v.startsWith('#')) props[toSvgPropName(name)] = v
            continue
          }
          const v = el.getAttribute(name)
          if (v != null) props[toSvgPropName(name)] = v
        }
        const SvgTag = tag as keyof JSX.IntrinsicElements
        return React.createElement(SvgTag, props, children)
      }

      if (tag === 'details') return <details key={key} open={el.hasAttribute('open') || undefined} className={safeClass || undefined}>{children}</details>
      if (tag === 'summary') return <summary key={key} className={safeClass || undefined}>{children}</summary>
      if (tag === 'figure') return <figure key={key} className={['mx-0', safeClass].filter(Boolean).join(' ') || undefined}>{children}</figure>
      if (tag === 'figcaption') return <figcaption key={key} className={safeClass || undefined}>{children}</figcaption>
      if (tag === 'center') return <section key={key} className="text-center">{children}</section>
      if (tag === 'button') return <button key={key} type="button" className={safeClass || undefined}>{children}</button>
      if (tag === 'br') return <br key={key} />
      if (tag === 'caption') return <caption key={key} className="text-sm text-gray-600 p-2">{children}</caption>
      if (tag === 'abbr') return <abbr key={key} title={(el.getAttribute('title') || '') || undefined} className="bg-yellow-100 border-b border-dotted border-yellow-400 cursor-help px-0.5 rounded-sm">{el.textContent || ''}</abbr>

      if (tag === 'pre') {
        const preText = el.textContent || ''
        const asciiTable = /[┌┐└┘┬┴┼├┤│─╔╗╚╝╦╩╬║═]/.test(preText) || /(^|\n)\s*\+[-+]{3,}\+\s*(\n|$)/.test(preText)
          ? parseAsciiBoxTable(preText)
          : null
        if (asciiTable) {
          return (
            <section key={key} className="mt-4 mb-4 overflow-auto max-h-[80vh] rounded-lg border border-gray-200 shadow-sm">
              <table className={['min-w-full border-collapse table-auto text-xs', safeClass].filter(Boolean).join(' ') || undefined}>
                {asciiTable.header ? <thead className="bg-gray-50 text-gray-900"><tr>{asciiTable.header.map((cell, j) => <th key={`${key}-h-${j}`} className="px-3 py-2 text-left font-semibold border-b border-gray-200 align-top sticky top-0 z-10 bg-gray-50">{cell}</th>)}</tr></thead> : null}
                <tbody className="text-gray-900">{asciiTable.rows.map((row, rIdx) => <tr key={`${key}-r-${rIdx}`} className="odd:bg-white even:bg-gray-50 hover:bg-amber-50 transition-colors">{row.map((cell, cIdx) => <td key={`${key}-c-${rIdx}-${cIdx}`} className="px-3 py-2 border-b border-gray-200 align-top">{cell}</td>)}</tr>)}</tbody>
              </table>
            </section>
          )
        }
        return <pre key={key} className={['mt-3 mb-3 overflow-x-auto p-3 rounded border border-gray-200', opts.uiPanelMonospaceTextClass, safeClass].filter(Boolean).join(' ')}>{preText}</pre>
      }

      if (tag === 'code') return <code key={key} className={[opts.uiPanelMonospaceTextClass, safeClass].filter(Boolean).join(' ') || undefined}>{children}</code>

      if (tag === 'th' || tag === 'td') {
        const colSpanN = Number(el.getAttribute('colspan') || '')
        const rowSpanN = Number(el.getAttribute('rowspan') || '')
        const colSpan = Number.isFinite(colSpanN) && colSpanN > 1 ? Math.floor(colSpanN) : undefined
        const rowSpan = Number.isFinite(rowSpanN) && rowSpanN > 1 ? Math.floor(rowSpanN) : undefined
        const base = tag === 'th' ? 'px-4 py-2 text-left font-semibold border-b border-gray-200 align-top' : 'px-4 py-2 border-b border-gray-200 align-top'
        const Cell = tag as 'th' | 'td'
        return <Cell key={key} colSpan={colSpan} rowSpan={rowSpan} className={[base, safeClass].filter(Boolean).join(' ')} style={safeStyle}>{children}</Cell>
      }
      if (tag === 'table') return <section key={key} className="mt-4 mb-4 overflow-auto max-h-[80vh] rounded-lg border border-gray-200 shadow-sm"><table className={['min-w-full text-sm', safeClass].filter(Boolean).join(' ') || undefined} style={safeStyle}>{children}</table></section>
      if (tag === 'thead') return <thead key={key} className={['bg-gray-50 text-gray-900', safeClass].filter(Boolean).join(' ')} style={safeStyle}>{children}</thead>
      if (tag === 'tbody') return <tbody key={key} className={['text-gray-900', safeClass].filter(Boolean).join(' ')} style={safeStyle}>{children}</tbody>
      if (tag === 'tfoot') return <tfoot key={key} className={['bg-gray-50 text-gray-900', safeClass].filter(Boolean).join(' ')} style={safeStyle}>{children}</tfoot>
      if (tag === 'tr') return <tr key={key} className={['odd:bg-white even:bg-gray-50 hover:bg-amber-50 transition-colors', safeClass].filter(Boolean).join(' ')} style={safeStyle}>{children}</tr>
      if (tag === 'colgroup') return <colgroup key={key} className={safeClass || undefined} style={safeStyle}>{children}</colgroup>
      if (tag === 'col') {
        const spanN = Number(el.getAttribute('span') || '')
        const span = Number.isFinite(spanN) && spanN >= 1 && spanN <= 24 ? Math.floor(spanN) : undefined
        return <col key={key} span={span} className={safeClass || undefined} style={safeStyle} />
      }

      if (tag === 'p') {
        const cls = ['mt-2 mb-2', opts.uiPanelTextFontClass, safeClass]
        if ((el.getAttribute('align') || '').toLowerCase() === 'center') cls.push('text-center')
        return <p key={key} className={cls.filter(Boolean).join(' ')} style={safeStyle}>{children}</p>
      }
      if (tag === 'div') {
        const cls = [opts.uiPanelTextFontClass, safeClass]
        if ((el.getAttribute('align') || '').toLowerCase() === 'center') cls.push('text-center')
        return <section key={key} className={cls.filter(Boolean).join(' ') || undefined} style={safeStyle}>{children}</section>
      }
      if (tag === 'main' || tag === 'section' || tag === 'article' || tag === 'aside' || tag === 'nav' || tag === 'header' || tag === 'footer') {
        const Tag = tag as 'main' | 'section' | 'article' | 'aside' | 'nav' | 'header' | 'footer'
        return <Tag key={key} className={safeClass || undefined} style={safeStyle}>{children}</Tag>
      }
      if (tag === 'ul' || tag === 'ol' || tag === 'li' || tag === 'dl' || tag === 'dt' || tag === 'dd' || tag === 'span') {
        const Tag = tag as 'ul' | 'ol' | 'li' | 'dl' | 'dt' | 'dd' | 'span'
        return <Tag key={key} className={safeClass || undefined} style={safeStyle}>{children}</Tag>
      }
      if (shouldUnwrapAfterFragmentGate) return <React.Fragment key={key}>{children}</React.Fragment>
      if (tag.includes('-')) return <section key={key} className={safeClass || undefined} style={safeStyle}>{children}</section>
      return <React.Fragment key={key}>{el.textContent || ''}</React.Fragment>
    }

    const renderedRootChildren = Array.from(root.childNodes).map((n, i) => renderNode(n, i))
    const shouldWrapRootAsImplicitGrid = (() => {
      const elementChildren = Array.from(root.childNodes).filter(n => n.nodeType === NodeRef.ELEMENT_NODE) as Element[]
      const meaningful = elementChildren.filter(el => {
        const tag = el.tagName.toLowerCase()
        if (tag === 'br') return false
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') return false
        return true
      })
      if (meaningful.length < 2) return false
      if (meaningful.some(el => {
        const tag = el.tagName.toLowerCase()
        if (tag === 'table') return true
        const cls = String(el.getAttribute('class') || '')
        const style = String(el.getAttribute('style') || '')
        return /\bgrid\b/.test(cls) || /\binline-grid\b/.test(cls) || /display\s*:\s*(grid|inline-grid)/i.test(style)
      })) return false
      const hinted = meaningful.filter(el => {
        const cls = String(el.getAttribute('class') || '')
        const style = String(el.getAttribute('style') || '')
        return /\b(col|row)-(span|start|end)-/.test(cls) || /grid-(column|row)\s*:/i.test(style) || /grid-column\s*:|grid-row\s*:/i.test(style)
      })
      return hinted.length >= 2 && hinted.length / meaningful.length >= 0.8
    })()

    if (shouldWrapRootAsImplicitGrid) {
      return <section className={opts.uiPanelTextFontClass} style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '0.75rem', alignItems: 'start' }}>{renderedRootChildren}</section>
    }
    return <section className="space-y-1">{renderedRootChildren}</section>
  } catch {
    return null
  }
}
