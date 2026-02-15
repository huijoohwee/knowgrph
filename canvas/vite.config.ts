import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { CODEBASE_INDEX_PIPELINE_COMMAND } from './src/lib/config-copy/tooltips'
import { unwrapUserProvidedText } from './src/lib/url'
import { createPdfAssetsHandler, createPdfConvertHandler } from './src/lib/pdf/server/pdfConvertServer'
import { createPdfWorkspaceHandler } from './src/lib/pdf/server/pdfWorkspaceServer'
import { createWebsiteImportHandler } from './src/lib/websites/server/websiteImportServer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const nodeRequire = createRequire(import.meta.url)
const resolvedReact = nodeRequire.resolve('react')
const resolvedReactJsxRuntime = nodeRequire.resolve('react/jsx-runtime')
const resolvedReactJsxDevRuntime = nodeRequire.resolve('react/jsx-dev-runtime')
const resolvedReactDom = nodeRequire.resolve('react-dom')
const resolvedReactDomClient = nodeRequire.resolve('react-dom/client')

const cesiumPublicDir = path.resolve(__dirname, 'public', 'cesium')

async function ensureCesiumPublicAssets(): Promise<void> {
  try {
    const widgetsCss = path.join(cesiumPublicDir, 'Widgets', 'widgets.css')
    if (existsSync(widgetsCss)) return

    const pkgJson = nodeRequire.resolve('cesium/package.json')
    const pkgDir = path.dirname(pkgJson)
    const buildDir = path.join(pkgDir, 'Build', 'Cesium')

    await fs.mkdir(cesiumPublicDir, { recursive: true })

    const folders = ['Assets', 'Widgets', 'ThirdParty', 'Workers']
    for (const folder of folders) {
      const src = path.join(buildDir, folder)
      const dst = path.join(cesiumPublicDir, folder)
      if (!existsSync(src)) continue
      await fs.cp(src, dst, { recursive: true })
    }
  } catch {
    void 0
  }
}

const cesiumAssetsPlugin = {
  name: 'knowgrph-cesium-assets',
  async configResolved() {
    await ensureCesiumPublicAssets()
  },
  async buildStart() {
    await ensureCesiumPublicAssets()
  },
}

function withRepoPythonPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const current = String(env.PYTHONPATH || '').trim()
  const next = current ? `${repoRoot}${path.delimiter}${current}` : repoRoot
  return { ...env, PYTHONPATH: next }
}

const probePythonCandidate = (candidate: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      if (candidate !== 'python3' && candidate !== 'python' && !existsSync(candidate)) {
        resolve(false)
        return
      }
      const child = spawn(candidate, ['-c', 'import knowgrph_parser'], {
        cwd: repoRoot,
        env: withRepoPythonPath(process.env),
      })
      let done = false
      const finish = (ok: boolean) => {
        if (done) return
        done = true
        try {
          clearTimeout(timeoutId)
        } catch {
          void 0
        }
        resolve(ok)
      }
      const timeoutId = setTimeout(() => {
        try {
          child.kill()
        } catch {
          void 0
        }
        finish(false)
      }, 2_000)
      child.on('error', () => finish(false))
      child.on('close', (code) => finish(code === 0))
    } catch {
      resolve(false)
    }
  })
}

let pythonBinPromise: Promise<string> | null = null

async function getPythonBin(): Promise<string> {
  if (pythonBinPromise) return pythonBinPromise
  pythonBinPromise = (async () => {
    const fromEnv = String(process.env.KNOWGRPH_PYTHON_BIN || '').trim()
    if (fromEnv) return fromEnv
    const candidates = [
      'python3',
      'python',
      path.join(repoRoot, '.venv', 'bin', 'python3'),
      path.join(repoRoot, '.venv', 'bin', 'python'),
      path.join(repoRoot, 'venv', 'bin', 'python3'),
      path.join(repoRoot, 'venv', 'bin', 'python'),
      '/opt/homebrew/bin/python3',
      '/usr/local/bin/python3',
    ]
    for (const candidate of candidates) {
      if (await probePythonCandidate(candidate)) return candidate
    }
    return 'python3'
  })()
  return pythonBinPromise
}

async function runMarkdownPipelineOnce(): Promise<void> {
  const parts = CODEBASE_INDEX_PIPELINE_COMMAND.split(/\s+/).filter(Boolean)
  const pythonBin = await getPythonBin()
  const cmd = parts[0] === 'python' ? pythonBin : parts[0]
  const args = parts.slice(1)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: withRepoPythonPath(process.env),
    })
    child.on('error', (err) => {
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Markdown pipeline exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

const markdownPipelineDevPlugin = {
  name: 'knowgrph-markdown-pipeline-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__run_markdown_pipeline', async (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }
      try {
        await runMarkdownPipelineOnce()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        let message = 'Failed to run markdown pipeline'
        if (error && typeof error === 'object' && 'message' in error) {
          const candidate = (error as { message?: unknown }).message
          if (typeof candidate === 'string' && candidate.trim()) {
            message = candidate
          }
        }
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: message }))
      }
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/__run_markdown_pipeline', async (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }
      try {
        await runMarkdownPipelineOnce()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        let message = 'Failed to run markdown pipeline'
        if (error && typeof error === 'object' && 'message' in error) {
          const candidate = (error as { message?: unknown }).message
          if (typeof candidate === 'string' && candidate.trim()) {
            message = candidate
          }
        }
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: message }))
      }
    })
  },
}

function createLazyWebsiteImportHandler(): import('vite').Connect.NextHandleFunction {
  let handlerPromise: Promise<import('vite').Connect.NextHandleFunction> | null = null
  const getHandler = () => {
    handlerPromise =
      handlerPromise ||
      (async () => {
        return createWebsiteImportHandler({ repoRoot })
      })()
    return handlerPromise
  }
  return async (req, res, next) => {
    const handler = await getHandler()
    return handler(req, res, next)
  }
}

const remoteFetchProxyDevPlugin = {
  name: 'knowgrph-remote-fetch-proxy-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__fetch_remote')) {
        next()
        return
      }
      createRemoteFetchHandler()(req, res, next)
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/__fetch_remote')) {
        next()
        return
      }
      createRemoteFetchHandler()(req, res, next)
    })
  },
}

const webpageProxyDevPlugin = {
  name: 'knowgrph-webpage-proxy-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__webpage_proxy', createWebpageProxyHandler())
    server.middlewares.use('/__webpage_asset_proxy', createWebpageAssetProxyHandler())
    server.middlewares.use('/__repo_file', createRepoFileHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/__webpage_proxy', createWebpageProxyHandler())
    server.middlewares.use('/__webpage_asset_proxy', createWebpageAssetProxyHandler())
    server.middlewares.use('/__repo_file', createRepoFileHandler())
  },
}

const localGeoDatasetDevPlugin = {
  name: 'knowgrph-local-geo-dataset-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/__geo_upload') || req.url?.startsWith('/__geo_local/')) {
        createLocalGeoDatasetHandler()(req, res, next)
        return
      }
      next()
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/__geo_upload') || req.url?.startsWith('/__geo_local/')) {
        createLocalGeoDatasetHandler()(req, res, next)
        return
      }
      next()
    })
  },
}

const pdfConvertDevPlugin = {
  name: 'knowgrph-pdf-convert-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__convert_pdf', createPdfConvertHandler())
    server.middlewares.use('/__pdf_assets', createPdfAssetsHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/__convert_pdf', createPdfConvertHandler())
    server.middlewares.use('/__pdf_assets', createPdfAssetsHandler())
  },
}

const pdfWorkspaceDevPlugin = {
  name: 'knowgrph-pdf-workspace-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(createPdfWorkspaceHandler({ repoRoot }))
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(createPdfWorkspaceHandler({ repoRoot }))
  },
}

const websiteImportDevPlugin = {
  name: 'knowgrph-website-import-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(createLazyWebsiteImportHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(createLazyWebsiteImportHandler())
  },
}

type LocalGeoDatasetEntry = { name: string; text: string; createdAtMs: number }
const localGeoDatasetStore = new Map<string, LocalGeoDatasetEntry>()
const LOCAL_GEO_DATASET_MAX_BYTES = (() => {
  const raw = String(process.env.KNOWGRPH_LOCAL_GEO_DATASET_MAX_BYTES || '').trim()
  const parsed = raw ? Number(raw) : NaN
  if (!Number.isFinite(parsed)) return 25 * 1024 * 1024
  return Math.max(64 * 1024, Math.min(50 * 1024 * 1024, Math.floor(parsed)))
})()
const LOCAL_GEO_DATASET_TTL_MS = 30 * 60 * 1000

