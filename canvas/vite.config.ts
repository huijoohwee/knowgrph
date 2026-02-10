import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { CODEBASE_INDEX_PIPELINE_COMMAND } from './src/lib/config-copy/tooltips'
import { unwrapUserProvidedText } from './src/lib/url'
import { createPdfAssetsHandler, createPdfConvertHandler } from './src/lib/pdf/server/pdfConvertServer'
import { createPdfWorkspaceHandler } from './src/lib/pdf/server/pdfWorkspaceServer'

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

function resolvePythonBin(): string {
  const fromEnv = String(process.env.KNOWGRPH_PYTHON_BIN || '').trim()
  if (fromEnv) return fromEnv
  const candidates = [
    'python3',
    path.join(repoRoot, '.venv', 'bin', 'python3'),
    path.join(repoRoot, '.venv', 'bin', 'python'),
    path.join(repoRoot, 'venv', 'bin', 'python3'),
    path.join(repoRoot, 'venv', 'bin', 'python'),
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
  ]
  const canUse = (candidate: string) => {
    if (candidate !== 'python3' && !existsSync(candidate)) return false
    const probe = spawnSync(
      candidate,
      ['-c', 'import knowgrph_parser'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 2_000, env: withRepoPythonPath(process.env) },
    )
    return probe.status === 0
  }
  for (const candidate of candidates) {
    try {
      if (canUse(candidate)) return candidate
    } catch {
      void 0
    }
  }
  return 'python3'
}

const pythonBin = resolvePythonBin()

function runMarkdownPipelineOnce(): Promise<void> {
  const parts = CODEBASE_INDEX_PIPELINE_COMMAND.split(/\s+/).filter(Boolean)
  const cmd = parts[0] === 'python' ? pythonBin : parts[0]
  const args = parts.slice(1)
  return new Promise((resolve, reject) => {
    const result = spawnSync(cmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: withRepoPythonPath(process.env),
    })
    if (result.error) {
      reject(result.error)
      return
    }
    if (result.status === 0) {
      resolve()
      return
    }
    reject(new Error(`Markdown pipeline exited with code ${result.status ?? 'unknown'}`))
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
    if (!urlParam || !/^https?:\/\//i.test(urlParam)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid url parameter')
      return
    }

    let controller: AbortController | null = null
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
      req.on('close', abort)
      res.on('close', abort)

      const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
      const upstream = await (async () => {
        try {
          return await fetch(urlParam, {
            method: req.method,
            redirect: 'follow',
            signal: ctrl.signal,
            headers: {
              Accept: '*/*',
            },
          })
        } finally {
          clearTimeout(timeoutId)
        }
      })()

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
      try {
        res.setHeader('Content-Length', String(buf.byteLength))
      } catch {
        void 0
      }
      res.end(buf)
      finished = true
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
  try {
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
    const res = spawnSync(pythonBin, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeoutMs,
      env: withRepoPythonPath(process.env),
    })
    if (res.error) {
      const msg =
        typeof (res.error as { message?: unknown } | null)?.message === 'string'
          ? String((res.error as { message?: unknown }).message || '')
          : ''
      return { ok: false, error: msg || 'YouTube conversion failed' }
    }
    if (res.status !== 0) {
      const stderr = typeof res.stderr === 'string' ? res.stderr.trim() : ''
      const stdout = typeof res.stdout === 'string' ? res.stdout.trim() : ''
      if (stdout) {
        try {
          const parsed = JSON.parse(stdout) as unknown
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const obj = parsed as Record<string, unknown>
            if (obj.ok === false && typeof obj.error === 'string' && obj.error.trim()) {
              return { ok: false, error: obj.error.trim() }
            }
          }
        } catch {
          void 0
        }
      }
      const msg = stderr || stdout || `YouTube conversion failed (exit ${res.status ?? 'unknown'})`
      return { ok: false, error: msg }
    }
    const stdout = typeof res.stdout === 'string' ? res.stdout.trim() : ''
    if (!stdout) return { ok: false, error: 'YouTube conversion returned empty output' }
    const parsed = JSON.parse(stdout) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'YouTube conversion returned invalid JSON' }
    }
    const obj = parsed as Record<string, unknown>
    if (obj.ok !== true) {
      const err = typeof obj.error === 'string' && obj.error.trim() ? obj.error.trim() : 'YouTube conversion failed'
      return { ok: false, error: err }
    }
    const markdown = typeof obj.markdown === 'string' ? obj.markdown : ''
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'youtube-transcript.md'
    const transcript: Record<string, unknown> = { ...obj }
    delete transcript.markdown
    delete transcript.name
    return { ok: true, markdown, name, transcript }
  } catch (error) {
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : ''
    return { ok: false, error: msg || 'YouTube conversion failed' }
  }
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
          localGeoDatasetDevPlugin,
          pdfConvertDevPlugin,
          pdfWorkspaceDevPlugin,
          youtubeConvertDevPlugin,
        ]),
    tsconfigPaths(),
  ],
}))
