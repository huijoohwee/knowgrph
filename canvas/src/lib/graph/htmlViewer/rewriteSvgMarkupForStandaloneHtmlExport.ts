import {
  inlineStandaloneAssetUrlToDataUrl,
  inlineRepoFileUrlToDataUrl,
  unwrapStandaloneProxyUrl,
} from '@/lib/graph/htmlViewer/standaloneAssetRewrite'

const isUrlAttr = (name: string): boolean => {
  const n = String(name || '').toLowerCase()
  return n === 'href' || n === 'xlink:href' || n === 'src' || n === 'poster'
}

const isUrlSetAttr = (name: string): boolean => {
  const n = String(name || '').toLowerCase()
  return n === 'srcset'
}

const readUrlAttrs = (el: Element): Array<{ name: string; value: string }> => {
  const out: Array<{ name: string; value: string }> = []
  const attrs = el.attributes
  for (let i = 0; i < attrs.length; i += 1) {
    const a = attrs.item(i)
    if (!a) continue
    if (!isUrlAttr(a.name) && !isUrlSetAttr(a.name) && String(a.name || '').toLowerCase() !== 'style') continue
    const v = String(a.value || '').trim()
    if (!v) continue
    out.push({ name: a.name, value: v })
  }
  return out
}

const parseAndRewriteSrcset = async (
  srcset: string,
  rewriteUrl: (u: string) => Promise<string>,
): Promise<string> => {
  const raw = String(srcset || '').trim()
  if (!raw) return ''
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return raw
  const out: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i]!
    const tokens = p.split(/\s+/g).filter(Boolean)
    if (tokens.length === 0) continue
    const url0 = tokens[0]!
    const url1 = await rewriteUrl(url0)
    const rest = tokens.slice(1).join(' ')
    out.push(rest ? `${url1} ${rest}` : url1)
  }
  return out.join(', ')
}

const rewriteCssUrls = async (cssText: string, rewriteUrl: (u: string) => Promise<string>): Promise<string> => {
  const src = String(cssText || '')
  if (!src.trim()) return src
  const re = /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g
  let out = ''
  let last = 0
  for (;;) {
    const m = re.exec(src)
    if (!m) break
    const full = m[0]
    const urlRaw = String(m[2] || '').trim()
    out += src.slice(last, m.index)
    last = m.index + full.length
    const nextUrl = urlRaw ? await rewriteUrl(urlRaw) : urlRaw
    const quote = m[1] || ''
    out += `url(${quote}${nextUrl}${quote})`
  }
  out += src.slice(last)
  return out
}

export async function rewriteSvgMarkupForStandaloneHtmlExport(args: {
  svgMarkup: string
  maxInlineRepoBytes?: number
  inlineRemoteAssets?: boolean
}): Promise<string> {
  const src = String(args.svgMarkup || '')
  if (!src.trim()) return ''
  if (typeof DOMParser !== 'function' || typeof XMLSerializer !== 'function') return src

  let doc: Document | null = null
  try {
    doc = new DOMParser().parseFromString(src, 'image/svg+xml')
  } catch {
    doc = null
  }
  if (!doc) return src

  const svg = doc.documentElement
  if (!svg || String(svg.tagName || '').toLowerCase() !== 'svg') return src

  const all = Array.from(svg.querySelectorAll('*'))
  if (all.length === 0) return src

  const maxInlineRepoBytes =
    typeof args.maxInlineRepoBytes === 'number' && Number.isFinite(args.maxInlineRepoBytes) ? Math.max(0, Math.floor(args.maxInlineRepoBytes)) : 2_400_000

  const rewriteUrl = async (raw: string, opts?: { allowRemote?: boolean }): Promise<string> => {
    const raw0 = String(raw || '').trim()
    if (!raw0) return ''
    const unwrapped = unwrapStandaloneProxyUrl(raw0)
    const inlined = args.inlineRemoteAssets === true && opts?.allowRemote === true
      ? await inlineStandaloneAssetUrlToDataUrl(raw0, { maxBytes: maxInlineRepoBytes, allowRemote: true })
      : await inlineRepoFileUrlToDataUrl(unwrapped, { maxBytes: maxInlineRepoBytes })
    return inlined || unwrapped
  }

  for (let i = 0; i < all.length; i += 1) {
    const el = all[i]
    const urlAttrs = readUrlAttrs(el)
    if (urlAttrs.length === 0) continue

    for (let j = 0; j < urlAttrs.length; j += 1) {
      const urlAttr = urlAttrs[j]!
      const raw = urlAttr.value
      const nameLower = String(urlAttr.name || '').toLowerCase()

      if (nameLower === 'srcset') {
        const next = await parseAndRewriteSrcset(raw, u => rewriteUrl(u, { allowRemote: true }))
        if (!next || next === raw) continue
        try {
          el.setAttribute(urlAttr.name, next)
        } catch {
          void 0
        }
        continue
      }

      if (nameLower === 'style') {
        const next = await rewriteCssUrls(raw, u => rewriteUrl(u, { allowRemote: true }))
        if (!next || next === raw) continue
        try {
          el.setAttribute(urlAttr.name, next)
        } catch {
          void 0
        }
        continue
      }

      const tagLower = String(el.tagName || '').toLowerCase()
      const allowRemote =
        nameLower === 'src' ||
        nameLower === 'poster' ||
        ((nameLower === 'href' || nameLower === 'xlink:href') && tagLower === 'image')
      const next = await rewriteUrl(raw, { allowRemote })
      if (!next || next === raw) continue
      try {
        el.setAttribute(urlAttr.name, next)
      } catch {
        void 0
      }
    }
  }

  try {
    const out = new XMLSerializer().serializeToString(svg)
    return out || src
  } catch {
    return src
  }
}