function pruneLocalGeoDatasetStore(nowMs: number) {
  for (const [k, v] of localGeoDatasetStore.entries()) {
    if (nowMs - v.createdAtMs > LOCAL_GEO_DATASET_TTL_MS) {
      localGeoDatasetStore.delete(k)
    }
  }
}

function createLocalGeoDatasetHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = String(req.url || '')
    const nowMs = Date.now()
    pruneLocalGeoDatasetStore(nowMs)

    if (url.startsWith('/__geo_local/')) {
      const token = url.replace(/^\/__geo_local\//, '').replace(/\.geojson(\?.*)?$/i, '').trim()
      if (!token) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing token' }))
        return
      }
      const entry = localGeoDatasetStore.get(token)
      if (!entry) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Not found' }))
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(entry.text)
      return
    }

    if (!url.startsWith('/__geo_upload')) {
      next()
      return
    }
    if (req.method !== 'POST') {
      next()
      return
    }

    try {
      const chunks: Buffer[] = []
      let total = 0
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > LOCAL_GEO_DATASET_MAX_BYTES) {
            reject(new Error('Payload too large'))
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => resolve())
        req.on('error', err => reject(err))
      })
      const raw = Buffer.concat(chunks).toString('utf8')
      const parsed = JSON.parse(raw) as { name?: unknown; text?: unknown }
      const name = typeof parsed?.name === 'string' ? parsed.name.trim() : ''
      const text = typeof parsed?.text === 'string' ? parsed.text : ''
      const trimmed = text.trim()
      if (!trimmed) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Missing text' }))
        return
      }
      const token = randomUUID()
      localGeoDatasetStore.set(token, { name: name || 'local.geojson', text, createdAtMs: nowMs })
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: true, url: `/__geo_local/${token}.geojson`, name: name || 'local.geojson' }))
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : ''
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: false, error: msg || 'Geo upload failed' }))
    }
  }
}

