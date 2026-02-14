import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  clampInt,
  extractXmlLocs,
  fetchTextWithLimit,
  hashHex,
  isSameHost,
  looksLikeSitemapIndex,
  normalizeUrl,
  runWebpageConvert,
  safeJsonParse,
  urlToTreePath,
} from './websiteImportCore'

type WebsiteImportStatus = 'queued' | 'running' | 'done' | 'failed'

type WebsiteImportNode = {
  nodeId: string
  url: string
  path: string
  title?: string
  status: 'ok' | 'error'
  artifacts: {
    rawHtmlRelPath?: string
    markdownRelPath?: string
    conversionJsonRelPath?: string
  }
}

export type WebsiteImportManifestV1 = {
  version: 1
  importId: string
  rootUrl: string
  sitemapUrl?: string
  status: WebsiteImportStatus
  startedAtMs: number
  finishedAtMs?: number
  nodes: WebsiteImportNode[]
  errors: Array<{ url: string; error: string }>
}

type WebsiteImportOptions = {
  discoverSitemap?: boolean
  sitemapUrl?: string
  maxPages?: number
  concurrency?: number
  includeImages?: boolean
  outputDirRel?: string
}

const normalizeRel = (raw: string): string => String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+/, '')

const resolveWorkspaceRoot = (args: { repoRoot: string; outputDirRel?: string | null }): { ok: true; abs: string; rel: string } | { ok: false; error: string } => {
  const fallbackRel = '.knowgrph-workspace/website-imports'
  const relRaw = normalizeRel(args.outputDirRel || fallbackRel) || fallbackRel
  const normalized = path.posix.normalize(relRaw)
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return { ok: false, error: 'Missing outputDirRel' }
  if (parts[0] !== '.knowgrph-workspace') return { ok: false, error: 'outputDirRel must be under .knowgrph-workspace' }
  if (normalized.startsWith('..') || normalized.includes('/../')) return { ok: false, error: 'Invalid outputDirRel' }
  const abs = path.resolve(args.repoRoot, normalized)
  const rootResolved = path.resolve(args.repoRoot)
  if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) return { ok: false, error: 'outputDirRel escapes repo root' }
  return { ok: true, abs, rel: normalized }
}

const readJsonFile = async <T,>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return safeJsonParse<T>(raw)
  } catch {
    return null
  }
}

const writeJsonFileAtomic = async (filePath: string, value: unknown): Promise<void> => {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${filePath}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tmp, filePath)
}

