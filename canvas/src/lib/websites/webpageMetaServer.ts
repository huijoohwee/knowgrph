import type { Connect } from 'vite'

type WebpageMetaResponse = {
  ok: true
  url: string
  title: string
  siteName: string
  imageUrl: string
}

type CacheEntry = { value: WebpageMetaResponse | null; expiresAtMs: number; inflight?: Promise<WebpageMetaResponse | null> }

const CACHE = new Map<string, CacheEntry>()

const normalizeUrl = (raw: string): string => {
  const s = String(raw || '').trim().replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&#x26;/gi, '&')
  if (!s) return ''
  if (s.startsWith('//')) return `https:${s}`
  return s
}

const parseMeta = (html: string) => {
  const src = String(html || '')
  const pick = (re: RegExp): string => {
    const m = src.match(re)
    return m && m[1] ? String(m[1]).trim() : ''
  }
  const title = pick(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i).replace(/\s+/g, ' ').trim()
  const ogTitle = pick(/<meta\b[^>]*property\s*=\s*(?:"|')og:title(?:"|')[^>]*content\s*=\s*(?:"|')([^"']+)(?:"|')[^>]*>/i)
  const siteName =
    pick(/<meta\b[^>]*property\s*=\s*(?:"|')og:site_name(?:"|')[^>]*content\s*=\s*(?:"|')([^"']+)(?:"|')[^>]*>/i) ||
    pick(/<meta\b[^>]*name\s*=\s*(?:"|')application-name(?:"|')[^>]*content\s*=\s*(?:"|')([^"']+)(?:"|')[^>]*>/i)
  const ogImage = pick(/<meta\b[^>]*property\s*=\s*(?:"|')og:image(?:"|')[^>]*content\s*=\s*(?:"|')([^"']+)(?:"|')[^>]*>/i)
  const twitterImage = pick(/<meta\b[^>]*name\s*=\s*(?:"|')twitter:image(?:"|')[^>]*content\s*=\s*(?:"|')([^"']+)(?:"|')[^>]*>/i)
  const bestTitle = (ogTitle || title).replace(/\s+/g, ' ').trim()
  const bestImage = normalizeUrl(ogImage || twitterImage)
  return { title: bestTitle, siteName: String(siteName || '').trim(), imageUrl: bestImage }
}

const tryFetchRedditOembed = async (url: string): Promise<{ title: string; siteName: string; imageUrl: string } | null> => {
  try {
    const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`
    const res = await fetch(oembedUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json,text/plain,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.reddit.com/',
      },
    })
    if (!res.ok) return null
    const json = (await res.json()) as unknown
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null
    const obj = json as { title?: unknown; provider_name?: unknown; thumbnail_url?: unknown }
    const title = String(obj.title || '').replace(/\s+/g, ' ').trim()
    const siteName = String(obj.provider_name || 'Reddit').trim()
    const thumb = normalizeUrl(String(obj.thumbnail_url || ''))
    return { title, siteName, imageUrl: thumb }
  } catch {
    return null
  }
}

const toProxyImage = (abs: string): string => {
  const u = String(abs || '').trim()
  if (!/^https?:\/\//i.test(u)) return ''
  return `/__fetch_remote?url=${encodeURIComponent(u)}`
}

export function createWebpageMetaHandler(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', '*')
      res.setHeader('Access-Control-Max-Age', '86400')
      res.end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    const parsed = (() => {
      try {
        return new URL(req.url || '', `http://${req.headers.host}`)
      } catch {
        return null
      }
    })()
    const urlParam = parsed ? parsed.searchParams.get('url') : null
    const url = normalizeUrl(String(urlParam || ''))
    if (!url || !/^https?:\/\//i.test(url)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Missing or invalid url' }))
      return
    }

    const now = Date.now()
    const ttlMs = 10 * 60_000
    const cached = CACHE.get(url)
    if (cached && cached.expiresAtMs > now && cached.value) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=120')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(JSON.stringify(cached.value))
      return
    }
    if (cached && cached.inflight) {
      const v = await cached.inflight
      res.statusCode = v ? 200 : 204
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=60')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(v ? JSON.stringify(v) : JSON.stringify({ ok: false }))
      return
    }

    const inflight = (async (): Promise<WebpageMetaResponse | null> => {
      try {
        const host = (() => {
          try {
            return new URL(url).hostname.toLowerCase()
          } catch {
            return ''
          }
        })()
        const isReddit = host === 'www.reddit.com' || host.endsWith('.reddit.com')
        const referer = host.endsWith('.licdn.com') || host === 'media.licdn.com' ? 'https://www.linkedin.com/' : `${new URL(url).origin}/`
        const upstream = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,*/*;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: referer,
          },
        })
        if (!upstream.ok) {
          if (isReddit) {
            const o = await tryFetchRedditOembed(url)
            if (o && (o.title || o.imageUrl || o.siteName)) {
              return {
                ok: true,
                url,
                title: o.title,
                siteName: o.siteName,
                imageUrl: o.imageUrl ? toProxyImage(o.imageUrl) : '',
              }
            }
          }
          return null
        }
        const ct = String(upstream.headers.get('content-type') || '').toLowerCase()
        if (!ct.includes('text/html') && !ct.includes('application/xhtml') && !ct.includes('application/xml')) return null
        const html = await upstream.text()
        let meta = parseMeta(html)
        if (isReddit && !meta.imageUrl) {
          const o = await tryFetchRedditOembed(url)
          if (o) {
            meta = {
              title: meta.title || o.title,
              siteName: meta.siteName || o.siteName,
              imageUrl: meta.imageUrl || o.imageUrl,
            }
          }
        }
        if (!meta.title && !meta.imageUrl && !meta.siteName) return null
        const out: WebpageMetaResponse = {
          ok: true,
          url,
          title: meta.title,
          siteName: meta.siteName,
          imageUrl: meta.imageUrl ? toProxyImage(meta.imageUrl) : '',
        }
        return out
      } catch {
        return null
      }
    })()

    CACHE.set(url, { value: null, expiresAtMs: now + ttlMs, inflight })
    const value = await inflight
    CACHE.set(url, { value, expiresAtMs: now + ttlMs })

    res.statusCode = value ? 200 : 204
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=120')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(value ? JSON.stringify(value) : JSON.stringify({ ok: false }))
  }
}
