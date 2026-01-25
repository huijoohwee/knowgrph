import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { CODEBASE_INDEX_PIPELINE_COMMAND } from './src/lib/config-copy/tooltips'
import { unwrapUserProvidedText } from './src/lib/url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

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

type PdfConvertResult = { ok: true; markdown: string; name: string } | { ok: false; error: string }

function derivePdfNameFromUrl(urlParam: string): string {
  try {
    const url = new URL(urlParam)
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    const base = last.replace(/\.pdf$/i, '') || 'document'
    return `${base}.md`
  } catch {
    return 'document.md'
  }
}

function derivePdfTitleFromUrl(urlParam: string): string {
  try {
    const url = new URL(urlParam)
    const parts = url.pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    return last || 'document.pdf'
  } catch {
    return 'document.pdf'
  }
}

async function runKnowgrphParserConvertPdfToMarkdown(opts: {
  pdfPath: string
  assetsDir?: string
  assetUrlPrefix?: string
  title?: string
}): Promise<string | null> {
  try {
    const args = ['-m', 'knowgrph_parser', 'pdf', '--input', opts.pdfPath]
    if (opts.assetsDir && opts.assetsDir.trim()) {
      args.push('--assets-dir', opts.assetsDir.trim())
    }
    if (opts.assetUrlPrefix && opts.assetUrlPrefix.trim()) {
      args.push('--asset-url-prefix', opts.assetUrlPrefix.trim())
    }
    if (opts.title && opts.title.trim()) {
      args.push('--title', opts.title.trim())
    }
    const res = spawnSync(pythonBin, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      env: withRepoPythonPath(process.env),
    })
    if (res.status === 0 && typeof res.stdout === 'string' && res.stdout.trim()) {
      return res.stdout
    }
    return null
  } catch {
    return null
  }
}

type PdfAssetStore = { token: string; assetsDir: string; tmpDir: string; createdAtMs: number }

function createPdfAssetStoreCache() {
  const entries: PdfAssetStore[] = []
  const byToken = new Map<string, PdfAssetStore>()
  const limit = (() => {
    const raw = String(process.env.KNOWGRPH_PDF_ASSET_CACHE_LIMIT || '').trim()
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10
  })()

  const add = (entry: PdfAssetStore) => {
    entries.push(entry)
    byToken.set(entry.token, entry)
    while (entries.length > limit) {
      const evicted = entries.shift()
      if (!evicted) break
      byToken.delete(evicted.token)
      void fs.rm(evicted.tmpDir, { recursive: true, force: true }).catch(() => void 0)
    }
  }

  const get = (token: string) => byToken.get(token)
  return { add, get }
}

const pdfAssetCache = createPdfAssetStoreCache()

async function convertPdfToMarkdown(opts: { url?: string; body?: Buffer; nameHint?: string }): Promise<PdfConvertResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowgrph-pdf-'))
  const pdfPath = path.join(tmpDir, `${randomUUID()}.pdf`)
  const token = randomUUID()
  const assetsDir = path.join(tmpDir, 'assets')
  const cleanup = async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {
      void 0
    }
  }
  try {
    if (opts.body) {
      await fs.writeFile(pdfPath, opts.body)
    } else if (opts.url) {
      const upstream = await fetch(opts.url, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      if (!upstream.ok) {
        return { ok: false, error: `Upstream fetch failed (${upstream.status})` }
      }
      const ab = await upstream.arrayBuffer()
      await fs.writeFile(pdfPath, Buffer.from(ab))
    } else {
      await cleanup()
      return { ok: false, error: 'Missing PDF url or body' }
    }

    const title =
      (opts.nameHint && opts.nameHint.trim()
        ? opts.nameHint.trim()
        : opts.url
          ? derivePdfTitleFromUrl(opts.url)
          : '') || 'document.pdf'
    const assetUrlPrefix = `/__pdf_assets/${token}`
    const markdown = await runKnowgrphParserConvertPdfToMarkdown({
      pdfPath,
      assetsDir,
      assetUrlPrefix,
      title,
    })
    if (!markdown) {
      await cleanup()
      return {
        ok: false,
        error:
          'PDF conversion failed. Ensure the Python parser environment is set up correctly (pip install pypdf).',
      }
    }
    pdfAssetCache.add({ token, assetsDir, tmpDir, createdAtMs: Date.now() })
    const name =
      (opts.nameHint && opts.nameHint.trim() ? opts.nameHint.trim() : opts.url ? derivePdfNameFromUrl(opts.url) : 'document.md') || 'document.md'
    return { ok: true, markdown, name }
  } catch (error) {
    await cleanup()
    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : ''
    return { ok: false, error: msg || 'PDF conversion failed' }
  }
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

function createPdfConvertHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    try {
      const parsed = new URL(req.url || '', `http://${req.headers.host}`)
      const urlParam = parsed.searchParams.get('url') || undefined
      const nameHintHeader =
        typeof req.headers['x-import-filename'] === 'string'
          ? req.headers['x-import-filename']
          : undefined
      const contentType =
        typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''

      const body = await (async (): Promise<Buffer | null> => {
        if (!contentType.toLowerCase().startsWith('application/pdf')) return null
        return await new Promise((resolve, reject) => {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => resolve(Buffer.concat(chunks)))
          req.on('error', reject)
        })
      })()

      const result = await convertPdfToMarkdown({
        url: urlParam,
        body: body || undefined,
        nameHint: nameHintHeader,
      })
      res.statusCode = result.ok ? 200 : 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (error) {
      let message = 'PDF conversion failed'
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
  }
}

function createPdfAssetsHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const parts = url.pathname.split('/').filter(Boolean)
      const token = parts[0] || ''
      const file = parts.slice(1).join('/')
      if (!token || !file || file.includes('..') || file.includes('\\')) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Invalid asset path')
        return
      }
      const entry = pdfAssetCache.get(token)
      if (!entry) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Asset not found')
        return
      }
      const resolved = path.resolve(entry.assetsDir, file)
      const within = resolved.startsWith(path.resolve(entry.assetsDir) + path.sep)
      if (!within) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Forbidden')
        return
      }
      const ext = path.extname(resolved).toLowerCase()
      const contentType =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.webp'
                ? 'image/webp'
                : 'application/octet-stream'
      const buf = await fs.readFile(resolved)
      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.end(buf)
    } catch {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Asset not found')
    }
  }
}

function createRemoteFetchHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
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
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      const upstream = await (async () => {
        try {
          return await fetch(urlParam, {
            method: req.method,
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              Accept: '*/*',
            },
          })
        } finally {
          clearTimeout(timeoutId)
        }
      })()
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
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : 'Upstream fetch failed'
      const message = msg || 'Upstream fetch failed'
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
  optimizeDeps: {
    include: ['highlight.js', 'dayjs', 'mermaid'],
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
    dedupe: ['react', 'react-dom', 'highlight.js', 'dayjs', 'mermaid'],
    alias: [
      {
        find: /^@\/components\/BottomPanel\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/components/BottomPanel/$1'),
      },
      {
        find: /^@\/features\/graph-data-table\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/features/graph-data-table/$1'),
      },
      {
        find: /^@\/features\/json\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/features/json/$1'),
      },
      {
        find: /^@\/features\/markdown\/(.*)$/,
        replacement: path.resolve(__dirname, './node_modules/curagrph/src/features/markdown/$1'),
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
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  },
  plugins: [
    react(),
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
          pdfConvertDevPlugin,
          youtubeConvertDevPlugin,
        ]),
    tsconfigPaths(),
  ],
}))