const discoverSitemapUrl = async (rootUrl: string): Promise<string | null> => {
  const origin = (() => {
    try {
      return new URL(rootUrl).origin
    } catch {
      return ''
    }
  })()
  if (!origin) return null

  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.xml.gz`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap`,
  ]

  for (const u of candidates) {
    const res = await fetchTextWithLimit(u, { timeoutMs: 18_000, maxBytes: 2 * 1024 * 1024, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' })
    if (!res.ok) continue
    const t = String(res.text || '')
    if (/<urlset\b/i.test(t) || /<sitemapindex\b/i.test(t)) return u
  }

  return `${origin}/sitemap.xml`
}

const crawlInternalUrls = async (args: {
  rootUrl: string
  seedUrls: string[]
  maxPages: number
  timeoutMs: number
  maxBytes: number
}): Promise<string[]> => {
  const root = normalizeUrl(args.rootUrl)
  if (!root) return []

  const maxPages = Math.max(1, Math.min(500, Math.floor(args.maxPages)))
  const visited = new Set<string>()
  const queue: string[] = []
  const enqueue = (candidate: string) => {
    const normalized = normalizeUrl(candidate)
    if (!normalized) return
    if (!isSameHost(normalized, root)) return
    try {
      const u = new URL(normalized)
      const p = u.pathname || '/'
      if (p.startsWith('/cdn-cgi/')) return
      const leaf = p.split('/').pop() || ''
      const ext = leaf.includes('.') ? leaf.split('.').pop()?.toLowerCase() || '' : ''
      if (ext && ['css', 'js', 'mjs', 'map', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'pdf', 'zip'].includes(ext)) {
        return
      }
    } catch {
      void 0
    }
    if (visited.has(normalized)) return
    visited.add(normalized)
    queue.push(normalized)
  }

  enqueue(root)
  for (const u of args.seedUrls) enqueue(u)

  const out: string[] = []
  const hrefRe = /\bhref\s*=\s*(["'])([^"']+)\1/gi
  let fetched = 0
  const fetchLimit = Math.max(6, Math.min(120, maxPages * 3))

  while (queue.length && out.length < maxPages && fetched < fetchLimit) {
    const u = queue.shift() as string
    out.push(u)
    fetched += 1

    const htmlRes = await fetchTextWithLimit(u, { timeoutMs: args.timeoutMs, maxBytes: args.maxBytes, accept: 'text/html,*/*;q=0.9' })
    if (!htmlRes.ok) continue
    const html = String(htmlRes.text || '')
    let m: RegExpExecArray | null
    while ((m = hrefRe.exec(html))) {
      const href = String(m[2] || '').trim()
      if (!href) continue
      if (/^(javascript|data|mailto):/i.test(href)) continue
      if (href.startsWith('#')) continue
      try {
        const resolved = new URL(href, u)
        resolved.hash = ''
        enqueue(resolved.toString())
      } catch {
        void 0
      }
      if (visited.size >= maxPages) break
    }
  }

  return out
}

const collectSitemapUrls = async (rootUrl: string, sitemapUrl: string, opts: { timeoutMs: number; maxBytes: number; maxSitemaps: number }): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> => {
  const first = await fetchTextWithLimit(sitemapUrl, { timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' })
  if (first.ok !== true) return { ok: false, error: first.error }

  const visited = new Set<string>()
  const urls: string[] = []
  const enqueue = (candidate: string) => {
    const normalized = normalizeUrl(candidate)
    if (!normalized) return
    if (!isSameHost(normalized, rootUrl)) return
    if (visited.has(normalized)) return
    visited.add(normalized)
    urls.push(normalized)
  }

  const childSitemaps = looksLikeSitemapIndex(first.text) ? extractXmlLocs(first.text) : []
  if (childSitemaps.length > 0) {
    const queue = childSitemaps.slice(0, opts.maxSitemaps)
    for (const child of queue) {
      const res = await fetchTextWithLimit(child, { timeoutMs: opts.timeoutMs, maxBytes: opts.maxBytes, accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' })
      if (!res.ok) continue
      for (const loc of extractXmlLocs(res.text)) enqueue(loc)
    }
  } else {
    for (const loc of extractXmlLocs(first.text)) enqueue(loc)
  }

  return { ok: true, urls }
}

const sanitizeImportId = (raw: string): string | null => {
  const s = String(raw || '').trim()
  if (!s) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return null
  if (s.length > 96) return null
  return s
}

type StartResponse = { ok: true; importId: string } | { ok: false; error: string }

const jobs = new Map<string, { startedAtMs: number }>()

export function createWebsiteImportHandler(args: { repoRoot: string; pythonBin: string }): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    const rawUrl = String(req.url || '')
    if (!rawUrl.startsWith('/__website_import')) {
      next()
      return
    }

    const base = `http://${req.headers.host || 'localhost'}`
    const parsed = new URL(rawUrl, base)
    const pathname = parsed.pathname
    const workspaceResolved = resolveWorkspaceRoot({ repoRoot: args.repoRoot, outputDirRel: parsed.searchParams.get('outputDirRel') })
    if (workspaceResolved.ok !== true) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: workspaceResolved.error }))
      return
    }
    const workspaceAbs = workspaceResolved.abs

    if (req.method === 'GET' && pathname === '/__website_import/manifest') {
      const importId = sanitizeImportId(parsed.searchParams.get('importId') || '')
      if (!importId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing importId' }))
        return
      }
      const manifestPathAbs = path.join(workspaceAbs, importId, 'manifest.json')
      const manifest = await readJsonFile<WebsiteImportManifestV1>(manifestPathAbs)
      if (!manifest) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Not found' }))
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: true, manifest }))
      return
    }

    if (req.method === 'GET' && pathname === '/__website_import/artifact') {
      const importId = sanitizeImportId(parsed.searchParams.get('importId') || '')
      const nodeId = sanitizeImportId(parsed.searchParams.get('nodeId') || '')
      const kind = String(parsed.searchParams.get('kind') || '').trim()
      if (!importId || !nodeId || !kind) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing importId, nodeId, or kind' }))
        return
      }
      const allowed = new Set(['rawHtml', 'markdown', 'conversionJson'])
      if (!allowed.has(kind)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Invalid kind' }))
        return
      }
      const dirAbs = path.join(workspaceAbs, importId, 'nodes', nodeId)
      const fileAbs =
        kind === 'rawHtml'
          ? path.join(dirAbs, 'raw.html')
          : kind === 'markdown'
            ? path.join(dirAbs, 'page.md')
            : path.join(dirAbs, 'conversion.json')
      try {
        const text = await fs.readFile(fileAbs, 'utf8')
        res.statusCode = 200
        res.setHeader(
          'Content-Type',
          kind === 'rawHtml'
            ? 'text/html; charset=utf-8'
            : kind === 'conversionJson'
              ? 'application/json; charset=utf-8'
              : 'text/plain; charset=utf-8',
        )
        res.setHeader('Cache-Control', 'no-store')
        res.end(text)
      } catch {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Not found' }))
      }
      return
    }

    if (req.method === 'POST' && pathname === '/__website_import/import-url') {
      const chunks: Buffer[] = []
      await new Promise<void>((resolve) => {
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve())
        req.on('error', () => resolve())
      })
      const bodyRaw = Buffer.concat(chunks).toString('utf8')
      const body = safeJsonParse<{ url?: unknown; options?: unknown }>(bodyRaw) || {}
      const pageUrl = normalizeUrl(typeof body.url === 'string' ? body.url : '')
      if (!pageUrl) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing or invalid url' }))
        return
      }

      const opt = (body.options && typeof body.options === 'object' ? (body.options as Record<string, unknown>) : {})
      const includeImages = opt.includeImages !== false
      const importId = randomUUID()
      const nodeId = hashHex(pageUrl).slice(0, 24)
      const importDirAbs = path.join(workspaceAbs, importId)
      const nodeDirAbs = path.join(importDirAbs, 'nodes', nodeId)
      const manifestPathAbs = path.join(importDirAbs, 'manifest.json')
      const errors: Array<{ url: string; error: string }> = []

      try {
        await fs.mkdir(nodeDirAbs, { recursive: true })

        const rawHtmlRes = await fetchTextWithLimit(pageUrl, { timeoutMs: 40_000, maxBytes: 8 * 1024 * 1024, accept: 'text/html,*/*;q=0.9' })
        if (rawHtmlRes.ok) {
          try {
            await fs.writeFile(path.join(nodeDirAbs, 'raw.html'), rawHtmlRes.text, 'utf8')
          } catch {
            void 0
          }
        }

        const converted = await runWebpageConvert({ repoRoot: args.repoRoot, pythonBin: args.pythonBin, url: pageUrl, includeImages })
        if (converted.ok !== true) {
          errors.push({ url: pageUrl, error: converted.error })
        } else {
          const md = String(converted.markdown || '')
          try {
            await fs.writeFile(path.join(nodeDirAbs, 'page.md'), md, 'utf8')
          } catch {
            void 0
          }
          try {
            await fs.writeFile(
              path.join(nodeDirAbs, 'conversion.json'),
              JSON.stringify({ ...converted, url: pageUrl, importedAtMs: Date.now() }, null, 2),
              'utf8',
            )
          } catch {
            void 0
          }
        }

        const node: WebsiteImportNode = {
          nodeId,
          url: pageUrl,
          path: urlToTreePath(pageUrl),
          title: converted.ok === true ? converted.title || undefined : undefined,
          status: errors.length > 0 ? 'error' : 'ok',
          artifacts: {
            rawHtmlRelPath: path.posix.join(workspaceResolved.rel, importId, 'nodes', nodeId, 'raw.html'),
            markdownRelPath: path.posix.join(workspaceResolved.rel, importId, 'nodes', nodeId, 'page.md'),
            conversionJsonRelPath: path.posix.join(workspaceResolved.rel, importId, 'nodes', nodeId, 'conversion.json'),
          },
        }

        const manifest: WebsiteImportManifestV1 = {
          version: 1,
          importId,
          rootUrl: pageUrl,
          status: errors.length > 0 ? 'failed' : 'done',
          startedAtMs: Date.now(),
          finishedAtMs: Date.now(),
          nodes: [node],
          errors,
        }
        await writeJsonFileAtomic(manifestPathAbs, manifest)
        res.statusCode = errors.length > 0 ? 400 : 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ ok: errors.length === 0, importId, nodeId, url: pageUrl, error: errors[0]?.error }))
        return
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ ok: false, error: msg || 'Import failed' }))
        return
      }
    }

    if (req.method === 'POST' && pathname === '/__website_import/start') {
      const chunks: Buffer[] = []
      await new Promise<void>((resolve) => {
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve())
        req.on('error', () => resolve())
      })
      const bodyRaw = Buffer.concat(chunks).toString('utf8')
      const body = safeJsonParse<{ url?: unknown; options?: unknown }>(bodyRaw) || {}
      const rootUrl = normalizeUrl(typeof body.url === 'string' ? body.url : '')
      if (!rootUrl) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing or invalid url' }))
        return
      }
      const opt = (body.options && typeof body.options === 'object' ? (body.options as Record<string, unknown>) : {})
      const options: WebsiteImportOptions = {
        discoverSitemap: opt.discoverSitemap !== false,
        sitemapUrl: typeof opt.sitemapUrl === 'string' ? opt.sitemapUrl : undefined,
        maxPages: clampInt(opt.maxPages, 50, 1, 500),
        concurrency: clampInt(opt.concurrency, 4, 1, 12),
        includeImages: opt.includeImages !== false,
        outputDirRel: typeof opt.outputDirRel === 'string' ? opt.outputDirRel : undefined,
      }

      const importId = randomUUID()
      const importDirAbs = path.join(workspaceAbs, importId)
      const manifestPathAbs = path.join(importDirAbs, 'manifest.json')
      const initial: WebsiteImportManifestV1 = {
        version: 1,
        importId,
        rootUrl,
        status: 'queued',
        startedAtMs: Date.now(),
        nodes: [],
        errors: [],
      }
      await writeJsonFileAtomic(manifestPathAbs, initial)

      jobs.set(importId, { startedAtMs: Date.now() })
      void (async () => {
        let manifestState: WebsiteImportManifestV1 = { ...initial }
        let writing: Promise<void> | null = null
        let lastWriteAtMs = 0
        let pending: NodeJS.Timeout | null = null

        const mergeManifest = (next: Partial<WebsiteImportManifestV1>) => {
          manifestState = {
            ...manifestState,
            ...next,
            version: 1,
            importId,
            rootUrl,
            nodes: Array.isArray(next.nodes) ? next.nodes : manifestState.nodes,
            errors: Array.isArray(next.errors) ? next.errors : manifestState.errors,
          }
        }

        const flushManifestWrite = async () => {
          if (pending) {
            clearTimeout(pending)
            pending = null
          }
          if (writing) {
            try {
              await writing
            } catch {
              void 0
            }
          }
          lastWriteAtMs = Date.now()
          const snapshot = manifestState
          writing = writeJsonFileAtomic(manifestPathAbs, snapshot)
          await writing
          writing = null
        }

        const scheduleManifestWrite = () => {
          const now = Date.now()
          const waitMs = Math.max(0, 500 - (now - lastWriteAtMs))
          if (!pending) {
            pending = setTimeout(() => {
              pending = null
              void flushManifestWrite()
            }, waitMs)
          }
        }

        const updateManifest = async (next: Partial<WebsiteImportManifestV1>, opts?: { flush?: boolean }) => {
          mergeManifest(next)
          if (opts?.flush) {
            await flushManifestWrite()
            return
          }
          scheduleManifestWrite()
        }

        try {
          await fs.mkdir(path.join(importDirAbs, 'nodes'), { recursive: true })
          await updateManifest({ status: 'running' }, { flush: true })

          const explicitSitemap = normalizeUrl(options.sitemapUrl || '')
          const discovered = explicitSitemap ? explicitSitemap : options.discoverSitemap ? await discoverSitemapUrl(rootUrl) : null
          const effectiveSitemap = discovered ? normalizeUrl(discovered) : null

          const sitemapRes: { ok: true; urls: string[] } | { ok: false; error: string } = effectiveSitemap
            ? await collectSitemapUrls(rootUrl, effectiveSitemap, { timeoutMs: 30_000, maxBytes: 3 * 1024 * 1024, maxSitemaps: 30 })
            : { ok: true, urls: [] }
          const urls = sitemapRes.ok ? sitemapRes.urls : []
          const crawled = await crawlInternalUrls({
            rootUrl,
            seedUrls: urls,
            maxPages: options.maxPages || 50,
            timeoutMs: 30_000,
            maxBytes: 2 * 1024 * 1024,
          })
          const combined = (() => {
            const out: string[] = []
            const seen = new Set<string>()
            for (const u of [...urls, ...crawled]) {
              const n = normalizeUrl(u)
              if (!n) continue
              if (seen.has(n)) continue
              seen.add(n)
              out.push(n)
            }
            return out
          })()
          const limited = combined.slice(0, options.maxPages || 50)
          const errors: Array<{ url: string; error: string }> = []
          if (sitemapRes.ok !== true && effectiveSitemap) errors.push({ url: effectiveSitemap, error: sitemapRes.error })

          await updateManifest({ sitemapUrl: effectiveSitemap || undefined, errors }, { flush: true })

          const nodes: WebsiteImportNode[] = []
          const queue = limited.slice()
          let idx = 0
          const nextUrl = () => {
            if (idx >= queue.length) return null
            const u = queue[idx]
            idx += 1
            return u
          }

          const processUrl = async (u: string) => {
            const nodeId = hashHex(u).slice(0, 24)
            const nodeDirAbs = path.join(importDirAbs, 'nodes', nodeId)
            await fs.mkdir(nodeDirAbs, { recursive: true })

            const rawHtmlRes = await fetchTextWithLimit(u, { timeoutMs: 40_000, maxBytes: 8 * 1024 * 1024, accept: 'text/html,*/*;q=0.9' })
            if (rawHtmlRes.ok) {
              try {
                await fs.writeFile(path.join(nodeDirAbs, 'raw.html'), rawHtmlRes.text, 'utf8')
              } catch {
                void 0
              }
            }

            const converted = await runWebpageConvert({ repoRoot: args.repoRoot, pythonBin: args.pythonBin, url: u, includeImages: options.includeImages !== false })
            if (converted.ok !== true) {
              errors.push({ url: u, error: converted.error })
              nodes.push({ nodeId, url: u, path: urlToTreePath(u), status: 'error', artifacts: {} })
              return
            }

            const md = String(converted.markdown || '')
            try {
              await fs.writeFile(path.join(nodeDirAbs, 'page.md'), md, 'utf8')
            } catch {
              void 0
            }
            try {
              await fs.writeFile(
                path.join(nodeDirAbs, 'conversion.json'),
                JSON.stringify({ ...converted, url: u, importedAtMs: Date.now() }, null, 2),
                'utf8',
              )
            } catch {
              void 0
            }

            nodes.push({
              nodeId,
              url: u,
              path: urlToTreePath(u),
              title: converted.title || undefined,
              status: 'ok',
              artifacts: {
                rawHtmlRelPath: path.posix.join(workspaceResolved.rel, importId, 'nodes', nodeId, 'raw.html'),
                markdownRelPath: path.posix.join(workspaceResolved.rel, importId, 'nodes', nodeId, 'page.md'),
                conversionJsonRelPath: path.posix.join(workspaceResolved.rel, importId, 'nodes', nodeId, 'conversion.json'),
              },
            })
          }

          const workers = Array.from({ length: options.concurrency || 4 }).map(async () => {
            while (true) {
              const u = nextUrl()
              if (!u) return
              await processUrl(u)
              await updateManifest({ nodes: nodes.slice(), errors: errors.slice() })
            }
          })

          await Promise.all(workers)
          nodes.sort((a, b) => a.path.localeCompare(b.path))
          await updateManifest({ status: 'done', finishedAtMs: Date.now(), nodes, errors }, { flush: true })
        } catch (e) {
          const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
          await updateManifest(
            { status: 'failed', finishedAtMs: Date.now(), errors: [{ url: rootUrl, error: msg || 'Import failed' }] },
            { flush: true },
          )
        } finally {
          jobs.delete(importId)
        }
      })()

      const out: StartResponse = { ok: true, importId }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(out))
      return
    }

    if (req.method === 'GET' && pathname === '/__website_import/status') {
      const importId = sanitizeImportId(parsed.searchParams.get('importId') || '')
      if (!importId) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing importId' }))
        return
      }
      const manifestPathAbs = path.join(workspaceAbs, importId, 'manifest.json')
      const manifest = await readJsonFile<WebsiteImportManifestV1>(manifestPathAbs)
      if (!manifest) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Not found' }))
        return
      }
      const running = jobs.has(importId)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: true, status: manifest.status, running }))
      return
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: false, error: 'Not found' }))
  }
}
