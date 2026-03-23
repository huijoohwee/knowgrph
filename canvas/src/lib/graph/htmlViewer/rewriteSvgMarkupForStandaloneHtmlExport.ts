import {
  inlineRepoFileUrlToDataUrl,
  unwrapStandaloneProxyUrl,
} from '@/lib/graph/htmlViewer/standaloneAssetRewrite'

const isUrlAttr = (name: string): boolean => {
  const n = String(name || '').toLowerCase()
  return n === 'href' || n === 'xlink:href' || n === 'src'
}

const readUrlAttr = (el: Element): { name: string; value: string } | null => {
  const attrs = el.attributes
  for (let i = 0; i < attrs.length; i += 1) {
    const a = attrs.item(i)
    if (!a) continue
    if (!isUrlAttr(a.name)) continue
    const v = String(a.value || '').trim()
    if (!v) continue
    return { name: a.name, value: v }
  }
  return null
}

export async function rewriteSvgMarkupForStandaloneHtmlExport(args: {
  svgMarkup: string
  maxInlineRepoBytes?: number
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

  for (let i = 0; i < all.length; i += 1) {
    const el = all[i]
    const urlAttr = readUrlAttr(el)
    if (!urlAttr) continue

    const raw = urlAttr.value
    const unwrapped = unwrapStandaloneProxyUrl(raw)

    const inlined = await inlineRepoFileUrlToDataUrl(unwrapped, { maxBytes: maxInlineRepoBytes })
    const next = inlined || unwrapped
    if (!next || next === raw) continue
    try {
      el.setAttribute(urlAttr.name, next)
    } catch {
      void 0
    }
  }

  try {
    const out = new XMLSerializer().serializeToString(svg)
    return out || src
  } catch {
    return src
  }
}