function createRemoteFetchHandler(): import('vite').Connect.NextHandleFunction {
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

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    const urlParam = (() => {
      try {
        const parsed = new URL(req.url || '', `http://${req.headers.host}`)
        return parsed.searchParams.get('url')
      } catch {
        return null
      }
    })()

    if (!urlParam) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid url parameter')
      return
    }

    const isHttp = /^https?:\/\//i.test(urlParam)
    let localFile: string | null = null

    if (!isHttp) {
      const candidates = [
        path.resolve(repoRoot, '..', urlParam),
        path.resolve(repoRoot, urlParam),
      ]
      for (const p of candidates) {
        try {
          const stat = await fs.stat(p)
          if (stat.isFile()) {
            localFile = p
            break
          }
        } catch {
          void 0
        }
      }
      
      if (!localFile) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Not found')
        return
      }
    }

    if (localFile) {
       try {
         const content = await fs.readFile(localFile, 'utf8')
         const injected = injectWebpageProxyHtml({
            html: content,
            originalUrl: urlParam,
         })
         res.statusCode = 200
         res.setHeader('Content-Type', 'text/html; charset=utf-8')
         res.setHeader('Cache-Control', 'no-store')
         res.end(injected)
         return
       } catch (err) {
         res.statusCode = 500
         res.end(String(err))
         return
       }
    }

    if (!isHttp) { // Should not happen given logic above
       res.statusCode = 400
       res.end('Invalid URL')
       return
    }

    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutMs = (() => {
        const raw = String(process.env.KNOWGRPH_REMOTE_FETCH_TIMEOUT_MS || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 30_000
        return Math.max(1_000, Math.min(60_000, Math.floor(parsed)))
      })()
      const maxBytes = (() => {
        const raw = String(process.env.KNOWGRPH_REMOTE_FETCH_MAX_BYTES || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 20 * 1024 * 1024
        return Math.max(64 * 1024, Math.min(50 * 1024 * 1024, Math.floor(parsed)))
      })()
      const ctrl = new AbortController()
      controller = ctrl
      let finished = false
      const abort = () => {
        if (finished) return
        try {
          ctrl.abort()
        } catch {
          void 0
        }
      }
      req.on('aborted', abort)

      timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
      const upstream = await fetch(urlParam, {
        method: req.method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          // Use generic accept for remote fetch to avoid 406/403 on raw files
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })

      if (ctrl.signal.aborted) {
        finished = true
        if (!res.writableEnded) {
          try {
            res.statusCode = 499
            res.end()
          } catch {
            void 0
          }
        }
        return
      }

      res.statusCode = upstream.status
      const contentType = upstream.headers.get('content-type')
      if (contentType) {
        res.setHeader('Content-Type', contentType)
      }
      const passthrough = ['cache-control', 'etag', 'last-modified', 'expires', 'accept-ranges']
      for (const key of passthrough) {
        try {
          const v = upstream.headers.get(key)
          if (v) res.setHeader(key, v)
        } catch {
          void 0
        }
      }
      if (req.method === 'HEAD') {
        const contentLength = upstream.headers.get('content-length')
        if (contentLength) {
          res.setHeader('Content-Length', contentLength)
        }
        res.end()
        finished = true
        return
      }
      const readWithLimit = async (): Promise<Buffer> => {
        const reader = upstream.body?.getReader()
        if (!reader) {
          const contentLengthRaw = upstream.headers.get('content-length')
          const len = contentLengthRaw ? Number(contentLengthRaw) : NaN
          if (Number.isFinite(len) && len > maxBytes) {
            throw new Error('Upstream response too large')
          }
          return Buffer.from(await upstream.arrayBuffer())
        }
        const chunks: Buffer[] = []
        let total = 0
        while (true) {
          if (ctrl.signal.aborted) throw new Error('aborted')
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue
          total += value.byteLength
          if (total > maxBytes) {
            try {
              await reader.cancel()
            } catch {
              void 0
            }
            throw new Error('Upstream response too large')
          }
          chunks.push(Buffer.from(value))
        }
        return Buffer.concat(chunks)
      }
      const buf = await readWithLimit()
      finished = true
      try {
        res.setHeader('Content-Length', String(buf.byteLength))
      } catch {
        void 0
      }
      res.end(buf)
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : 'Upstream fetch failed'
      const message = msg || 'Upstream fetch failed'
      if (controller?.signal.aborted || /aborted/i.test(message)) {
        try {
          res.statusCode = 499
          res.end()
        } catch {
          void 0
        }
        return
      }
      if (/aborted/i.test(message) || /timeout/i.test(message)) {
        res.statusCode = 504
      } else if (/too large/i.test(message)) {
        res.statusCode = 413
      } else {
        res.statusCode = 502
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(message)
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}

function stripWebpageSecurityMetasAndBase(rawHtml: string): string {
  const html = String(rawHtml || '')
  if (!html) return html
  const noBase = html.replace(/<\s*base\b[^>]*>/gi, '')
  const noCspMeta = noBase.replace(/<\s*meta\b[^>]*http-equiv\s*=\s*['"]?content-security-policy['"]?[^>]*>/gi, '')
  const noXfoMeta = noCspMeta.replace(/<\s*meta\b[^>]*http-equiv\s*=\s*['"]?x-frame-options['"]?[^>]*>/gi, '')
  return noXfoMeta
}

function rewriteWebpageMediaAssetsToProxy(opts: { html: string; originalUrl: string }): string {
  const html = String(opts.html || '')
  const originalUrl = String(opts.originalUrl || '').trim()
  if (!html || !originalUrl) return html
  const assetProxyPrefix = '/__webpage_asset_proxy?url='
  const toAbs = (raw: string) => {
    try {
      const u = String(raw || '')
      if (!/^https?:\/\//i.test(originalUrl)) {
         const dir = path.dirname(originalUrl)
         return path.join(dir, u)
      }
      return new URL(u, originalUrl).toString()
    } catch {
      return ''
    }
  }
  const toProxy = (raw: string) => {
    const abs = toAbs(raw)
    if (!abs) return raw
    return `${assetProxyPrefix}${encodeURIComponent(abs)}`
  }

  const shouldKeepAsIs = (vRaw: string) => {
    const v = String(vRaw || '')
    if (!v) return true
    if (v.startsWith('#')) return true
    if (/^\s*javascript:/i.test(v)) return true
    if (/^\s*data:/i.test(v)) return true
    if (/^\s*blob:/i.test(v)) return true
    if (/^\s*mailto:/i.test(v)) return true
    if (/^\s*tel:/i.test(v)) return true
    if (v.startsWith('/__') || v.startsWith('/@')) return true
    if (/^\s*[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(v) && !/^\s*https?:/i.test(v)) return true
    return false
  }

  const rewriteAttr = (tag: string, attr: string) => {
    const re = new RegExp(
      `(<\\s*${tag}\\b[^>]*\\s${attr}\\s*=\\s*)(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`,
      'gi',
    )
    return (src: string) =>
      src.replace(re, (_full, prefix: string, vDq?: string, vSq?: string, vBare?: string) => {
        const raw = typeof vDq === 'string' ? vDq : typeof vSq === 'string' ? vSq : typeof vBare === 'string' ? vBare : ''
        const v = String(raw || '')
        const quote = typeof vDq === 'string' ? '"' : typeof vSq === 'string' ? "'" : ''
        if (!v) return `${prefix}${quote}${v}${quote}`
        if (shouldKeepAsIs(v)) return `${prefix}${quote}${v}${quote}`
        const next = toProxy(v)
        return `${prefix}${quote}${next}${quote}`
      })
  }

  const rewriteLinkHref = () => {
    const re = /(<\s*link\b[^>]*\shref\s*=\s*)(?:"([^"]+)"|'([^']+)'|([^\s>]+))([^>]*>)/gi
    return (src: string) =>
      src.replace(re, (full: string, prefix: string, vDq?: string, vSq?: string, vBare?: string, tail?: string) => {
        const v = typeof vDq === 'string' ? vDq : typeof vSq === 'string' ? vSq : typeof vBare === 'string' ? vBare : ''
        const quote = typeof vDq === 'string' ? '"' : typeof vSq === 'string' ? "'" : ''
        const rel = String(full || '').toLowerCase()
        const shouldProxy =
          rel.includes('rel=') &&
          (rel.includes('stylesheet') || rel.includes('preload') || rel.includes('modulepreload') || rel.includes('icon'))
        const tailStr = String(tail || '')
        if (!shouldProxy) return `${prefix}${quote}${v}${quote}${tailStr}`
        if (shouldKeepAsIs(v)) return `${prefix}${quote}${v}${quote}${tailStr}`
        return `${prefix}${quote}${toProxy(v)}${quote}${tailStr}`
      })
  }

  const rewriteScriptSrc = () => {
    const re = /(<\s*script\b[^>]*\ssrc\s*=\s*)(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi
    return (src: string) =>
      src.replace(re, (_full, prefix: string, vDq?: string, vSq?: string, vBare?: string) => {
        const v = typeof vDq === 'string' ? vDq : typeof vSq === 'string' ? vSq : typeof vBare === 'string' ? vBare : ''
        const quote = typeof vDq === 'string' ? '"' : typeof vSq === 'string' ? "'" : ''
        if (shouldKeepAsIs(v)) return `${prefix}${quote}${v}${quote}`
        return `${prefix}${quote}${toProxy(v)}${quote}`
      })
  }

  const rewriteSrcset = (tag: string) => {
    const re = new RegExp(`(<\\s*${tag}\\b[^>]*\\ssrcset\\s*=\\s*)(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, 'gi')
    return (src: string) =>
      src.replace(re, (_full, prefix: string, vDq?: string, vSq?: string, vBare?: string) => {
        const v = typeof vDq === 'string' ? vDq : typeof vSq === 'string' ? vSq : typeof vBare === 'string' ? vBare : ''
        const quote = typeof vDq === 'string' ? '"' : typeof vSq === 'string' ? "'" : ''
        const parts = v
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
        const next = parts
          .map(p => {
            const m = p.match(/^(\S+)(\s+.+)?$/)
            const urlPart = m ? String(m[1] || '') : ''
            const tail = m && m[2] ? String(m[2] || '') : ''
            if (!urlPart) return p
            if (shouldKeepAsIs(urlPart)) return `${urlPart}${tail}`
            return `${toProxy(urlPart)}${tail}`
          })
          .join(', ')
        return `${prefix}${quote}${next}${quote}`
      })
  }

  let out = html
  out = rewriteAttr('img', 'src')(out)
  out = rewriteSrcset('img')(out)
  out = rewriteLinkHref()(out)
  out = rewriteScriptSrc()(out)
  out = rewriteAttr('source', 'src')(out)
  out = rewriteAttr('video', 'src')(out)
  out = rewriteAttr('video', 'poster')(out)
  out = rewriteAttr('audio', 'src')(out)
  out = rewriteAttr('track', 'src')(out)
  return out
}

function injectWebpageProxyHtml(opts: { html: string; originalUrl: string }): string {
  const html = rewriteWebpageMediaAssetsToProxy({
    html: stripWebpageSecurityMetasAndBase(String(opts.html || '')),
    originalUrl: opts.originalUrl,
  })
  const originalUrl = String(opts.originalUrl || '').trim()
  if (!html) return html

  const injection = [
    `<base href="/">`,
    '<meta name="referrer" content="no-referrer">',
    '<script>',
    '(() => {',
    `  const KG_ORIGINAL_URL = ${JSON.stringify(originalUrl)};`,
    '  let KG_NET_PENDING = 0;',
    `  const KG_WEBPAGE_NET_KIND = ${JSON.stringify('kg-webpage-net')};`,
    '  let KG_NET_POST_AT = 0;',
    '  let KG_NET_POST_TIMER = null;',
    '  const kgPostNetNow = () => {',
    '    try {',
    '      KG_NET_POST_AT = (Date.now ? Date.now() : +new Date());',
    '      window.parent && window.parent.postMessage({ kind: KG_WEBPAGE_NET_KIND, pending: KG_NET_PENDING }, "*");',
    '    } catch { void 0; }',
    '  };',
    '  const kgPostNet = () => {',
    '    try {',
    '      const now = (Date.now ? Date.now() : +new Date());',
    '      const wait = 120 - (now - KG_NET_POST_AT);',
    '      if (wait <= 0) {',
    '        if (KG_NET_POST_TIMER) { clearTimeout(KG_NET_POST_TIMER); KG_NET_POST_TIMER = null; }',
    '        kgPostNetNow();',
    '        return;',
    '      }',
    '      if (KG_NET_POST_TIMER) return;',
    '      KG_NET_POST_TIMER = setTimeout(() => { KG_NET_POST_TIMER = null; kgPostNetNow(); }, wait);',
    '    } catch { void 0; }',
    '  };',
    '  const kgNetInc = () => { try { KG_NET_PENDING += 1; } catch { void 0; } try { kgPostNet(); } catch { void 0; } };',
    '  const kgNetDec = () => { try { KG_NET_PENDING = Math.max(0, KG_NET_PENDING - 1); } catch { void 0; } try { kgPostNet(); } catch { void 0; } };',
    `  const KG_PROXY_PREFIX = ${JSON.stringify('/__webpage_proxy?url=')};`,
      `  const KG_ASSET_PROXY_PREFIX = ${JSON.stringify('/__webpage_asset_proxy?url=')};`,
    `  const KG_SCROLL_SYNC_KIND = ${JSON.stringify('kg-scroll-sync')};`,
    `  const KG_EXPORT_DOM_KIND = ${JSON.stringify('kg-export-dom')};`,
    '  const resolveAbs = (u) => {',
    '    try { return new URL(String(u || ""), KG_ORIGINAL_URL).toString(); } catch { return ""; }',
    '  };',
    '  const toProxy = (abs) => abs ? (KG_PROXY_PREFIX + encodeURIComponent(abs)) : "";',
      '  const toAssetProxy = (abs) => abs ? (KG_ASSET_PROXY_PREFIX + encodeURIComponent(abs)) : "";',
      '  const shouldBypassProxy = (abs) => {',
      '    const s = String(abs || "");',
      '    if (!s) return true;',
      '    if (s.startsWith(KG_PROXY_PREFIX) || s.startsWith(KG_ASSET_PROXY_PREFIX)) return true;',
      '    if (s.startsWith("/__") || s.startsWith("/@")) return true;',
      '    return false;',
      '  };',
      '  const patchFetch = () => {',
      '    try {',
      '      const prev = window.fetch;',
      '      if (typeof prev !== "function") return;',
      '      window.fetch = (input, init) => {',
      '        try {',
      '          const url = typeof input === "string" ? input : (input && typeof input.url === "string" ? input.url : "");',
      '          if (!url) return prev(input, init);',
      '          if (shouldBypassProxy(url)) return prev(input, init);',
      '          const abs = resolveAbs(url);',
      '          if (!abs) return prev(input, init);',
      '          const nextUrl = toAssetProxy(abs);',
      '          kgNetInc();',
      '          const p = (typeof input === "string") ? prev(nextUrl, init) : (input && typeof Request !== "undefined" && input instanceof Request) ? prev(new Request(nextUrl, input), init) : prev(nextUrl, init);',
      '          return Promise.resolve(p).finally(kgNetDec);',
      '        } catch {',
      '          try { kgNetInc(); return Promise.resolve(prev(input, init)).finally(kgNetDec); } catch { return prev(input, init); }',
      '        }',
      '      };',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  const patchXhr = () => {',
      '    try {',
      '      const proto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;',
      '      if (!proto || typeof proto.open !== "function") return;',
      '      const prevOpen = proto.open;',
      '      const prevSend = proto.send;',
      '      proto.open = function(method, url, async, user, password) {',
      '        try {',
      '          const u = String(url || "");',
      '          if (!u || shouldBypassProxy(u)) return prevOpen.call(this, method, url, async, user, password);',
      '          const abs = resolveAbs(u);',
      '          if (!abs) return prevOpen.call(this, method, url, async, user, password);',
      '          const nextUrl = toAssetProxy(abs);',
      '          return prevOpen.call(this, method, nextUrl, async, user, password);',
      '        } catch {',
      '          return prevOpen.call(this, method, url, async, user, password);',
      '        }',
      '      };',
      '      if (typeof prevSend === "function") {',
      '        proto.send = function(body) {',
      '          try {',
      '            kgNetInc();',
      '            const done = () => { try { this.removeEventListener("load", done); this.removeEventListener("error", done); this.removeEventListener("abort", done); this.removeEventListener("timeout", done); } catch { void 0; } kgNetDec(); };',
      '            try { this.addEventListener("load", done); this.addEventListener("error", done); this.addEventListener("abort", done); this.addEventListener("timeout", done); } catch { void 0; }',
      '            return prevSend.call(this, body);',
      '          } catch {',
      '            kgNetDec();',
      '            return prevSend.call(this, body);',
      '          }',
      '        };',
      '      }',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
    '  const handleAnchorClick = (e) => {',
    '    try {',
    '      const target = e.target;',
    '      if (!(target instanceof Element)) return;',
    '      const a = target.closest("a[href]");',
    '      if (!a) return;',
    '      const href = a.getAttribute("href") || "";',
    '      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;',
    '      const abs = resolveAbs(href);',
    '      if (!abs) return;',
    '      e.preventDefault();',
    '      window.location.href = toProxy(abs);',
    '    } catch {',
    '      void 0;',
    '    }',
    '  };',
    '  window.addEventListener("click", handleAnchorClick, true);',
      '  patchFetch();',
      '  patchXhr();',
    '  try { kgPostNet(); } catch { void 0; }',
      '  const rewriteAttrUrl = (el, attr) => {',
      '    try {',
      '      if (!el || typeof el.getAttribute !== "function" || typeof el.setAttribute !== "function") return;',
      '      const raw = el.getAttribute(attr) || "";',
      '      const v = String(raw || "");',
      '      if (!v) return;',
      '      if (/^\\s*javascript:/i.test(v)) return;',
      '      if (v.startsWith("#")) return;',
      '      if (/^\\s*data:/i.test(v)) return;',
      '      if (/^\\s*blob:/i.test(v)) return;',
      '      if (/^\\s*mailto:/i.test(v) || /^\\s*tel:/i.test(v)) return;',
      '      if (/^\\s*[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(v) && !/^\\s*https?:/i.test(v)) return;',
      '      if (v.startsWith("/__") || v.startsWith("/@")) return;',
      '      const abs = resolveAbs(v);',
      '      if (!abs) return;',
      '      el.setAttribute(attr, toAssetProxy(abs));',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  const rewriteSrcset = (el) => {',
      '    try {',
      '      if (!el || typeof el.getAttribute !== "function" || typeof el.setAttribute !== "function") return;',
      '      const raw = el.getAttribute("srcset") || "";',
      '      const v = String(raw || "");',
      '      if (!v) return;',
      '      const parts = v.split(",").map(x => x.trim()).filter(Boolean);',
      '      const next = parts.map(p => {',
      '        const m = p.match(/^(\\S+)(\\s+.+)?$/);',
      '        const urlPart = m ? String(m[1] || "") : "";',
      '        const tail = m && m[2] ? String(m[2] || "") : "";',
      '        if (!urlPart) return p;',
      '        if (/^\\s*javascript:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '        if (urlPart.startsWith("#")) return `${urlPart}${tail}`;',
      '        if (/^\\s*data:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '        if (/^\\s*blob:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '        if (/^\\s*mailto:/i.test(urlPart) || /^\\s*tel:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '        if (/^\\s*[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(urlPart) && !/^\\s*https?:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '        if (urlPart.startsWith("/__") || urlPart.startsWith("/@")) return `${urlPart}${tail}`;',
      '        const abs = resolveAbs(urlPart);',
      '        if (!abs) return `${urlPart}${tail}`;',
      '        return `${toAssetProxy(abs)}${tail}`;',
      '      }).join(", ");',
      '      if (next) el.setAttribute("srcset", next);',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  const rewriteElement = (el) => {',
      '    try {',
      '      const tag = (el && el.tagName ? String(el.tagName) : "").toLowerCase();',
      '      if (!tag) return;',
      '      if (tag === "script") rewriteAttrUrl(el, "src");',
      '      if (tag === "link") rewriteAttrUrl(el, "href");',
      '      if (tag === "img") { rewriteAttrUrl(el, "src"); rewriteSrcset(el); }',
      '      if (tag === "source" || tag === "track" || tag === "audio" || tag === "video") rewriteAttrUrl(el, "src");',
    '      if (tag === "video") rewriteAttrUrl(el, "poster");',
    '      if (tag === "iframe") {',
    '        try {',
    '          const src = el.getAttribute && el.getAttribute("src");',
    '          const v = String(src || "").trim();',
    '          if (!v) return;',
    '          if (/^\\s*javascript:/i.test(v) || /^\\s*data:/i.test(v) || /^\\s*blob:/i.test(v)) return;',
    '          const abs = resolveAbs(v);',
    '          if (!abs) return;',
    '          const o = new URL(KG_ORIGINAL_URL);',
    '          const a = new URL(abs);',
    '          if (o.origin !== a.origin) return;',
    '          el.setAttribute("src", toProxy(abs));',
    '        } catch {',
    '          void 0;',
    '        }',
    '      }',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  const rewriteExisting = () => {',
      '    try {',
      '      document.querySelectorAll("script[src],link[href],img[src],img[srcset],source[src],track[src],video[src],video[poster],audio[src],iframe[src]").forEach(rewriteElement);',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  const observeAdds = () => {',
      '    try {',
      '      const mo = new MutationObserver((mutations) => {',
      '        for (const m of mutations) {',
      '          for (const node of m.addedNodes || []) {',
      '            if (!node || node.nodeType !== 1) continue;',
      '            rewriteElement(node);',
      '            try {',
      '              (node.querySelectorAll ? node.querySelectorAll("script[src],link[href],img[src],img[srcset],source[src],track[src],video[src],video[poster],audio[src],iframe[src]") : []).forEach(rewriteElement);',
      '            } catch {',
      '              void 0;',
      '            }',
      '          }',
      '        }',
      '      });',
      '      mo.observe(document.documentElement, { childList: true, subtree: true });',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  rewriteExisting();',
      '  observeAdds();',
    '  const clamp01 = (n) => (n <= 0 ? 0 : n >= 1 ? 1 : n);',
    '  const getScrollEl = () => document.scrollingElement || document.documentElement || document.body;',
    '  const getRatio = () => {',
    '    const el = getScrollEl();',
    '    if (!el) return 0;',
    '    const max = Math.max(1, el.scrollHeight - el.clientHeight);',
    '    return clamp01(el.scrollTop / max);',
    '  };',
    '  const setRatio = (ratio) => {',
    '    const el = getScrollEl();',
    '    if (!el) return;',
    '    const max = Math.max(0, el.scrollHeight - el.clientHeight);',
    '    el.scrollTop = Math.round(clamp01(ratio) * max);',
    '  };',
    '  let lockOwner = null;',
    '  let lockUntil = 0;',
    '  const canSync = (owner) => {',
    '    const now = Date.now();',
    '    if (!lockOwner || now > lockUntil) { lockOwner = null; lockUntil = 0; return true; }',
    '    return lockOwner === owner;',
    '  };',
    '  const postRatio = () => {',
    '    try { window.parent && window.parent.postMessage({ kind: KG_SCROLL_SYNC_KIND, ratio: getRatio() }, "*"); } catch { void 0; }',
    '  };',
    '  const onScroll = () => {',
    '    if (!canSync("iframe")) return;',
    '    lockOwner = "iframe"; lockUntil = Date.now() + 160;',
    '    postRatio();',
    '  };',
    '  try {',
    '    const el = getScrollEl();',
    '    if (el && el.addEventListener) el.addEventListener("scroll", onScroll, { passive: true });',
    '    window.addEventListener("message", (e) => {',
    '      const d = e && e.data;',
    '      if (!d) return;',
    '      if (d.kind === KG_SCROLL_SYNC_KIND && typeof d.ratio === "number") {',
    '        if (!canSync("parent")) return;',
    '        lockOwner = "parent"; lockUntil = Date.now() + 160;',
    '        setRatio(d.ratio);',
    '        return;',
    '      }',
    '      if (d.kind === KG_EXPORT_DOM_KIND && d.id) {',
    '        try {',
    '          if (e.source !== window.parent) return;',
    '          const maxCharsRaw = typeof d.maxChars === "number" ? d.maxChars : 4000000;',
    '          const maxChars = Math.max(64000, Math.min(8000000, Math.floor(maxCharsRaw)));',
    '          const mode = d.mode === "text" ? "text" : "html";',
    '          const depth = typeof d.depth === "number" && isFinite(d.depth) ? Math.max(0, Math.min(2, Math.floor(d.depth))) : 0;',
    '          const includeChildren = mode === "text" && depth === 0 && d.includeChildren !== false;',
    '          const readText = () => {',
    '            try {',
    '              const body = document.body;',
    '              const t1 = body && typeof body.innerText === "string" ? body.innerText : "";',
    '              const t2 = body && typeof body.textContent === "string" ? body.textContent : "";',
    '              const a = String(t1 || "").trim();',
    '              const b = String(t2 || "").trim();',
    '              const base = b.length > a.length ? b : a;',
    '              let shadow = "";',
    '              try {',
    '                const root = body || document.documentElement;',
    '                if (root && document.createTreeWalker) {',
    '                  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);',
    '                  let n = 0;',
    '                  while (w.nextNode()) {',
    '                    n += 1;',
    '                    if (n > 2200) break;',
    '                    const el = w.currentNode;',
    '                    const tag = el && el.tagName ? String(el.tagName).toLowerCase() : "";',
    '                    if (tag === "template" && el.content && el.content.textContent) {',
    '                      const tt = String(el.content.textContent || "").trim();',
    '                      if (tt) shadow += "\n" + tt;',
    '                    }',
    '                    if (el && el.shadowRoot && el.shadowRoot.textContent) {',
    '                      const st = String(el.shadowRoot.textContent || "").trim();',
    '                      if (st) shadow += "\n" + st;',
    '                    }',
    '                    if (shadow.length > 2400000) break;',
    '                  }',
    '                }',
    '              } catch {',
    '                void 0;',
    '              }',
    '              const combined = (base + "\n" + shadow).trim();',
    '              return combined.length > base.length ? combined : base;',
    '            } catch {',
    '              return "";',
    '            }',
    '          };',
    '          const readHtml = () => { try { return document.documentElement ? document.documentElement.outerHTML : ""; } catch { return ""; } };',
    '          const computeRaw = () => (mode === "text" ? readText() : readHtml());',
    '          const send = (payload) => { try { window.parent && window.parent.postMessage(payload, "*"); } catch { void 0; } };',
    '          const replyNow = () => {',
    '            const raw = computeRaw();',
    '            const clipped = raw && raw.length > maxChars;',
    '            const text = clipped ? raw.slice(0, maxChars) : raw;',
    '            send({ kind: KG_EXPORT_DOM_KIND, id: d.id, mode, title: document.title || "", clipped, text });',
    '          };',
    '          const maybeCrawl = async () => {',
    '            try {',
    '              if (!d || !d.scrollCrawl) return;',
    '              const el = document.scrollingElement || document.documentElement || document.body;',
    '              if (!el) return;',
    '              const sleep = (ms) => new Promise(r => setTimeout(r, ms));',
    '              const max = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));',
    '              if (!max) return;',
    '              const steps = 8;',
    '              for (let i = 0; i <= steps; i += 1) {',
    '                const y = Math.round((max * i) / steps);',
    '                try { el.scrollTop = y; window.scrollTo && window.scrollTo(0, y); } catch { void 0; }',
    '                await sleep(250);',
    '              }',
    '            } catch {',
    '              void 0;',
    '            }',
    '          };',
    '          const safeClick = (el) => {',
    '            try {',
    '              if (!el || typeof el !== "object") return false;',
    '              const tag = el.tagName ? String(el.tagName).toLowerCase() : "";',
    '              if (!tag) return false;',
    '              if (tag === "a") {',
    '                const href = String(el.getAttribute && el.getAttribute("href") || "").trim();',
    '                if (href && !href.startsWith("#") && !/^\\s*javascript:/i.test(href)) return false;',
    '              }',
    '              if (tag === "button") {',
    '                const type = String(el.getAttribute && el.getAttribute("type") || "").toLowerCase();',
    '                if (type && type !== "button") return false;',
    '              }',
    '              if (el.hasAttribute && el.hasAttribute("disabled")) return false;',
    '              if (el.getAttribute) {',
    '                const role = String(el.getAttribute("role") || "").toLowerCase();',
    '                const aria = String(el.getAttribute("aria-disabled") || "").toLowerCase();',
    '                if (aria === "true") return false;',
    '                if (role && role !== "button" && role !== "tab" && role !== "switch") {',
    '                  void 0;',
    '                }',
    '              }',
    '              if (typeof el.click === "function") { el.click(); return true; }',
    '              return false;',
    '            } catch {',
    '              return false;',
    '            }',
    '          };',
    '          const safeReveal = (el) => {',
    '            try {',
    '              if (!el || typeof el !== "object") return;',
    '              try { if (el.removeAttribute) el.removeAttribute("hidden"); } catch { void 0; }',
    '              try { if (el.setAttribute) el.setAttribute("aria-hidden", "false"); } catch { void 0; }',
    '              try {',
    '                if (el.style) {',
    '                  if (String(el.style.display || "") === "none") el.style.display = "block";',
    '                  if (String(el.style.visibility || "") === "hidden") el.style.visibility = "visible";',
    '                  if (String(el.style.opacity || "") === "0") el.style.opacity = "1";',
    '                  if (String(el.style.maxHeight || "") === "0px" || String(el.style.maxHeight || "") === "0") el.style.maxHeight = "none";',
    '                  if (String(el.style.height || "") === "0px" || String(el.style.height || "") === "0") el.style.height = "auto";',
    '                  if (String(el.style.overflow || "") === "hidden") el.style.overflow = "visible";',
    '                }',
    '              } catch {',
    '                void 0;',
    '              }',
    '            } catch {',
    '              void 0;',
    '            }',
    '          };',
    '          const expandAriaControls = () => {',
    '            try {',
    '              document.querySelectorAll("[aria-controls]").forEach((t2) => {',
    '                try {',
    '                  const expanded = String(t2.getAttribute("aria-expanded") || "").toLowerCase();',
    '                  const controls = String(t2.getAttribute("aria-controls") || "").trim();',
    '                  if (!controls) return;',
    '                  if (expanded && expanded !== "false") return;',
    '                  const target = document.getElementById(controls);',
    '                  if (target) safeReveal(target);',
    '                  try { t2.setAttribute("aria-expanded", "true"); } catch { void 0; }',
    '                  safeClick(t2);',
    '                } catch { void 0; }',
    '              });',
    '            } catch { void 0; }',
    '          };',
    '          const revealAccordionContainers = () => {',
    '            try {',
    '              const candidates = [];',
    '              const push = (el) => { if (el && candidates.indexOf(el) < 0) candidates.push(el); };',
    '              document.querySelectorAll("[class]").forEach((el2) => {',
    '                try {',
    '                  const cls = String(el2.className || "").toLowerCase();',
    '                  if (!cls) return;',
    '                  if (cls.includes("accordion") || cls.includes("faq")) push(el2);',
    '                } catch { void 0; }',
    '              });',
    '              for (const box of candidates.slice(0, 60)) {',
    '                try {',
    '                  box.querySelectorAll("[hidden],[aria-hidden=\\"true\\"]").forEach((x) => safeReveal(x));',
    '                  box.querySelectorAll("[style*=\\"display:none\\"],[style*=\\"display: none\\"]").forEach((x) => safeReveal(x));',
    '                } catch { void 0; }',
    '              }',
    '            } catch { void 0; }',
    '          };',
    '          const autoExpandFaq = async () => {',
    '            try {',
    '              const sleep = (ms) => new Promise(r => setTimeout(r, ms));',
    '              const waitNetIdle = async (timeoutMs) => {',
    '                try {',
    '                  const t0 = Date.now();',
    '                  while (Date.now() - t0 < (timeoutMs || 0)) {',
    '                    if (!KG_NET_PENDING) return;',
    '                    await sleep(60);',
    '                  }',
    '                } catch { void 0; }',
    '              };',
    '              const opened = new Set();',
    '              const tryOpenDetails = () => {',
    '                try {',
    '                  document.querySelectorAll("details:not([open])").forEach((d2) => {',
    '                    try { d2.open = true; opened.add(d2); } catch { void 0; }',
    '                  });',
    '                } catch { void 0; }',
    '              };',
    '              const tryClickSummaries = () => {',
    '                try {',
    '                  document.querySelectorAll("details summary").forEach((s2) => {',
    '                    try { safeClick(s2); } catch { void 0; }',
    '                  });',
    '                } catch { void 0; }',
    '              };',
    '              const selectors = [',
    '                "[aria-expanded=\\"false\\"][aria-controls]",',
    '                "button[aria-expanded=\\"false\\"]",',
    '                "[role=\\"button\\"][aria-expanded=\\"false\\"]",',
    '                ".accordion__header, .accordion-header, .faq__question, .faq-question",',
    '                ".t-accordion__header, .t-accordion__trigger, .t-accordion__title",',
    '              ];',
    '              const collect = () => {',
    '                const out = [];',
    '                try {',
    '                  for (const sel of selectors) {',
    '                    try { document.querySelectorAll(sel).forEach((el2) => out.push(el2)); } catch { void 0; }',
    '                  }',
    '                } catch { void 0; }',
    '                return out;',
    '              };',
    '              const clickBatch = (els) => {',
    '                let n = 0;',
    '                for (let i = 0; i < els.length; i += 1) {',
    '                  const el2 = els[i];',
    '                  if (!el2 || opened.has(el2)) continue;',
    '                  if (safeClick(el2)) { opened.add(el2); n += 1; }',
    '                  if (n >= 24) break;',
    '                }',
    '                return n;',
    '              };',
    '              const keywordClickWithin = (root) => {',
    '                try {',
    '                  if (!root || !root.querySelectorAll) return 0;',
    '                  const needles = ["faq", "question", "questions", "apply", "contact"];',
    '                  const els = Array.from(root.querySelectorAll("a,button,[role=button],[role=tab],[role=switch]"));',
    '                  let n = 0;',
    '                  for (let i = 0; i < els.length; i += 1) {',
    '                    const el2 = els[i];',
    '                    if (!el2 || opened.has(el2)) continue;',
    '                    const txt = String(el2.textContent || "").trim().toLowerCase();',
    '                    if (!txt) continue;',
    '                    let hit = false;',
    '                    for (const k of needles) { if (txt.includes(k)) { hit = true; break; } }',
    '                    if (!hit) continue;',
    '                    if (safeClick(el2)) { opened.add(el2); n += 1; }',
    '                    if (n >= 12) break;',
    '                  }',
    '                  return n;',
    '                } catch {',
    '                  return 0;',
    '                }',
    '              };',
    '              tryOpenDetails();',
    '              tryClickSummaries();',
    '              expandAriaControls();',
    '              revealAccordionContainers();',
    '              try {',
    '                const boxes = Array.from(document.querySelectorAll("[class*=\\"accordion\\"],[class*=\\"Accordion\\"],[class*=\\"faq\\"],[class*=\\"Faq\\"]")).slice(0, 40);',
    '                for (const b of boxes) keywordClickWithin(b);',
    '              } catch { void 0; }',
    '              try { keywordClickWithin(document.body || document.documentElement); } catch { void 0; }',
    '              await waitNetIdle(900);',
    '              for (let round = 0; round < 4; round += 1) {',
    '                const els = collect();',
    '                const clicked = clickBatch(els);',
    '                await sleep(clicked ? 350 : 150);',
    '                tryOpenDetails();',
    '                expandAriaControls();',
    '                revealAccordionContainers();',
    '                try {',
    '                  const boxes = Array.from(document.querySelectorAll("[class*=\\"accordion\\"],[class*=\\"Accordion\\"],[class*=\\"faq\\"],[class*=\\"Faq\\"]")).slice(0, 40);',
    '                  let kclicked = 0;',
    '                  for (const b of boxes) { kclicked += keywordClickWithin(b); if (kclicked >= 12) break; }',
    '                } catch { void 0; }',
    '                await waitNetIdle(clicked ? 1200 : 500);',
    '              }',
    '            } catch {',
    '              void 0;',
    '            }',
    '          };',
    '          const run = async () => {',
    '            if (d && d.expandFaq) await autoExpandFaq();',
    '            if (d && d.scrollCrawl) await maybeCrawl();',
    '            if (!includeChildren) { replyNow(); return; }',
    '          const iframes = Array.from(document.querySelectorAll("iframe")).slice(0, 8);',
    '          if (!iframes.length) { replyNow(); return; }',
    '          const childTimeoutMs = 1200;',
    '          const startedAt = Date.now();',
    '          const childPieces = [];',
    '          const pending = new Set();',
    '          const onChild = (ev) => {',
    '            try {',
    '              const dd = ev && ev.data;',
    '              if (!dd || dd.kind !== KG_EXPORT_DOM_KIND || !dd.id || !pending.has(dd.id)) return;',
    '              pending.delete(dd.id);',
    '              const t = String(dd.text || "").trim();',
    '              if (t) childPieces.push(t);',
    '            } catch { void 0; }',
    '          };',
    '          window.addEventListener("message", onChild);',
    '          for (let i = 0; i < iframes.length; i += 1) {',
    '            const f = iframes[i];',
    '            const w = f && f.contentWindow;',
    '            if (!w) continue;',
    '            const cid = String(d.id) + ":c" + String(i);',
    '            pending.add(cid);',
    '            try { w.postMessage({ kind: KG_EXPORT_DOM_KIND, id: cid, mode: "text", maxChars: Math.min(maxChars, 1200000), depth: 1, includeChildren: false }, "*"); } catch { pending.delete(cid); }',
    '          }',
    '          const finish = () => {',
    '            try { window.removeEventListener("message", onChild); } catch { void 0; }',
    '            const base = String(computeRaw() || "").trim();',
    '            const combined = [base, ...childPieces].filter(Boolean).join("\n\n");',
    '            const clipped = combined && combined.length > maxChars;',
    '            const text = clipped ? combined.slice(0, maxChars) : combined;',
    '            send({ kind: KG_EXPORT_DOM_KIND, id: d.id, mode, title: document.title || "", clipped, text });',
    '          };',
    '          const tick = () => {',
    '            if (!pending.size) return finish();',
    '            if (Date.now() - startedAt > childTimeoutMs) return finish();',
    '            setTimeout(tick, 60);',
    '          };',
    '          tick();',
    '          };',
    '          run();',
    '        } catch {',
    '          void 0;',
    '        }',
    '      }',
    '    });',
    '  } catch {',
    '    void 0;',
    '  }',
    '})();',
    '</script>',
  ].join('\n')

  const lower = html.toLowerCase()
  const headOpen = lower.indexOf('<head')
  if (headOpen >= 0) {
    const headEnd = lower.indexOf('>', headOpen)
    if (headEnd >= 0) {
      return `${html.slice(0, headEnd + 1)}\n${injection}\n${html.slice(headEnd + 1)}`
    }
  }
  const htmlOpen = lower.indexOf('<html')
  if (htmlOpen >= 0) {
    const htmlEnd = lower.indexOf('>', htmlOpen)
    if (htmlEnd >= 0) {
      return `${html.slice(0, htmlEnd + 1)}\n<head>\n${injection}\n</head>\n${html.slice(htmlEnd + 1)}`
    }
  }
  return `<!doctype html><html><head>\n${injection}\n</head><body>\n${html}\n</body></html>`
}

function createWebpageProxyHandler(): import('vite').Connect.NextHandleFunction {
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

    const urlParam = (() => {
      try {
        const parsed = new URL(req.url || '', `http://${req.headers.host}`)
        return parsed.searchParams.get('url')
      } catch {
        return null
      }
    })()

    if (!urlParam) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid url parameter')
      return
    }

    const isHttp = /^https?:\/\//i.test(urlParam)
    let localFile: string | null = null

    if (!isHttp) {
      const roots = [path.resolve(repoRoot, '..'), path.resolve(repoRoot)]
      for (const root of roots) {
        const abs = path.resolve(root, urlParam)
        const rootResolved = path.resolve(root)
        if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) continue
        try {
          const stat = await fs.stat(abs)
          if (stat.isFile()) {
            localFile = abs
            break
          }
        } catch {
          void 0
        }
      }
      
      if (!localFile) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Not found')
        return
      }
    }

    if (localFile) {
       try {
         const content = await fs.readFile(localFile)
         const ext = path.extname(localFile).toLowerCase()
         const types: Record<string, string> = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.mjs': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'font/otf',
            '.ico': 'image/x-icon',
         }
         const contentType = types[ext] || 'application/octet-stream'
         res.statusCode = 200
         res.setHeader('Content-Type', contentType)
         res.setHeader('Cache-Control', 'no-store')
         res.setHeader('Access-Control-Allow-Origin', '*')
         res.end(content)
         return
       } catch (err) {
         res.statusCode = 500
         res.end(String(err))
         return
       }
    }

    if (!isHttp) {
       res.statusCode = 400
       res.end('Invalid URL')
       return
    }

    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutMs = (() => {
        const raw = String(process.env.KNOWGRPH_WEBPAGE_PROXY_TIMEOUT_MS || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 30_000
        return Math.max(1_000, Math.min(120_000, Math.floor(parsed)))
      })()
      const maxBytes = (() => {
        const raw = String(process.env.KNOWGRPH_WEBPAGE_PROXY_MAX_BYTES || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 10 * 1024 * 1024
        return Math.max(64 * 1024, Math.min(50 * 1024 * 1024, Math.floor(parsed)))
      })()
      const ctrl = new AbortController()
      controller = ctrl
      let finished = false
      const abort = () => {
        if (finished) return
        try {
          ctrl.abort()
        } catch {
          void 0
        }
      }
      req.on('aborted', abort)

      timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
      const upstream = await fetch(urlParam, {
        method: req.method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,*/*;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })

      if (ctrl.signal.aborted) {
        finished = true
        if (!res.writableEnded) {
          try {
            res.statusCode = 499
            res.end()
          } catch {
            void 0
          }
        }
        return
      }

      res.statusCode = upstream.status
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      if (req.method === 'HEAD') {
        res.end()
        finished = true
        return
      }

      const reader = upstream.body?.getReader()
      let buf: Buffer
      if (!reader) {
        const contentLengthRaw = upstream.headers.get('content-length')
        const len = contentLengthRaw ? Number(contentLengthRaw) : NaN
        if (Number.isFinite(len) && len > maxBytes) throw new Error('Upstream response too large')
        buf = Buffer.from(await upstream.arrayBuffer())
      } else {
        const chunks: Buffer[] = []
        let total = 0
        while (true) {
          if (ctrl.signal.aborted) throw new Error('aborted')
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue
          total += value.byteLength
          if (total > maxBytes) {
            try {
              await reader.cancel()
            } catch {
              void 0
            }
            throw new Error('Upstream response too large')
          }
          chunks.push(Buffer.from(value))
        }
        buf = Buffer.concat(chunks)
      }
      finished = true

      const raw = buf.toString('utf8')
      const injected = injectWebpageProxyHtml({
        html: raw,
        originalUrl: urlParam,
      })
      res.end(injected, 'utf8')
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : 'Upstream fetch failed'
      const message = msg || 'Upstream fetch failed'
      if (controller?.signal.aborted || /aborted/i.test(message)) {
        try {
          res.statusCode = 499
          res.end()
        } catch {
          void 0
        }
        return
      }
      if (/aborted/i.test(message) || /timeout/i.test(message)) {
        res.statusCode = 504
      } else if (/too large/i.test(message)) {
        res.statusCode = 413
      } else {
        res.statusCode = 502
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(message)
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}

function createRepoFileHandler(): import('vite').Connect.NextHandleFunction {
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

    const repoPath = (() => {
      try {
        const parsed = new URL(req.url || '', `http://${req.headers.host}`)
        const p = parsed.pathname.replace(/^\/__repo_file\/?/, '')
        return decodeURIComponent(p).replace(/\\/g, '/').replace(/^\/+/, '')
      } catch {
        return ''
      }
    })()

    if (!repoPath || repoPath.includes('..')) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid path')
      return
    }

    const rootResolved = path.resolve(repoRoot)
    const fileAbs = path.resolve(rootResolved, repoPath)
    if (!fileAbs.startsWith(rootResolved + path.sep) && fileAbs !== rootResolved) {
      res.statusCode = 403
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Forbidden')
      return
    }

    try {
      const stat = await fs.stat(fileAbs)
      if (!stat.isFile()) throw new Error('Not found')
      const content = await fs.readFile(fileAbs)
      const ext = path.extname(fileAbs).toLowerCase()
      const types: Record<string, string> = {
        '.html': 'text/html',
        '.htm': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'font/otf',
        '.ico': 'image/x-icon',
      }
      const contentType = types[ext] || 'application/octet-stream'
      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(content)
    } catch {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Not found')
    }
  }
}

function createWebpageAssetProxyHandler(): import('vite').Connect.NextHandleFunction {
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

    const urlParam = (() => {
      try {
        const parsed = new URL(req.url || '', `http://${req.headers.host}`)
        return parsed.searchParams.get('url')
      } catch {
        return null
      }
    })()
    if (!urlParam || !/^https?:\/\//i.test(urlParam)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid url parameter')
      return
    }

    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutMs = (() => {
        const raw = String(process.env.KNOWGRPH_WEBPAGE_ASSET_PROXY_TIMEOUT_MS || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 30_000
        return Math.max(1_000, Math.min(120_000, Math.floor(parsed)))
      })()
      const maxBytes = (() => {
        const raw = String(process.env.KNOWGRPH_WEBPAGE_ASSET_PROXY_MAX_BYTES || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 25 * 1024 * 1024
        return Math.max(64 * 1024, Math.min(100 * 1024 * 1024, Math.floor(parsed)))
      })()

      const ctrl = new AbortController()
      controller = ctrl
      let finished = false
      const abort = () => {
        if (finished) return
        try {
          ctrl.abort()
        } catch {
          void 0
        }
      }
      req.on('aborted', abort)

      timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
      const upstream = await fetch(urlParam, {
        method: req.method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      if (ctrl.signal.aborted) {
        finished = true
        if (!res.writableEnded) {
          try {
            res.statusCode = 499
            res.end()
          } catch {
            void 0
          }
        }
        return
      }

      res.statusCode = upstream.status
      res.setHeader('Cache-Control', 'public, max-age=300')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

      const contentType = upstream.headers.get('content-type')
      if (contentType) res.setHeader('Content-Type', contentType)

      if (req.method === 'HEAD') {
        res.end()
        finished = true
        return
      }

      const reader = upstream.body?.getReader()
      let buf: Buffer
      if (!reader) {
        const contentLengthRaw = upstream.headers.get('content-length')
        const len = contentLengthRaw ? Number(contentLengthRaw) : NaN
        if (Number.isFinite(len) && len > maxBytes) throw new Error('Upstream response too large')
        buf = Buffer.from(await upstream.arrayBuffer())
      } else {
        const chunks: Buffer[] = []
        let total = 0
        while (true) {
          if (ctrl.signal.aborted) throw new Error('aborted')
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue
          total += value.byteLength
          if (total > maxBytes) {
            try {
              await reader.cancel()
            } catch {
              void 0
            }
            throw new Error('Upstream response too large')
          }
          chunks.push(Buffer.from(value))
        }
        buf = Buffer.concat(chunks)
      }
      finished = true
      res.end(buf)
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : 'Upstream fetch failed'
      const message = msg || 'Upstream fetch failed'
      if (controller?.signal.aborted || /aborted/i.test(message)) {
        try {
          res.statusCode = 499
          res.end()
        } catch {
          void 0
        }
        return
      }
      if (/aborted/i.test(message) || /timeout/i.test(message)) {
        res.statusCode = 504
      } else if (/too large/i.test(message)) {
        res.statusCode = 413
      } else {
        res.statusCode = 502
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(message)
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}

type YoutubeConvertResult =
  | { ok: true; markdown: string; name: string; transcript: Record<string, unknown> }
  | { ok: false; error: string }

async function runKnowgrphParserConvertYoutubeToPayload(opts: {
  url: string
  lang?: string
}): Promise<YoutubeConvertResult> {
  const pythonBin = await getPythonBin()
  return new Promise((resolve) => {
    const timeoutMs = (() => {
      const raw = Number(process.env.KG_YOUTUBE_TRANSCRIPT_TIMEOUT_MS || '')
      const fallback = 20 * 60_000
      const min = 10_000
      const max = 60 * 60_000
      if (!Number.isFinite(raw)) return fallback
      return Math.min(max, Math.max(min, Math.floor(raw)))
    })()
    const args = ['-m', 'knowgrph_parser', 'youtube', '--emit', 'json', '--url', opts.url]
    if (opts.lang && opts.lang.trim()) {
      args.push('--lang', opts.lang.trim())
    }
    
    const child = spawn(pythonBin, args, {
      cwd: repoRoot,
      env: withRepoPythonPath(process.env),
      timeout: timeoutMs,
    })

    let stdout = ''
    let stderr = ''
    let exited = false

    const cleanup = () => {
      if (!exited) {
        child.kill()
        exited = true
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve({ ok: false, error: `YouTube conversion timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      if (exited) return
      exited = true
      resolve({ ok: false, error: err.message || 'YouTube conversion process error' })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (exited) return
      exited = true

      if (code !== 0) {
        const out = stdout.trim()
        if (out) {
          try {
            const parsed = JSON.parse(out) as unknown
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const obj = parsed as Record<string, unknown>
              if (obj.ok === false && typeof obj.error === 'string' && obj.error.trim()) {
                resolve({ ok: false, error: obj.error.trim() })
                return
              }
            }
          } catch {
            void 0
          }
        }
        const msg = stderr.trim() || out || `YouTube conversion failed (exit ${code ?? 'unknown'})`
        resolve({ ok: false, error: msg })
        return
      }

      const out = stdout.trim()
      if (!out) {
        resolve({ ok: false, error: 'YouTube conversion returned empty output' })
        return
      }

      try {
        const parsed = JSON.parse(out) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          resolve({ ok: false, error: 'YouTube conversion returned invalid JSON' })
          return
        }
        const obj = parsed as Record<string, unknown>
        if (obj.ok !== true) {
          const err = typeof obj.error === 'string' && obj.error.trim() ? obj.error.trim() : 'YouTube conversion failed'
          resolve({ ok: false, error: err })
          return
        }
        const markdown = typeof obj.markdown === 'string' ? obj.markdown : ''
        const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'youtube-transcript.md'
        const transcript: Record<string, unknown> = { ...obj }
        delete transcript.markdown
        delete transcript.name
        resolve({ ok: true, markdown, name, transcript })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'YouTube conversion JSON parse error'
        resolve({ ok: false, error: msg })
      }
    })
  })
}

function createYoutubeConvertHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    try {
      const parsed = new URL(req.url || '', `http://${req.headers.host}`)
      const urlParam = parsed.searchParams.get('url') || undefined
      const langParam = parsed.searchParams.get('lang') || undefined
      
      if (!urlParam) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Missing url parameter' }))
          return
      }

      const payload = await runKnowgrphParserConvertYoutubeToPayload({
        url: unwrapUserProvidedText(urlParam) || urlParam,
        lang: langParam || undefined,
      })
      res.statusCode = payload.ok ? 200 : 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
    } catch (error) {
       res.statusCode = 500
       res.setHeader('Content-Type', 'application/json')
       res.end(JSON.stringify({ ok: false, error: String(error) }))
    }
  }
}

const youtubeConvertDevPlugin = {
  name: 'knowgrph-youtube-convert-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__youtube_transcript', createYoutubeConvertHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/__youtube_transcript', createYoutubeConvertHandler())
  },
}

export default defineConfig(({ command }) => ({
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  optimizeDeps: {
    include: ['highlight.js', 'dayjs', 'mermaid', 'maplibre-gl', 'dagre', 'elkjs', 'cesium'],
    exclude: ['gympgrph', 'curagrph', 'grph-shared'],
  },
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          d3: ['d3'],
          three: ['three', '@react-three/fiber'],
          ui: ['lucide-react', 'zustand'],
        },
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', 'highlight.js', 'dayjs', 'mermaid', 'maplibre-gl', 'cesium'],
    alias: [
      { find: 'react/jsx-runtime', replacement: resolvedReactJsxRuntime },
      { find: 'react/jsx-dev-runtime', replacement: resolvedReactJsxDevRuntime },
      { find: /^react$/, replacement: resolvedReact },
      { find: 'react-dom/client', replacement: resolvedReactDomClient },
      { find: /^react-dom$/, replacement: resolvedReactDom },
      {
        find: /^grph-shared\/markdown\/mermaidBlocks$/,
        replacement: path.resolve(__dirname, '../grph-shared/dist/markdown/mermaidBlocks.js'),
      },
      {
        find: /^grph-shared\/markdown\/documentPath$/,
        replacement: path.resolve(__dirname, '../grph-shared/dist/markdown/documentPath.js'),
      },
      {
        find: /^grph-shared\/ui\/panelTypography$/,
        replacement: path.resolve(__dirname, '../grph-shared/dist/ui/panelTypography.js'),
      },
      {
        find: /^grph-shared\/ui\/tailwindTextSize$/,
        replacement: path.resolve(__dirname, '../grph-shared/dist/ui/tailwindTextSize.js'),
      },
      {
        find: /^grph-shared\/collision\/boxCollision$/,
        replacement: path.resolve(__dirname, '../grph-shared/dist/collision/boxCollision.js'),
      },
      { find: /^gympgrph$/, replacement: path.resolve(__dirname, '../../gympgrph/src/index.ts') },
      { find: /^gympgrph\/datasets$/, replacement: path.resolve(__dirname, '../../gympgrph/src/geospatialDatasets.ts') },
      { find: /^gympgrph\/datasets-ui$/, replacement: path.resolve(__dirname, '../../gympgrph/src/geospatialDatasetsUi.ts') },
      { find: /^gympgrph\/testkit$/, replacement: path.resolve(__dirname, '../../gympgrph/src/testkit.ts') },
      { find: /^curagrph$/, replacement: path.resolve(__dirname, '../../curagrph/src/index.ts') },
      { find: /^curagrph\/components\/(.*)$/, replacement: path.resolve(__dirname, '../../curagrph/src/components/$1') },
      { find: /^curagrph\/features\/(.*)$/, replacement: path.resolve(__dirname, '../../curagrph/src/features/$1') },
      {
        find: /^@\/components\/BottomPanel\/BottomPanelMarkdownSection$/,
        replacement: path.resolve(__dirname, './src/components/BottomPanel/BottomPanelMarkdownSection.tsx'),
      },
      {
        find: /^@\/components\/BottomPanel\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/components/BottomPanel/$1'),
      },
      {
        find: /^@\/features\/graph-data-table\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/features/graph-data-table/$1'),
      },
      {
        find: /^@\/features\/markdown\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/features/markdown/$1'),
      },
      {
        find: /^@\/features\/json\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/features/json/$1'),
      },
      {
        find: /^@\/features\/panels\/views\/preview-panel\/ui\/(.*)$/,
        replacement: path.resolve(
          __dirname,
          './node_modules/curagrph/src/features/panels/views/preview-panel/ui/$1',
        ),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ]
  },
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../../gympgrph'),
        path.resolve(__dirname, '../../curagrph'),
        path.resolve(__dirname, '../../grph'),
        path.resolve(__dirname, '../../sandbox'),
      ]
    }
  },
  plugins: [
    react(),
    cesiumAssetsPlugin,
    ...(command === 'build'
      ? []
      : [
          traeBadgePlugin({
            variant: 'dark',
            position: 'bottom-right',
            prodOnly: true,
            clickable: true,
            clickUrl: process.env.VITE_TRAE_BADGE_URL || 'https://www.trae.ai/solo?showJoin=1',
            autoTheme: true,
            autoThemeTarget: '#root',
          }),
          markdownPipelineDevPlugin,
          remoteFetchProxyDevPlugin,
          webpageProxyDevPlugin,
          localGeoDatasetDevPlugin,
          pdfConvertDevPlugin,
          pdfWorkspaceDevPlugin,
          websiteImportDevPlugin,
          youtubeConvertDevPlugin,
        ]),
    tsconfigPaths(),
  ],
}))
