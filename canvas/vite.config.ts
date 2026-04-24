import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { unwrapUserProvidedText } from 'grph-shared/url'
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
const resolvedThreeSrc = nodeRequire.resolve('three/src/Three.js')
const resolvedMaplibreEntry = nodeRequire.resolve('maplibre-gl')
const resolvedGympgrphSrc = path.resolve(__dirname, '../gympgrph/src/index.ts')
const resolvedGympgrphMapPreviewSrc = path.resolve(__dirname, '../gympgrph/src/mapPreview.ts')
const resolvedGympgrphTestkitSrc = path.resolve(__dirname, '../gympgrph/src/testkit.ts')

const MARKDOWN_PIPELINE_INPUT_REL_PATH =
  String(process.env.VITE_MARKDOWN_PIPELINE_INPUT_REL_PATH || '').trim() || 'docs/knowgrph-pipeline-document.md'
const CODEBASE_INDEX_PIPELINE_OUTPUT_DIR =
  String(process.env.VITE_MARKDOWN_PIPELINE_OUTPUT_DIR || '').trim() || 'data/knowgrph-workflow-preview'
const CODEBASE_INDEX_PIPELINE_COMMAND = `python -m knowgrph_parser markdown --input ${MARKDOWN_PIPELINE_INPUT_REL_PATH} --output-dir ${CODEBASE_INDEX_PIPELINE_OUTPUT_DIR}`
const CHAT_PROXY_PREFIX = '/__chat_proxy'
const CHAT_BINARY_DOWNLOAD_PROXY_PREFIX = '/__chat_asset_proxy'
const CHAT_LOG_APPEND_PATH = '/__chat_log_append'
const KG_FS_WRITE_PATH = '/__kg_fs_write'
const GRABMAPS_PROXY_PREFIX = '/__grabmaps_proxy'
const CHAT_PROXY_OPENAI_HOST = 'api.openai.com'
const CHAT_PROXY_BYTEPLUS_AP_SOUTHEAST_HOST = 'ark.ap-southeast.bytepluses.com'
const CHAT_PROXY_BYTEPLUS_EU_WEST_HOST = 'ark.eu-west.bytepluses.com'
const CHAT_PROXY_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const CHAT_PROXY_BYTEPLUS_HOSTS = new Set([CHAT_PROXY_BYTEPLUS_AP_SOUTHEAST_HOST, CHAT_PROXY_BYTEPLUS_EU_WEST_HOST])
const CHAT_LOG_MAX_BODY_BYTES = 1024 * 1024
const CHAT_LOG_MAX_FIELD_LENGTH = 20_000
const STRIPE_CHECKOUT_SESSION_CREATE_PATH = '/__stripe_checkout_session'
const STRIPE_MAX_REQUEST_BYTES = 16 * 1024
const chatLogsDir = path.resolve(repoRoot, 'logs')

const normalizeHost = (value: unknown): string => String(value || '').trim().toLowerCase()

const readSingleHeader = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const isLocalChatUpstreamHost = (value: unknown): boolean => CHAT_PROXY_LOCAL_HOSTS.has(normalizeHost(value))

const isBytePlusChatUpstreamHost = (value: unknown): boolean => CHAT_PROXY_BYTEPLUS_HOSTS.has(normalizeHost(value))

const parseAllowedChatProxyHosts = (): Set<string> => {
  const envValue = String(process.env.KNOWGRPH_CHAT_PROXY_ALLOWED_HOSTS || '').trim()
  if (!envValue) return new Set([...CHAT_PROXY_LOCAL_HOSTS, CHAT_PROXY_OPENAI_HOST, ...CHAT_PROXY_BYTEPLUS_HOSTS])
  const out = new Set<string>()
  envValue
    .split(',')
    .map(part => normalizeHost(part))
    .filter(Boolean)
    .forEach(host => out.add(host))
  if (!out.size) return new Set([...CHAT_PROXY_LOCAL_HOSTS, CHAT_PROXY_OPENAI_HOST, ...CHAT_PROXY_BYTEPLUS_HOSTS])
  return out
}

const toLogSafeText = (value: unknown): string => {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, CHAT_LOG_MAX_FIELD_LENGTH)
}

const toLogSafeInline = (value: unknown): string => {
  return toLogSafeText(value).replace(/\n/g, ' ').replace(/\|/g, '\\|')
}

const toChatLogFileName = (timestampMs: number): string => {
  const date = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `logs_${yyyy}${mm}${dd}${hh}${min}.md`
}

const getGrabMapsBearerToken = (kind: 'api' | 'mcp'): string => {
  const candidates = kind === 'mcp'
    ? [
      process.env.KNOWGRPH_GRABMAPS_MCP_TOKEN,
      process.env.GRABMAPS_MCP_TOKEN,
      process.env.GRABMAPS_TOKEN,
    ]
    : [
      process.env.KNOWGRPH_GRABMAPS_API_TOKEN,
      process.env.GRABMAPS_API_TOKEN,
      process.env.GRABMAPS_TOKEN,
    ]
  for (const raw of candidates) {
    const key = String(raw || '').trim()
    if (key) return key
  }
  return ''
}

const stripEntitiesBadSourcemapsPlugin = {
  name: 'knowgrph-strip-entities-bad-sourcemaps',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id) return null
    if (!id.includes('/entities/lib/esm/')) return null
    if (!id.endsWith('.js')) return null
    const next = code.replace(/^\/\/# sourceMappingURL=.*\n?/gm, '')
    return next === code ? null : next
  },
}

const stripMermaidArchitectureDetectorPlugin = {
  name: 'knowgrph-strip-mermaid-architecture-detector',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id) return null
    if (!id.replace(/\\/g, '/').endsWith('/mermaid/dist/mermaid.core.mjs')) return null
    let next = code
    next = next.replace(
      'registerLazyLoadedDiagrams(detector_default, detector_default3, architectureDetector_default);',
      'registerLazyLoadedDiagrams(detector_default, detector_default3);',
    )
    return next === code ? null : next
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

const readJsonRequestBody = async <T>(req: import('node:http').IncomingMessage, maxBytes: number): Promise<T> => {
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > maxBytes) {
        reject(new Error('Payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', err => reject(err))
  })
  return JSON.parse(body.toString('utf8')) as T
}

const writeJsonResponse = (res: import('node:http').ServerResponse, statusCode: number, body: unknown): void => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

const getStripeCheckoutServerKey = (): string => {
  const restrictedKey = String(process.env.STRIPE_RESTRICTED_KEY || '').trim()
  if (restrictedKey.startsWith('rk_')) return restrictedKey
  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
  if (secretKey.startsWith('sk_')) return secretKey
  return ''
}

async function createStripeCheckoutSessionServer(args: {
  successUrl: string
  cancelUrl: string
}): Promise<{ id: string; url: string }> {
  const apiKey = getStripeCheckoutServerKey()
  if (!apiKey) {
    throw new Error('Missing server-managed Stripe key. Set STRIPE_RESTRICTED_KEY (recommended) or STRIPE_SECRET_KEY on the dev/preview server.')
  }

  const body = new URLSearchParams({
    mode: 'payment',
    success_url: String(args.successUrl || '').trim(),
    cancel_url: String(args.cancelUrl || '').trim(),
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][product_data][name]': 'Knowgrph Paywall',
    'line_items[0][price_data][unit_amount]': '100',
    'line_items[0][quantity]': '1',
  })

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json = await response.json().catch(() => null) as {
    id?: unknown
    url?: unknown
    error?: { message?: unknown } | null
  } | null
  if (!response.ok) {
    const message = typeof json?.error?.message === 'string' && json.error.message.trim()
      ? json.error.message.trim()
      : `Stripe Checkout Session create failed (HTTP ${response.status}).`
    throw new Error(message)
  }

  const id = typeof json?.id === 'string' ? json.id.trim() : ''
  const url = typeof json?.url === 'string' ? json.url.trim() : ''
  if (!id || !url) throw new Error('Stripe response missing Checkout Session url.')
  return { id, url }
}

function createStripeCheckoutDevHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    try {
      const payload = await readJsonRequestBody<{ successUrl?: unknown; cancelUrl?: unknown }>(req, STRIPE_MAX_REQUEST_BYTES)
      const successUrl = String(payload?.successUrl || '').trim()
      const cancelUrl = String(payload?.cancelUrl || '').trim()
      if (!successUrl || !cancelUrl) {
        writeJsonResponse(res, 400, { ok: false, error: 'Missing Checkout Session success_url or cancel_url.' })
        return
      }
      const created = await createStripeCheckoutSessionServer({ successUrl, cancelUrl })
      writeJsonResponse(res, 200, { ok: true, id: created.id, url: created.url })
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Failed to create Stripe Checkout Session.'
      writeJsonResponse(res, 500, { ok: false, error: message })
    }
  }
}

const stripeCheckoutDevPlugin = {
  name: 'knowgrph-stripe-checkout-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(STRIPE_CHECKOUT_SESSION_CREATE_PATH, createStripeCheckoutDevHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(STRIPE_CHECKOUT_SESSION_CREATE_PATH, createStripeCheckoutDevHandler())
  },
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

function resolveHackamapBipartiteFixturePath(): string | null {
  const fromEnv =
    String(process.env.KNOWGRPH_BIPARTITE_FIXTURE_PATH || '').trim() ||
    String(process.env.VITE_KNOWGRPH_BIPARTITE_FIXTURE_PATH || '').trim()

  const candidates = [
    fromEnv,
    path.resolve(repoRoot, '..', 'huijoohwee', 'content', 'hackamap', 'hackamap-df-06-d3-snippet.json'),
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      if (p && existsSync(p)) return p
    } catch {
      void 0
    }
  }
  return null
}

function resolveHackamapGraphPath(): string | null {
  const fromEnv =
    String(process.env.KNOWGRPH_HACKAMAP_GRAPH_PATH || '').trim() ||
    String(process.env.VITE_KNOWGRPH_HACKAMAP_GRAPH_PATH || '').trim()
  const candidates = [
    fromEnv,
    path.resolve(repoRoot, '..', 'huijoohwee', 'content', 'knowgrph', 'imports', 'hackamap', 'hackamap-graph.json'),
    path.resolve(repoRoot, '..', 'project', 'prjt4000-hackamap', 'site', 'hackamap-graph.json'),
  ].filter(Boolean)
  for (const p of candidates) {
    try {
      if (p && existsSync(p)) return p
    } catch {
      void 0
    }
  }
  return null
}

function resolveHackamapApiGraphPath(): string | null {
  const fromEnv =
    String(process.env.KNOWGRPH_HACKAMAP_API_GRAPH_PATH || '').trim() ||
    String(process.env.VITE_KNOWGRPH_HACKAMAP_API_GRAPH_PATH || '').trim()
  const candidates = [
    fromEnv,
    path.resolve(repoRoot, '..', 'huijoohwee', 'content', 'knowgrph', 'imports', 'hackamap', 'hackamap_api_graph.json'),
    path.resolve(repoRoot, '..', 'project', 'prjt4000-hackamap', 'site', '_generated', 'api-graph', 'hackamap_api_graph.json'),
  ].filter(Boolean)
  for (const p of candidates) {
    try {
      if (p && existsSync(p)) return p
    } catch {
      void 0
    }
  }
  return null
}

function resolveHackamapPipelinePath(): string | null {
  const candidates = [
    path.resolve(repoRoot, '..', 'project', 'prjt4000-hackamap', 'site', 'hackamap-pipeline.json'),
    path.resolve(repoRoot, '..', 'huijoohwee', 'content', 'knowgrph', 'imports', 'hackamap', 'hackamap_pipeline.json'),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch {
      void 0
    }
  }
  return null
}

function resolveHackamapQueryPresetsPath(): string | null {
  const candidates = [
    path.resolve(repoRoot, '..', 'project', 'prjt4000-hackamap', 'site', 'hackamap-query-presets.json'),
    path.resolve(repoRoot, '..', 'huijoohwee', 'content', 'knowgrph', 'imports', 'hackamap', 'hackamap_query_presets.json'),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch {
      void 0
    }
  }
  return null
}

function resolveHackamapQueryRunsManifestPath(): string | null {
  const candidates = [
    path.resolve(repoRoot, '..', 'project', 'prjt4000-hackamap', 'site', '_generated', 'query-outputs', 'query-runs.manifest.json'),
    path.resolve(repoRoot, '..', 'huijoohwee', 'content', 'knowgrph', 'imports', 'hackamap', 'query-outputs', 'query-runs.manifest.json'),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p
    } catch {
      void 0
    }
  }
  return null
}

async function readJsonFileIfExists(p: string | null): Promise<unknown | null> {
  if (!p) return null
  try {
    const raw = await fs.readFile(p, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function buildHackamapTablePrefix(presetEntry: any, runEntry: any): string {
  const basePrefix = String(presetEntry?.output?.per_table_prefix || presetEntry?.id || runEntry?.preset || '').trim()
  const suffix = String(runEntry?.output_suffix || '').trim()
  return suffix ? `${basePrefix}-${suffix}` : basePrefix
}

function collectRowIds(rows: unknown, key: string): string[] {
  if (!Array.isArray(rows)) return []
  const out: string[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const value = String((row as Record<string, unknown>)[key] || '').trim()
    if (value) out.push(value)
  }
  return out
}

async function countHackamapQueryRows(p: string): Promise<number> {
  const parsed = await readJsonFileIfExists(p)
  return Array.isArray(parsed) ? parsed.length : 0
}

async function readHackamapRunTableCounts(queryOutputsDir: string | null, presetEntry: any, runEntry: any): Promise<Record<string, number>> {
  if (!queryOutputsDir) return {}
  const tablePrefix = buildHackamapTablePrefix(presetEntry, runEntry)
  if (!tablePrefix) return {}
  const tableFiles = ['events', 'demos', 'sources', 'organizer', 'team', 'techstack']
  const counts = await Promise.all(
    tableFiles.map(async tableFile => [tableFile, await countHackamapQueryRows(path.join(queryOutputsDir, `${tableFile}.${tablePrefix}.query.json`))] as const),
  )
  return Object.fromEntries(counts.filter(([, count]) => count > 0))
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObjectKeys(nested)]),
  )
}

function stableParamSignature(value: unknown): string {
  try {
    return JSON.stringify(sortObjectKeys(value))
  } catch {
    return ''
  }
}

function toBuilderOption(value: unknown): { value: unknown; label: string } {
  if (typeof value === 'string') return { value, label: value }
  return { value, label: JSON.stringify(value) }
}

function buildHackamapPresetRuntimeEntries(presets: any[], runs: any[]): any[] {
  return presets
    .map((entry: any) => {
      const presetId = String(entry?.id || '').trim()
      if (!presetId) return null
      const defaults = entry?.params && typeof entry.params === 'object' && !Array.isArray(entry.params) ? entry.params : {}
      const relatedRuns = runs.filter((run: any) => String(run?.preset || '').trim() === presetId)
      const paramKeys = Array.from(
        new Set<string>([
          ...Object.keys(defaults),
          ...relatedRuns.flatMap((run: any) =>
            run?.params && typeof run.params === 'object' && !Array.isArray(run.params) ? Object.keys(run.params) : [],
          ),
        ]),
      ).sort((left, right) => left.localeCompare(right))
      const publishedParamOptions = Object.fromEntries(
        paramKeys.map(key => {
          const seen = new Set<string>()
          const options: Array<{ value: unknown; label: string }> = []
          const values = [
            defaults[key],
            ...relatedRuns.map((run: any) =>
              run?.params && typeof run.params === 'object' && !Array.isArray(run.params) ? run.params[key] : undefined,
            ),
          ]
          for (const candidate of values) {
            if (typeof candidate === 'undefined') continue
            const signature = stableParamSignature(candidate)
            if (!signature || seen.has(signature)) continue
            seen.add(signature)
            options.push(toBuilderOption(candidate))
          }
          return [key, options]
        }),
      )
      return {
        id: presetId,
        title: String(entry?.title || presetId).trim(),
        params: defaults,
        param_keys: paramKeys,
        published_param_options: publishedParamOptions,
      }
    })
    .filter(Boolean)
}

async function readHackamapRuntimeMeta(): Promise<any> {
  const pipeline = ((await readJsonFileIfExists(resolveHackamapPipelinePath())) || {}) as any
  const presetsRaw = await readJsonFileIfExists(resolveHackamapQueryPresetsPath())
  const runsManifest = ((await readJsonFileIfExists(resolveHackamapQueryRunsManifestPath())) || {}) as any
  const presets = Array.isArray(presetsRaw) ? presetsRaw.filter(Boolean) : []
  const runtime = pipeline && typeof pipeline === 'object' ? (pipeline.runtime || {}) : {}
  const defaultRunId = String(runtime?.query_selection?.default_run_id || '').trim() || 'enhanced'
  const manifestPath = resolveHackamapQueryRunsManifestPath()
  const queryOutputsDir = manifestPath ? path.dirname(manifestPath) : null
  const runsRaw = Array.isArray(runsManifest?.runs) ? runsManifest.runs : []
  const runs = (
    await Promise.all(
      runsRaw.map(async (entry: any) => {
        const id = String(entry?.id || '').trim()
        const presetId = String(entry?.preset || '').trim()
        if (!id) return null
        const presetEntry = presets.find((preset: any) => String(preset?.id || '').trim() === presetId)
        const table_counts = await readHackamapRunTableCounts(queryOutputsDir, presetEntry, entry)
        return {
          id,
          preset: presetId,
          title: String(entry?.title || entry?.id || '').trim(),
          params: entry?.params && typeof entry.params === 'object' && !Array.isArray(entry.params) ? entry.params : {},
          output_suffix: String(entry?.output_suffix || '').trim(),
          is_default: id === defaultRunId,
          table_counts,
        }
      }),
    )
  ).filter((entry: any) => entry?.id)
  return {
    ok: true,
    runtime: {
      ...(runtime && typeof runtime === 'object' ? runtime : {}),
      presets: buildHackamapPresetRuntimeEntries(presets, runs),
      runs,
    },
  }
}

async function readHackamapQueryRunSelection(runId: string): Promise<{ eventIds: Set<string>; demoIds: Set<string> } | null> {
  const normalizedRunId = String(runId || '').trim()
  if (!normalizedRunId) return null
  const manifestPath = resolveHackamapQueryRunsManifestPath()
  const queryOutputsDir = manifestPath ? path.dirname(manifestPath) : null
  const runsManifest = ((await readJsonFileIfExists(manifestPath)) || {}) as any
  const presetsRaw = await readJsonFileIfExists(resolveHackamapQueryPresetsPath())
  const runs = Array.isArray(runsManifest?.runs) ? runsManifest.runs : []
  const presets = Array.isArray(presetsRaw) ? presetsRaw : []
  const runEntry = runs.find((entry: any) => String(entry?.id || '').trim() === normalizedRunId)
  if (!runEntry || !queryOutputsDir) return null
  const presetEntry = presets.find((entry: any) => String(entry?.id || '').trim() === String(runEntry?.preset || '').trim())
  const tablePrefix = buildHackamapTablePrefix(presetEntry, runEntry)
  if (!tablePrefix) return null
  const eventsJson = await readJsonFileIfExists(path.join(queryOutputsDir, `events.${tablePrefix}.query.json`))
  const demosJson = await readJsonFileIfExists(path.join(queryOutputsDir, `demos.${tablePrefix}.query.json`))
  const eventIds = new Set<string>(collectRowIds(eventsJson, 'id'))
  const demoIds = new Set<string>(collectRowIds(demosJson, 'id'))
  const demoEventIds = collectRowIds(demosJson, 'event_id')
  for (const id of demoEventIds) eventIds.add(id)
  return { eventIds, demoIds }
}

function filterHackamapApiGraphPayloadByRun(payload: any, runId: string, selection: { eventIds: Set<string>; demoIds: Set<string> } | null): any {
  if (!selection || !isApiGraphPayload(payload)) return payload
  if (selection.eventIds.size === 0 && selection.demoIds.size === 0) {
    return {
      ...payload,
      meta: {
        ...((payload as any)?.meta && typeof (payload as any).meta === 'object' ? (payload as any).meta : {}),
        selected_run_id: runId,
        selected_run_filter_skipped: 'no-event-demo-rows',
      },
    }
  }
  const keep = new Set<string>()
  selection.eventIds.forEach(id => keep.add(`Event:${id}`))
  selection.demoIds.forEach(id => keep.add(`Demo:${id}`))
  const nodes = Array.isArray(payload.nodes)
    ? payload.nodes.filter((node: any) => keep.has(String(node?.id || '').trim()))
    : []
  const keepIds = new Set<string>(nodes.map((node: any) => String(node?.id || '').trim()).filter(Boolean))
  const edges = Array.isArray(payload.edges)
    ? payload.edges.filter((edge: any) => keepIds.has(String(edge?.source || '').trim()) && keepIds.has(String(edge?.target || '').trim()))
    : []
  return {
    ...payload,
    nodes,
    edges,
    meta: {
      ...((payload as any)?.meta && typeof (payload as any).meta === 'object' ? (payload as any).meta : {}),
      selected_run_id: runId,
      selected_event_count: selection.eventIds.size,
      selected_demo_count: selection.demoIds.size,
      total_problems: nodes.filter((node: any) => String(node?.type || '').trim() === 'problem').length,
      total_solutions: nodes.filter((node: any) => String(node?.type || '').trim() === 'solution').length,
    },
  }
}

function isApiGraphPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return Array.isArray(obj.nodes) && Array.isArray(obj.edges)
}

async function readHackamapApiGraphPayload(): Promise<unknown | null> {
  const p = resolveHackamapApiGraphPath()
  if (!p) return null
  const raw = await fs.readFile(p, 'utf8')
  const parsed = JSON.parse(raw)
  return isApiGraphPayload(parsed) ? parsed : null
}

async function readHackamapGraphAsBipartiteApiPayload(runId: string = ''): Promise<unknown> {
  const precomputed = await readHackamapApiGraphPayload()
  if (precomputed) {
    const selection = await readHackamapQueryRunSelection(runId)
    return filterHackamapApiGraphPayloadByRun(precomputed, runId, selection)
  }
  const p = resolveHackamapGraphPath()
  if (!p) return { nodes: [], edges: [], meta: { source: 'hackamap-graph:fallback' } }
  const raw = await fs.readFile(p, 'utf8')
  const parsed = JSON.parse(raw)
  const nodesRaw = Array.isArray((parsed as any)?.nodes) ? ((parsed as any).nodes as any[]) : []
  const linksRaw = Array.isArray((parsed as any)?.links) ? ((parsed as any).links as any[]) : []
  const nodes: any[] = []
  const keep = new Set<string>()
  for (const n of nodesRaw) {
    const id = String(n?.id || '').trim()
    const type = String(n?.type || '').trim()
    const label = String(n?.label || '').trim()
    if (!id || !type || !label) continue
    if (type === 'Event') {
      nodes.push({ id, type: 'problem', label, cluster: 'Event' })
      keep.add(id)
    } else if (type === 'Demo') {
      nodes.push({ id, type: 'solution', label, cluster: 'Demo' })
      keep.add(id)
    }
  }
  const edges: any[] = []
  for (const e of linksRaw) {
    const source = String(e?.source || '').trim()
    const target = String(e?.target || '').trim()
    const t = String(e?.type || '').trim()
    if (!source || !target) continue
    if (t !== 'has_demo') continue
    if (!keep.has(source) || !keep.has(target)) continue
    edges.push({ source, target, type: 'has_demo', strength: 0.35 })
  }
  const meta = (parsed as any)?.meta && typeof (parsed as any).meta === 'object' ? (parsed as any).meta : {}
  const payload = {
    nodes,
    edges,
    meta: {
      ...(meta?.content_signature ? { content_signature: String(meta.content_signature) } : {}),
      source: 'hackamap-graph.json:fallback',
      total_problems: nodes.filter(n => n.type === 'problem').length,
      total_solutions: nodes.filter(n => n.type === 'solution').length,
    },
  }
  const selection = await readHackamapQueryRunSelection(runId)
  return filterHackamapApiGraphPayloadByRun(payload, runId, selection)
}

const apiGraphDevPlugin = {
  name: 'knowgrph-api-graph-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/graph', async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      try {
        const url = new URL(req.url || '/api/graph', 'http://localhost')
        const view = String(url.searchParams.get('view') || '').trim().toLowerCase()
        const runId = String(url.searchParams.get('run') || '').trim()
        const payload = view === 'meta' ? await readHackamapRuntimeMeta() : await readHackamapGraphAsBipartiteApiPayload(runId)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        res.end(JSON.stringify(payload))
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ ok: false, error: 'Failed to serve /api/graph' }))
      }
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/api/graph', async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      try {
        const url = new URL(req.url || '/api/graph', 'http://localhost')
        const view = String(url.searchParams.get('view') || '').trim().toLowerCase()
        const runId = String(url.searchParams.get('run') || '').trim()
        const payload = view === 'meta' ? await readHackamapRuntimeMeta() : await readHackamapGraphAsBipartiteApiPayload(runId)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        res.end(JSON.stringify(payload))
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ ok: false, error: 'Failed to serve /api/graph' }))
      }
    })
  },
}

const bipartiteFixtureDevPlugin = {
  name: 'knowgrph-bipartite-fixture-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__bipartite_fixture', async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      const fixturePath = resolveHackamapBipartiteFixturePath()
      if (!fixturePath) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ problems: [], solutions: [], metadata: { source: '__bipartite_fixture:fallback' } }))
        return
      }

      try {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        const stream = createReadStream(fixturePath)
        stream.on('error', () => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Failed to read fixture file' }))
        })
        stream.pipe(res)
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Failed to serve fixture file' }))
      }
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/__bipartite_fixture', async (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      const fixturePath = resolveHackamapBipartiteFixturePath()
      if (!fixturePath) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ problems: [], solutions: [], metadata: { source: '__bipartite_fixture:fallback' } }))
        return
      }

      try {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        const stream = createReadStream(fixturePath)
        stream.on('error', () => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Failed to read fixture file' }))
        })
        stream.pipe(res)
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Failed to serve fixture file' }))
      }
    })
  },
}

function coerceSafeRepoRelPath(raw: unknown): string | null {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  if (!normalized) return null
  if (normalized.startsWith('..')) return null
  if (normalized.includes('\u0000')) return null
  if (/^[a-zA-Z]:\//.test(normalized)) return null
  if (path.isAbsolute(normalized)) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return null
  for (const part of parts) {
    if (part === '..') return null
  }
  return parts.join('/')
}

function resolveCodebaseRootForDevServer(): string {
  const raw = String(process.env.VITE_CODEBASE_ROOT || '').trim()
  if (!raw) return repoRoot
  try {
    const abs = path.resolve(raw)
    if (existsSync(abs)) return abs
  } catch {
    void 0
  }
  return repoRoot
}

const codebaseRootForDevServer = resolveCodebaseRootForDevServer()

function createCodebaseFileHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/__codebase_file')) {
      next()
      return
    }
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const url = new URL(req.url, 'http://localhost')
      const rel = coerceSafeRepoRelPath(url.searchParams.get('path'))
      if (!rel) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Invalid path' }))
        return
      }
      const abs = path.resolve(codebaseRootForDevServer, rel)
      const rootPrefix = codebaseRootForDevServer.endsWith(path.sep)
        ? codebaseRootForDevServer
        : codebaseRootForDevServer + path.sep
      if (!abs.startsWith(rootPrefix)) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Forbidden path' }))
        return
      }
      const text = await fs.readFile(abs, 'utf8')
      if (!text.trim()) {
        res.statusCode = 204
        res.end('')
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(text)
    } catch (error) {
      let message = 'Failed to read file'
      if (error && typeof error === 'object' && 'message' in error) {
        const candidate = (error as { message?: unknown }).message
        if (typeof candidate === 'string' && candidate.trim()) message = candidate
      }
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: message }))
    }
  }
}

function guessContentType(filePath: string): string {
  const ext = String(path.extname(filePath) || '').toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.ogg') return 'audio/ogg'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.json' || ext === '.jsonld') return 'application/json'
  if (ext === '.css') return 'text/css'
  if (ext === '.html' || ext === '.htm') return 'text/html'
  if (ext === '.md' || ext === '.mmd' || ext === '.txt') return 'text/plain'
  return 'application/octet-stream'
}

function createCodebaseAssetHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/__codebase_asset')) {
      next()
      return
    }
    if (req.method !== 'GET') {
      next()
      return
    }
    try {
      const url = new URL(req.url, 'http://localhost')
      const rel = coerceSafeRepoRelPath(url.searchParams.get('path'))
      if (!rel) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Invalid path' }))
        return
      }
      const abs = path.resolve(codebaseRootForDevServer, rel)
      const rootPrefix = codebaseRootForDevServer.endsWith(path.sep)
        ? codebaseRootForDevServer
        : codebaseRootForDevServer + path.sep
      if (!abs.startsWith(rootPrefix)) {
        res.statusCode = 403
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Forbidden path' }))
        return
      }

      const contentType = guessContentType(abs)
      res.statusCode = 200
      res.setHeader('Content-Type', contentType)

      const stream = createReadStream(abs)
      stream.on('error', () => {
        try {
          if (!res.headersSent) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ ok: false, error: 'Asset not found' }))
        } catch {
          void 0
        }
      })
      stream.pipe(res)
    } catch (error) {
      let message = 'Failed to read asset'
      if (error && typeof error === 'object' && 'message' in error) {
        const candidate = (error as { message?: unknown }).message
        if (typeof candidate === 'string' && candidate.trim()) message = candidate
      }
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: message }))
    }
  }
}

const codebaseFileDevPlugin = {
  name: 'knowgrph-codebase-file-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(createCodebaseFileHandler())
    server.middlewares.use(createCodebaseAssetHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(createCodebaseFileHandler())
    server.middlewares.use(createCodebaseAssetHandler())
  },
}

function createLazyWebsiteImportHandler(
  server: Pick<import('vite').ViteDevServer, 'ssrLoadModule'> | Pick<import('vite').PreviewServer, 'middlewares'>,
): import('vite').Connect.NextHandleFunction {
  let handlerPromise: Promise<import('vite').Connect.NextHandleFunction> | null = null
  const getHandler = async () => {
    if (handlerPromise) return await handlerPromise
    const hasSsr = server && typeof (server as unknown as { ssrLoadModule?: unknown }).ssrLoadModule === 'function'
    if (!hasSsr) {
      handlerPromise = Promise.resolve((req, res, _next) => {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Website import handler unavailable in preview server' }))
      })
      return await handlerPromise
    }
    handlerPromise = (async () => {
      const devServer = server as Pick<import('vite').ViteDevServer, 'ssrLoadModule'>
      const mod = (await devServer.ssrLoadModule('/src/lib/websites/server/websiteImportServer.ts')) as unknown as {
        createWebsiteImportHandler: (args: { repoRoot: string }) => import('vite').Connect.NextHandleFunction
      }
      return mod.createWebsiteImportHandler({ repoRoot })
    })()
    return await handlerPromise
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
      if (!(req.url?.startsWith('/__fetch_remote') || req.url?.startsWith(CHAT_BINARY_DOWNLOAD_PROXY_PREFIX))) {
        next()
        return
      }
      createRemoteFetchHandler()(req, res, next)
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!(req.url?.startsWith('/__fetch_remote') || req.url?.startsWith(CHAT_BINARY_DOWNLOAD_PROXY_PREFIX))) {
        next()
        return
      }
      createRemoteFetchHandler()(req, res, next)
    })
  },
}

const grabMapsProxyDevPlugin = {
  name: 'knowgrph-grabmaps-proxy-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(GRABMAPS_PROXY_PREFIX)) {
        next()
        return
      }
      createGrabMapsProxyHandler()(req, res, next)
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(GRABMAPS_PROXY_PREFIX)) {
        next()
        return
      }
      createGrabMapsProxyHandler()(req, res, next)
    })
  },
}

const chatProxyDevPlugin = {
  name: 'knowgrph-chat-proxy-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(CHAT_PROXY_PREFIX)) {
        next()
        return
      }
      createChatProxyHandler()(req, res, next)
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(CHAT_PROXY_PREFIX)) {
        next()
        return
      }
      createChatProxyHandler()(req, res, next)
    })
  },
}

const chatLogDevPlugin = {
  name: 'knowgrph-chat-log-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(CHAT_LOG_APPEND_PATH)) {
        next()
        return
      }
      createChatLogAppendHandler()(req, res, next)
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(CHAT_LOG_APPEND_PATH)) {
        next()
        return
      }
      createChatLogAppendHandler()(req, res, next)
    })
  },
}

const kgFsWriteDevPlugin = {
  name: 'knowgrph-kg-fs-write-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(KG_FS_WRITE_PATH)) {
        next()
        return
      }
      createKgFsWriteHandler()(req, res, next)
    })
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(KG_FS_WRITE_PATH)) {
        next()
        return
      }
      createKgFsWriteHandler()(req, res, next)
    })
  },
}

const webpageProxyDevPlugin = {
  name: 'knowgrph-webpage-proxy-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/__webpage_proxy', createWebpageProxyHandler())
    server.middlewares.use('/__webpage_asset_proxy', createWebpageAssetProxyHandler())
    server.middlewares.use('/__webpage_asset_path', createWebpageAssetPathProxyHandler())
    server.middlewares.use('/__webpage_meta', async (req, res, next) => {
      try {
        const mod = await import('./src/lib/websites/webpageMetaServer')
        return mod.createWebpageMetaHandler()(req, res, next)
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'webpage meta handler failed' }))
      }
    })
    server.middlewares.use('/__repo_file', createRepoFileHandler())
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use('/__webpage_proxy', createWebpageProxyHandler())
    server.middlewares.use('/__webpage_asset_proxy', createWebpageAssetProxyHandler())
    server.middlewares.use('/__webpage_asset_path', createWebpageAssetPathProxyHandler())
    server.middlewares.use('/__webpage_meta', async (req, res, next) => {
      try {
        const mod = await import('./src/lib/websites/webpageMetaServer')
        return mod.createWebpageMetaHandler()(req, res, next)
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'webpage meta handler failed' }))
      }
    })
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
    const convertHandler = createPdfConvertHandler()
    const assetsHandler = createPdfAssetsHandler()
    server.middlewares.use('/__convert_pdf', convertHandler)
    server.middlewares.use('/__pdf_assets', assetsHandler)
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    const convertHandler = createPdfConvertHandler()
    const assetsHandler = createPdfAssetsHandler()
    server.middlewares.use('/__convert_pdf', convertHandler)
    server.middlewares.use('/__pdf_assets', assetsHandler)
  },
}

const pdfWorkspaceDevPlugin = {
  name: 'knowgrph-pdf-workspace-dev',
  configureServer(server: import('vite').ViteDevServer) {
    const handler = createPdfWorkspaceHandler({ repoRoot })
    server.middlewares.use(handler)
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    const handler = createPdfWorkspaceHandler({ repoRoot })
    server.middlewares.use(handler)
  },
}

const websiteImportDevPlugin = {
  name: 'knowgrph-website-import-dev',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use(createLazyWebsiteImportHandler(server))
  },
  configurePreviewServer(server: import('vite').PreviewServer) {
    server.middlewares.use(createLazyWebsiteImportHandler(server))
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

function createChatLogAppendHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    const parsed = (() => {
      try {
        return new URL(String(req.url || ''), `http://${req.headers.host || 'localhost'}`)
      } catch {
        return null
      }
    })()
    if (!parsed || parsed.pathname !== CHAT_LOG_APPEND_PATH) {
      next()
      return
    }
    const method = String(req.method || 'GET').toUpperCase()
    if (method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    try {
      const body = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        let total = 0
        req.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > CHAT_LOG_MAX_BODY_BYTES) {
            reject(new Error('Payload too large'))
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', err => reject(err))
      })
      const payload = JSON.parse(body.toString('utf8')) as {
        request?: unknown
        response?: unknown
        status?: unknown
        model?: unknown
        timestampMs?: unknown
      }
      const requestText = toLogSafeText(payload?.request)
      const responseText = toLogSafeText(payload?.response)
      const statusRaw = String(payload?.status || '').trim().toLowerCase()
      const status = statusRaw === 'error' || statusRaw === 'aborted' ? statusRaw : 'ok'
      const model = toLogSafeText(payload?.model)
      const tsMsRaw = typeof payload?.timestampMs === 'number' ? payload.timestampMs : Date.now()
      const tsMs = Number.isFinite(tsMsRaw) ? Math.floor(tsMsRaw) : Date.now()
      if (!requestText && !responseText) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'Missing chat log content' }))
        return
      }
      const fileName = toChatLogFileName(tsMs)
      const filePath = path.resolve(chatLogsDir, fileName)
      if (!filePath.startsWith(chatLogsDir)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'Invalid log path' }))
        return
      }
      await fs.mkdir(chatLogsDir, { recursive: true })
      const exists = existsSync(filePath)
      if (!exists) {
        const header = [
          '| User Request/AI Response | Snippet | Timestamp | Status |',
          '|---|---|---|---|',
        ].join('\n')
        await fs.writeFile(filePath, `${header}\n`, 'utf8')
      }
      const timestampText = new Date(tsMs).toISOString().slice(0, 19).replace('T', ' ')
      const snippet = toLogSafeInline(responseText || requestText).slice(0, 280)
      const pairInline = `User: ${toLogSafeInline(requestText).slice(0, 400)} ↔ AI: ${toLogSafeInline(responseText).slice(0, 400)}`
      const detail = [
        `<details><summary>Details</summary>`,
        '',
        `**Model:** ${toLogSafeInline(model || '—')}`,
        '',
        '**User Request**',
        '',
        '```text',
        requestText || '—',
        '```',
        '',
        '**AI Response**',
        '',
        '```text',
        responseText || '—',
        '```',
        '',
        '</details>',
      ].join('\n')
      const row = `| ${pairInline} | ${snippet}<br/>${detail} | ${timestampText} | ${toLogSafeInline(status)} |`
      await fs.appendFile(filePath, `${row}\n`, 'utf8')
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: true, file: `/logs/${fileName}` }))
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : ''
      res.statusCode = /too large/i.test(message) ? 413 : 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: false, error: message || 'Failed to append chat log' }))
    }
  }
}

function createChatProxyHandler(): import('vite').Connect.NextHandleFunction {
  const writeJson = (res: import('node:http').ServerResponse, status: number, payload: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(payload))
  }
  const parseSseFrames = (buffer: string): { frames: Array<{ event: string; data: string }>; rest: string } => {
    const lines = buffer.split(/\r?\n/)
    const frames: Array<{ event: string; data: string }> = []
    let eventName = 'message'
    let dataLines: string[] = []
    let idx = 0
    while (idx < lines.length) {
      const line = lines[idx]
      idx += 1
      if (line === '') {
        if (dataLines.length) {
          frames.push({ event: eventName, data: dataLines.join('\n') })
        }
        eventName = 'message'
        dataLines = []
        continue
      }
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim() || 'message'
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim())
      }
    }
    const terminated = /\r?\n\r?\n$/.test(buffer)
    if (terminated) return { frames, rest: '' }
    const restLines = lines.slice(Math.max(lines.length - 1, 0))
    return { frames: frames.slice(0, Math.max(frames.length - (dataLines.length ? 1 : 0), 0)), rest: restLines.join('\n') }
  }
  const toActionableChatProxyError = (message: string): string => {
    const normalized = String(message || '').trim()
    const lowered = normalized.toLowerCase()
    if (!normalized) {
      return 'Chat proxy could not reach the local AI gateway. Ensure the gateway is running and retry.'
    }
    if (
      lowered === 'fetch failed'
      || lowered.includes('failed to fetch')
      || lowered.includes('connection refused')
      || lowered.includes('name or service not known')
      || lowered.includes('network error')
    ) {
      return 'Local AI gateway is not running or unreachable. Start the gateway and retry.'
    }
    return normalized
  }
  const listLocalGatewayModelIds = async ({
    upstreamBase,
    controller,
  }: {
    upstreamBase: URL
    controller: AbortController
  }): Promise<string[]> => {
    try {
      const localGatewayModelsUrl = new URL('/api/models', upstreamBase)
      const res = await fetch(localGatewayModelsUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
      })
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name?: unknown }> }
        const fromApi = (Array.isArray(data.models) ? data.models : [])
          .map(item => (typeof item?.name === 'string' ? item.name.trim() : ''))
          .filter(Boolean)
        if (fromApi.length) return fromApi
      }
    } catch {
      void 0
    }
    return []
  }
  const handleLocalGatewayChatCompletions = async ({
    body,
    upstreamBase,
    controller,
    res,
  }: {
    body: Buffer
    upstreamBase: URL
    controller: AbortController
    res: import('node:http').ServerResponse
  }): Promise<void> => {
    const payload = (() => {
      try {
        const parsed = JSON.parse(body.toString('utf8')) as {
          model?: unknown
          messages?: Array<{ role?: unknown; content?: unknown }>
        }
        return parsed
      } catch {
        return null
      }
    })()
    if (!payload || !Array.isArray(payload.messages)) {
      writeJson(res, 400, { ok: false, error: 'Invalid local gateway chat payload' })
      return
    }
    const threadCreateUrl = new URL('/api/langgraph/threads', upstreamBase)
    const normalizedMessages = payload.messages
      .map(msg => {
        const role = typeof msg?.role === 'string' ? msg.role.trim() : ''
        const content = typeof msg?.content === 'string' ? msg.content : ''
        if (!role || !content) return null
        return { role, content }
      })
      .filter(Boolean) as Array<{ role: string; content: string }>
    const requestedModel = typeof payload.model === 'string' ? payload.model.trim() : ''
    const availableModelIds = await listLocalGatewayModelIds({
      upstreamBase,
      controller,
    })
    const effectiveModel = requestedModel && availableModelIds.includes(requestedModel)
      ? requestedModel
      : (availableModelIds[0] || requestedModel)
    if (!effectiveModel) {
      writeJson(
        res,
        502,
        { ok: false, error: "No chat model could be resolved. Please configure at least one model in config.yaml or provide a valid 'model_name'/'model' in the request." },
      )
      return
    }
    const streamBody = {
      assistant_id: 'lead_agent',
      input: { messages: normalizedMessages },
      config: {
        configurable: {
          model_name: effectiveModel,
          model: effectiveModel,
          thinking_enabled: false,
          is_plan_mode: false,
        },
      },
      stream_mode: ['messages', 'values', 'custom'],
    }
    const threadCreateRes = await fetch(threadCreateUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { source: 'knowgrph-chat-proxy' } }),
      signal: controller.signal,
    })
    if (!threadCreateRes.ok) {
      const detail = await threadCreateRes.text()
      writeJson(res, threadCreateRes.status, { ok: false, error: detail || 'Failed to create local gateway thread' })
      return
    }
    const threadData = (await threadCreateRes.json()) as { thread_id?: unknown }
    const threadId = typeof threadData.thread_id === 'string' ? threadData.thread_id.trim() : ''
    if (!threadId) {
      writeJson(res, 502, { ok: false, error: 'Invalid local gateway thread response' })
      return
    }
    const streamUrl = new URL(`/api/langgraph/threads/${encodeURIComponent(threadId)}/runs/stream`, upstreamBase)
    const localGatewayRes = await fetch(streamUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(streamBody),
      signal: controller.signal,
    })
    if (!localGatewayRes.ok) {
      const detail = await localGatewayRes.text()
      writeJson(res, localGatewayRes.status, { ok: false, error: detail || 'Local gateway run failed' })
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Connection', 'keep-alive')
    const reader = localGatewayRes.body?.getReader()
    if (!reader) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '' } }] })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    let buffer = ''
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (!chunk.value || chunk.value.byteLength === 0) continue
      buffer += Buffer.from(chunk.value).toString('utf8')
      const parsed = parseSseFrames(buffer)
      buffer = parsed.rest
      parsed.frames.forEach(frame => {
        if (!frame.data) return
        if (frame.event === 'end') {
          res.write('data: [DONE]\n\n')
          return
        }
        let text = ''
        try {
          const data = JSON.parse(frame.data) as { content?: unknown; role?: unknown }
          if (typeof data.content === 'string' && String(data.role || '').toLowerCase() === 'assistant') {
            text = data.content
          }
        } catch {
          text = ''
        }
        if (!text) return
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
      })
    }
    res.write('data: [DONE]\n\n')
    res.end()
  }
  return async (req, res, next) => {
    const method = String(req.method || 'GET').toUpperCase()
    if (method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', '*')
      res.setHeader('Access-Control-Max-Age', '86400')
      res.end()
      return
    }
    if (!['GET', 'HEAD', 'POST'].includes(method)) {
      next()
      return
    }
    const parsedReq = (() => {
      try {
        return new URL(String(req.url || ''), `http://${req.headers.host || 'localhost'}`)
      } catch {
        return null
      }
    })()
    if (!parsedReq) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Invalid proxy request URL' }))
      return
    }
    if (!parsedReq.pathname.startsWith(CHAT_PROXY_PREFIX)) {
      next()
      return
    }
    const providerHeader = normalizeHost(readSingleHeader(req.headers['x-kg-chat-provider']))
    const gatewayMode = String(process.env.KNOWGRPH_CHAT_GATEWAY_MODE || '').trim().toLowerCase()
    const localGatewayOnly = gatewayMode === 'local-only' || (gatewayMode.endsWith('-only') && gatewayMode !== 'openai-only')
    const localProviderSelected = providerHeader === 'lmstudio-local'
    const bytePlusProviderSelected = providerHeader === 'byteplus-modelark'
    if (localGatewayOnly && providerHeader === 'openai') {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Chat proxy is running in local-only gateway mode' }))
      return
    }
    const requestedUpstreamRaw = readSingleHeader(req.headers['x-kg-chat-upstream'])
    const upstreamBaseRaw = (() => {
      const legacyLocalUpstreamKey = ['KNOWGRPH_CHAT_PROXY_', 'DEER', 'FLOW', '_UPSTREAM'].join('')
      const legacyLocalUpstream = String((process.env as Record<string, string | undefined>)[legacyLocalUpstreamKey] || '').trim()
      const localGatewayBase = String(process.env.KNOWGRPH_CHAT_PROXY_LOCAL_UPSTREAM || '').trim()
      if (localGatewayOnly || localProviderSelected) {
        return localGatewayBase || legacyLocalUpstream || String(process.env.KNOWGRPH_CHAT_PROXY_UPSTREAM || '').trim() || 'http://127.0.0.1:1234'
      }
      if (bytePlusProviderSelected) return requestedUpstreamRaw || `https://${CHAT_PROXY_BYTEPLUS_AP_SOUTHEAST_HOST}`
      if (providerHeader === 'openai') return 'https://api.openai.com'
      if (requestedUpstreamRaw) return requestedUpstreamRaw
      return String(process.env.KNOWGRPH_CHAT_PROXY_UPSTREAM || '').trim() || 'http://127.0.0.1:1234'
    })()
    const allowedHosts = parseAllowedChatProxyHosts()
    const upstreamBase = (() => {
      try {
        return new URL(upstreamBaseRaw)
      } catch {
        return null
      }
    })()
    if (!upstreamBase) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Invalid chat proxy upstream configuration' }))
      return
    }
    const upstreamHostname = normalizeHost(upstreamBase.hostname)
    if (!allowedHosts.has(upstreamHostname)) {
      res.statusCode = 403
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Chat proxy upstream host is not allowed' }))
      return
    }
    if (!isLocalChatUpstreamHost(upstreamHostname) && upstreamBase.protocol !== 'https:') {
      res.statusCode = 403
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Chat proxy requires HTTPS for non-local upstream hosts' }))
      return
    }
    const requiresOpenAiKey = !localGatewayOnly && (providerHeader === 'openai' || upstreamHostname === CHAT_PROXY_OPENAI_HOST)
    const requiresBytePlusKey = !localGatewayOnly && (bytePlusProviderSelected || isBytePlusChatUpstreamHost(upstreamHostname))
    const envOpenAiApiKey = String(process.env.KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
    const envBytePlusApiKey = String(process.env.KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY || '').trim()
    const headerProviderApiKey = readSingleHeader(req.headers['x-kg-chat-api-key'])
    const openAiApiKey = (headerProviderApiKey || envOpenAiApiKey).slice(0, 512)
    const bytePlusApiKey = (headerProviderApiKey || envBytePlusApiKey).slice(0, 512)
    const providerApiKey = requiresBytePlusKey ? bytePlusApiKey : openAiApiKey
    if (requiresOpenAiKey && !openAiApiKey) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({
        ok: false,
        error: 'Missing OpenAI API key for chat proxy upstream. Set Settings → Chat auth to BYOK, or export OPENAI_API_KEY and restart the dev server.',
      }))
      return
    }
    if (requiresBytePlusKey && !providerApiKey) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Missing BytePlus API key for chat proxy upstream' }))
      return
    }
    let suffix = parsedReq.pathname.slice(CHAT_PROXY_PREFIX.length) || '/v1/chat/completions'
    if (providerHeader === 'openai') {
      if (suffix === '/api/v3/chat/completions') suffix = '/v1/chat/completions'
      if (suffix === '/api/v3/models') suffix = '/v1/models'
    }
    const upstreamPath = suffix.startsWith('/') ? suffix : `/${suffix}`
    const upstreamUrl = new URL(`${upstreamPath}${parsedReq.search || ''}`, upstreamBase)
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    try {
      const body = await new Promise<Buffer>((resolve, reject) => {
        if (method === 'GET' || method === 'HEAD') {
          resolve(Buffer.alloc(0))
          return
        }
        const chunks: Buffer[] = []
        let total = 0
        const maxBytes = 8 * 1024 * 1024
        req.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total > maxBytes) {
            reject(new Error('Payload too large'))
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', err => reject(err))
      })
      const ctrl = new AbortController()
      controller = ctrl
      timeoutId = setTimeout(() => ctrl.abort(), 90_000)
      if (localProviderSelected && method === 'GET' && upstreamPath === '/v1/models') {
        let localGatewayModelsRes: Response | null = null
        try {
          const localGatewayModelsUrl = new URL('/api/models', upstreamBase)
          localGatewayModelsRes = await fetch(localGatewayModelsUrl.toString(), {
            method: 'GET',
            signal: ctrl.signal,
          })
        } catch {
          localGatewayModelsRes = null
        }
        if (!localGatewayModelsRes) {
          writeJson(res, 502, { ok: false, error: 'Failed to load local gateway models' })
          return
        }
        const data = (await localGatewayModelsRes.json()) as { models?: Array<{ name?: unknown }> }
        const list = Array.isArray(data.models) ? data.models : []
        const mapped = list
          .map(item => {
            const id = typeof item?.name === 'string' ? item.name.trim() : ''
            if (!id) return null
            return { id, object: 'model' }
          })
          .filter(Boolean)
        writeJson(res, localGatewayModelsRes.status, { data: mapped })
        return
      }
      if (localProviderSelected && method === 'POST' && upstreamPath === '/v1/chat/completions') {
        await handleLocalGatewayChatCompletions({
          body,
          upstreamBase,
          controller: ctrl,
          res,
        })
        return
      }
      const headers = new Headers()
      const contentType = String(req.headers['content-type'] || '').trim()
      const accept = String(req.headers.accept || '').trim()
      if (method === 'POST' && !contentType.toLowerCase().includes('application/json')) {
        res.statusCode = 415
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'Chat proxy expects application/json payloads' }))
        return
      }
      if (contentType) headers.set('Content-Type', contentType)
      if (accept) headers.set('Accept', accept)
      if (requiresOpenAiKey || requiresBytePlusKey) headers.set('Authorization', `Bearer ${providerApiKey}`)
      const clientRequestId = readSingleHeader(req.headers['x-client-request-id']).slice(0, 512)
      if (clientRequestId) headers.set('X-Client-Request-Id', clientRequestId)
      const upstreamRes = await fetch(upstreamUrl.toString(), {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
        signal: ctrl.signal,
      })
      res.statusCode = upstreamRes.status
      upstreamRes.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (lower === 'content-length') return
        if (lower === 'content-encoding') return
        if (lower === 'connection') return
        if (lower === 'transfer-encoding') return
        if (lower === 'www-authenticate') return
        res.setHeader(key, value)
      })
      res.setHeader('Cache-Control', 'no-store')
      const requestOrigin = String(req.headers.origin || '').trim()
      if (requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin)
        res.setHeader('Vary', 'Origin')
      }
      if (method === 'HEAD') {
        res.end()
        return
      }
      const reader = upstreamRes.body?.getReader()
      if (!reader) {
        const fallback = Buffer.from(await upstreamRes.arrayBuffer())
        res.end(fallback)
        return
      }
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        if (!chunk.value || chunk.value.byteLength === 0) continue
        res.write(Buffer.from(chunk.value))
      }
      res.end()
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : ''
      if (controller?.signal.aborted || /aborted|timeout/i.test(message)) {
        res.statusCode = 504
      } else if (/too large/i.test(message)) {
        res.statusCode = 413
      } else {
        res.statusCode = 502
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: false, error: toActionableChatProxyError(message || 'Failed to reach local chat upstream') }))
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
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
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Type, Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified, Cache-Control, Expires',
    )
    const parsedReq = (() => {
      try {
        return new URL(req.url || '', `http://${req.headers.host}`)
      } catch {
        return null
      }
    })()
    const urlParam = parsedReq ? parsedReq.searchParams.get('url') : null
    const scriptPolicyParam = parsedReq ? parsedReq.searchParams.get('kg_script_policy') : null
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : ''
    const ifRangeHeader = typeof req.headers['if-range'] === 'string' ? req.headers['if-range'] : ''

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
         const ext = path.extname(localFile).toLowerCase()
         if (ext === '.html' || ext === '.htm') {
           const content = await fs.readFile(localFile, 'utf8')
           const injected = injectWebpageProxyHtml({
             html: content,
             originalUrl: urlParam,
             scriptPolicy: scriptPolicyParam,
           })
           res.statusCode = 200
           res.setHeader('Content-Type', 'text/html; charset=utf-8')
           res.setHeader('Cache-Control', 'no-store')
           res.end(injected)
           return
         }

         const content = await fs.readFile(localFile, 'utf8')
         const contentType = (() => {
           if (ext === '.geojson') return 'application/geo+json; charset=utf-8'
           if (ext === '.json' || ext === '.jsonld') return 'application/json; charset=utf-8'
           if (ext === '.md' || ext === '.markdown' || ext === '.mmd') return 'text/markdown; charset=utf-8'
           if (ext === '.yaml' || ext === '.yml') return 'text/yaml; charset=utf-8'
           if (ext === '.csv') return 'text/csv; charset=utf-8'
           if (ext === '.svg') return 'image/svg+xml; charset=utf-8'
           if (ext === '.txt') return 'text/plain; charset=utf-8'
           return 'text/plain; charset=utf-8'
         })()
         res.statusCode = 200
         res.setHeader('Content-Type', contentType)
         res.setHeader('Cache-Control', 'no-store')
         res.end(content)
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

    const upstreamHost = (() => {
      try {
        return new URL(urlParam).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()
    const shouldSpoofWeChat =
      upstreamHost === 'mp.weixin.qq.com' ||
      upstreamHost.endsWith('.mp.weixin.qq.com') ||
      upstreamHost === 'mmbiz.qpic.cn' ||
      upstreamHost.endsWith('.qpic.cn') ||
      upstreamHost === 'mmbiz.qlogo.cn' ||
      upstreamHost.endsWith('.qlogo.cn') ||
      upstreamHost === 'wx.qlogo.cn' ||
      upstreamHost.endsWith('.wx.qlogo.cn')

    const upstreamReferer = (() => {
      if (shouldSpoofWeChat) return 'https://mp.weixin.qq.com/'
      try {
        const u = new URL(urlParam)
        const host = u.hostname.toLowerCase()
        if (host === 'media.licdn.com' || host.endsWith('.licdn.com')) return 'https://www.linkedin.com/'
        return `${u.origin}/`
      } catch {
        return undefined
      }
    })()

    const acceptLanguage =
      typeof req.headers['accept-language'] === 'string' && req.headers['accept-language'].trim()
        ? req.headers['accept-language']
        : shouldSpoofWeChat
          ? 'zh-CN,zh;q=0.9,en;q=0.8'
          : 'en-US,en;q=0.9'

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
      const maxBinaryBytes = (() => {
        const raw = String(process.env.KNOWGRPH_REMOTE_FETCH_MAX_BYTES_BINARY || '').trim()
        const parsed = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return 250 * 1024 * 1024
        return Math.max(512 * 1024, Math.min(1024 * 1024 * 1024, Math.floor(parsed)))
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
          Accept: typeof req.headers.accept === 'string' && req.headers.accept.trim() ? req.headers.accept : '*/*',
          'Accept-Language': acceptLanguage,
          'Accept-Encoding': 'identity',
          ...(upstreamReferer ? { Referer: upstreamReferer } : {}),
          ...(rangeHeader ? { Range: rangeHeader } : {}),
          ...(ifRangeHeader ? { 'If-Range': ifRangeHeader } : {}),
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
      const passthrough = ['cache-control', 'etag', 'last-modified', 'expires', 'accept-ranges', 'content-range', 'content-length']
      for (const key of passthrough) {
        try {
          const v = upstream.headers.get(key)
          if (v) res.setHeader(key, v)
        } catch {
          void 0
        }
      }
      if (req.method === 'HEAD') {
        res.end()
        finished = true
        return
      }
      const effectiveMaxBytes = (() => {
        const ct = String(contentType || '').toLowerCase()
        if (rangeHeader) return maxBinaryBytes
        if (ct.startsWith('video/') || ct.startsWith('audio/')) return maxBinaryBytes
        return maxBytes
      })()
      const reader = upstream.body?.getReader()
      if (!reader) {
        const contentLengthRaw = upstream.headers.get('content-length')
        const len = contentLengthRaw ? Number(contentLengthRaw) : NaN
        if (Number.isFinite(len) && len > effectiveMaxBytes) {
          throw new Error('Upstream response too large')
        }
        const buf = Buffer.from(await upstream.arrayBuffer())
        if (buf.byteLength > effectiveMaxBytes) throw new Error('Upstream response too large')
        finished = true
        res.end(buf)
        return
      }
      let total = 0
      while (true) {
        if (ctrl.signal.aborted) throw new Error('aborted')
        const { done, value } = await reader.read()
        if (done) break
        if (!value || value.byteLength === 0) continue
        total += value.byteLength
        if (total > effectiveMaxBytes) {
          try {
            await reader.cancel()
          } catch {
            void 0
          }
          throw new Error('Upstream response too large')
        }
        if (!res.write(Buffer.from(value))) {
          await new Promise<void>(resolve => res.once('drain', resolve))
        }
      }
      finished = true
      res.end()
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

function createGrabMapsProxyHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    const methodRaw = String(req.method || '').toUpperCase()
    if (methodRaw === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', '*')
      res.setHeader('Access-Control-Max-Age', '86400')
      res.end()
      return
    }
    if (methodRaw !== 'GET' && methodRaw !== 'HEAD' && methodRaw !== 'POST') {
      next()
      return
    }

    const parsedReq = (() => {
      try {
        return new URL(req.url || '', `http://${req.headers.host}`)
      } catch {
        return null
      }
    })()
    if (!parsedReq) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Invalid request URL' }))
      return
    }
    const urlParam = parsedReq.searchParams.get('url')
    if (!urlParam) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Missing url parameter' }))
      return
    }
    const targetRaw = unwrapUserProvidedText(urlParam) || urlParam
    let target: URL
    try {
      target = new URL(targetRaw)
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Invalid url parameter' }))
      return
    }
    if (target.protocol !== 'https:') {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'GrabMaps proxy requires https' }))
      return
    }
    const host = target.hostname.toLowerCase()
    if (host !== 'maps.grab.com') {
      res.statusCode = 403
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'GrabMaps proxy forbids non-GrabMaps hosts' }))
      return
    }

    const isMcp = target.pathname.startsWith('/api/v1/mcp')
    const requestedAuthModeRaw = readSingleHeader(req.headers['x-kg-grabmaps-auth-mode']).toLowerCase()
    const requestedAuthMode: 'serverManaged' | 'byok' = requestedAuthModeRaw === 'servermanaged' ? 'serverManaged' : 'byok'
    const byokApiKey = readSingleHeader(req.headers['x-kg-grabmaps-api-key']).replace(/[\r\n]/g, '').trim().slice(0, 512)
    const serverToken = getGrabMapsBearerToken(isMcp ? 'mcp' : 'api')
    const effectiveBearerToken = requestedAuthMode === 'byok' ? byokApiKey : serverToken

    const maxBodyBytes = 2 * 1024 * 1024
    const timeoutMs = 20_000
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs)
    let downstreamClosed = false
    const markDownstreamClosed = () => {
      downstreamClosed = true
      try {
        ctrl.abort()
      } catch {
        void 0
      }
    }
    req.once('aborted', markDownstreamClosed)
    req.once('close', () => {
      if (res.writableEnded || res.destroyed) return
      markDownstreamClosed()
    })
    res.once('close', () => {
      if (res.writableEnded) return
      markDownstreamClosed()
    })

    try {
      const bodyBuf = await (async () => {
        if (methodRaw !== 'POST') return null
        const chunks: Buffer[] = []
        let total = 0
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk) => {
            const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            total += b.length
            if (total > maxBodyBytes) {
              reject(new Error('Request body too large'))
              return
            }
            chunks.push(b)
          })
          req.on('end', () => resolve())
          req.on('error', (e) => reject(e))
        })
        return Buffer.concat(chunks)
      })()

      const headers = new Headers()
      const accept = String(req.headers.accept || '').trim()
      const contentType = String(req.headers['content-type'] || '').trim()
      if (accept) headers.set('Accept', accept)
      if (contentType) headers.set('Content-Type', contentType)
      // Auth mode SSOT:
      // - byok: use caller-provided key from local proxy headers
      // - serverManaged: use server env token
      // If no key/token is present, forward without Authorization and let upstream reply.
      if (effectiveBearerToken) headers.set('Authorization', `Bearer ${effectiveBearerToken}`)

      const upstreamRes = await fetch(target.toString(), {
        method: methodRaw,
        headers,
        body:
          bodyBuf && bodyBuf.length
            ? (bodyBuf.buffer.slice(bodyBuf.byteOffset, bodyBuf.byteOffset + bodyBuf.byteLength) as ArrayBuffer)
            : undefined,
        signal: ctrl.signal,
      })
      if (downstreamClosed || res.destroyed) return

      res.statusCode = upstreamRes.status
      const cacheControl =
        methodRaw === 'GET' || methodRaw === 'HEAD'
          ? (effectiveBearerToken ? 'private, no-store' : 'public, max-age=60')
          : 'no-store'
      res.setHeader('Cache-Control', cacheControl)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

      const contentTypeOut = upstreamRes.headers.get('content-type')
      if (contentTypeOut) res.setHeader('Content-Type', contentTypeOut)

      if (methodRaw === 'HEAD') {
        res.end()
        return
      }

      const reader = upstreamRes.body?.getReader()
      if (!reader) {
        res.end(Buffer.from(await upstreamRes.arrayBuffer()))
        return
      }
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        if (downstreamClosed || res.destroyed || res.writableEnded) {
          try {
            await reader.cancel()
          } catch {
            void 0
          }
          return
        }
        if (!chunk.value || chunk.value.byteLength === 0) continue
        res.write(Buffer.from(chunk.value))
      }
      res.end()
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '') : ''
      if (downstreamClosed || res.destroyed || /aborted|premature close|socket hang up|econnreset/i.test(message)) {
        if (!res.writableEnded && !res.destroyed) {
          try {
            res.end()
          } catch {
            void 0
          }
        }
        return
      }
      res.statusCode = ctrl.signal.aborted || /timeout|aborted/i.test(message) ? 504 : /too large/i.test(message) ? 413 : 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({ ok: false, error: message || 'GrabMaps proxy failed' }))
    } finally {
      clearTimeout(timeoutId)
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
  const assetProxyPrefix = '/__webpage_asset_path/'
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
    try {
      const u = new URL(abs)
      const origin = u.origin
      const p = u.pathname || '/'
      const q = u.search || ''
      return `${assetProxyPrefix}${encodeURIComponent(origin)}${p}${q}`
    } catch {
      return raw
    }
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

function injectWebpageProxyHtml(opts: { html: string; originalUrl: string; scriptPolicy?: string | null }): string {
  const injectWeChatUnhideStyle = (html: string, originalUrl: string): string => {
    const raw = String(html || '')
    const base = String(originalUrl || '').trim()
    const isWeChat = /mp\.weixin\.qq\.com/i.test(base) || /mp\.weixin\.qq\.com/i.test(raw)
    if (!isWeChat) return raw
    const stripHiddenInlineStyle = (s: string): string => {
      const input = String(s || '')
      if (!/js_content/i.test(input) || !/style\s*=/.test(input)) return input
      return input.replace(
        /(<[^>]+\bid\s*=\s*("|')js_content\2[^>]*\bstyle\s*=\s*("|'))([^"']*)(\3)/gi,
        (_m, head: string, _q1: string, q: string, styleValue: string, tail: string) => {
          let next = String(styleValue || '')
          next = next.replace(/\bvisibility\s*:\s*hidden\s*;?/gi, '')
          next = next.replace(/\bopacity\s*:\s*0\s*;?/gi, '')
          next = next.replace(/\bdisplay\s*:\s*none\s*;?/gi, '')
          next = next.replace(/\s{2,}/g, ' ').trim()
          return `${head}${next}${tail}`
        },
      )
    }
    const cleaned = stripHiddenInlineStyle(raw)
    const css = [
      '#js_content{visibility:visible !important;opacity:1 !important;display:block !important;}',
      '.rich_media_content{visibility:visible !important;opacity:1 !important;display:block !important;}',
      '.rich_media_content *{visibility:visible !important;}',
      '.rich_media_content img{visibility:visible !important;opacity:1 !important;}',
      'img{visibility:visible !important;opacity:1 !important;}',
      'img{max-width:100% !important;height:auto !important;}',
      'body{opacity:1 !important;}',
    ].join('')
    const styleTag = `<style data-kg-wechat-unhide="1">${css}</style>`
    const lower = cleaned.toLowerCase()
    const headClose = lower.indexOf('</head>')
    if (headClose >= 0) return `${cleaned.slice(0, headClose)}\n${styleTag}\n${cleaned.slice(headClose)}`
    const headOpen = lower.indexOf('<head')
    if (headOpen >= 0) {
      const headEnd = lower.indexOf('>', headOpen)
      if (headEnd >= 0) return `${cleaned.slice(0, headEnd + 1)}\n${styleTag}\n${cleaned.slice(headEnd + 1)}`
    }
    const htmlOpen = lower.indexOf('<html')
    if (htmlOpen >= 0) {
      const htmlEnd = lower.indexOf('>', htmlOpen)
      if (htmlEnd >= 0) return `${cleaned.slice(0, htmlEnd + 1)}\n<head>\n${styleTag}\n</head>\n${cleaned.slice(htmlEnd + 1)}`
    }
    return `<!doctype html><html><head>${styleTag}</head><body>${cleaned}</body></html>`
  }

  const stripScriptTags = (html: string): string => {
    const raw = String(html || '')
    if (!/<script\b/i.test(raw)) return raw
    let next = raw
    next = next.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    next = next.replace(/<script\b[^>]*\/\s*>/gi, '')
    return next
  }

  const rewriteWeChatAssetHostsToAssetPathProxy = (html: string): string => {
    const raw = String(html || '')
    if (!/(mmbiz\.qpic\.cn|mmbiz\.qlogo\.cn|wx\.qlogo\.cn)/i.test(raw)) return raw
    const map: Array<{ from: RegExp; to: string }> = [
      { from: /https?:\/\/mmbiz\.qpic\.cn/gi, to: '/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn' },
      { from: /\/\/mmbiz\.qpic\.cn/gi, to: '/__webpage_asset_path/https%3A%2F%2Fmmbiz.qpic.cn' },
      { from: /https?:\/\/mmbiz\.qlogo\.cn/gi, to: '/__webpage_asset_path/https%3A%2F%2Fmmbiz.qlogo.cn' },
      { from: /\/\/mmbiz\.qlogo\.cn/gi, to: '/__webpage_asset_path/https%3A%2F%2Fmmbiz.qlogo.cn' },
      { from: /https?:\/\/wx\.qlogo\.cn/gi, to: '/__webpage_asset_path/https%3A%2F%2Fwx.qlogo.cn' },
      { from: /\/\/wx\.qlogo\.cn/gi, to: '/__webpage_asset_path/https%3A%2F%2Fwx.qlogo.cn' },
    ]
    let next = raw
    for (const { from, to } of map) next = next.replace(from, to)
    return next
  }

  const promoteLazyLoadedImages = (html: string): string => {
    const raw = String(html || '')
    if (!/<img\b/i.test(raw)) return raw
    const pickUrl = (tag: string): string => {
      const m =
        /\bdata-src\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag) ||
        /\bdata-original\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag) ||
        /\bdata-lazy-src\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag)
      if (!m) return ''
      return String(m[2] || m[3] || m[4] || '').trim()
    }
    const hasMeaningfulSrc = (tag: string): boolean => {
      const m = /\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
      const v = m ? String(m[2] || m[3] || m[4] || '').trim() : ''
      if (!v) return false
      if (/^about:blank$/i.test(v)) return false
      if (new RegExp('^data:image\\/gif;base64,r0lgodlhAQABAIAAAAAAAP\\/\\/\\/ywAAAAAAQABAAACAUwAOw==$','i').test(v)) return false
      return true
    }
    return raw.replace(/<img\b[^>]*>/gi, (tag) => {
      if (hasMeaningfulSrc(tag)) return tag
      const u = pickUrl(tag)
      if (!u) return tag
      const esc = u.replace(/"/g, '&quot;')
      if (/\bsrc\s*=\s*/i.test(tag)) {
        return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, `src="${esc}"`)
      }
      return tag.replace(/<img\b/i, `<img src="${esc}"`)
    })
  }

  const promoteLazyLoadedIframes = (html: string): string => {
    const raw = String(html || '')
    if (!/<iframe\b/i.test(raw)) return raw
    const pickUrl = (tag: string): string => {
      const m =
        /\bdata-src\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag) ||
        /\bdata-original\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag) ||
        /\bdata-lazy-src\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag)
      if (!m) return ''
      return String(m[2] || m[3] || m[4] || '').trim()
    }
    const hasMeaningfulSrc = (tag: string): boolean => {
      const m = /\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
      const v = m ? String(m[2] || m[3] || m[4] || '').trim() : ''
      if (!v) return false
      if (/^about:blank$/i.test(v)) return false
      return true
    }
    return raw.replace(/<iframe\b[^>]*>/gi, (tag) => {
      if (hasMeaningfulSrc(tag)) return tag
      let u = pickUrl(tag)
      if (!u) return tag
      if (u.startsWith('//')) u = `https:${u}`
      const esc = u.replace(/"/g, '&quot;')
      if (/\bsrc\s*=\s*/i.test(tag)) {
        return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, `src="${esc}"`)
      }
      return tag.replace(/<iframe\b/i, `<iframe src="${esc}"`)
    })
  }

  const originalUrl = String(opts.originalUrl || '').trim()
  const scriptPolicy = String(opts.scriptPolicy || '').trim().toLowerCase()
  const rawInput = stripWebpageSecurityMetasAndBase(String(opts.html || ''))
  const isWeChat = /mp\.weixin\.qq\.com/i.test(originalUrl) || /mp\.weixin\.qq\.com/i.test(rawInput)
  const html = (() => {
    let out = rewriteWebpageMediaAssetsToProxy({ html: rawInput, originalUrl })
    out = rewriteWeChatAssetHostsToAssetPathProxy(out)
    out = injectWeChatUnhideStyle(out, originalUrl)
    out = promoteLazyLoadedImages(out)
    out = promoteLazyLoadedIframes(out)
    if (scriptPolicy === 'strip' || isWeChat) out = stripScriptTags(out)
    return out
  })()
  if (!html) return html

  const injection = [
    `<base href="/">`,
    scriptPolicy === 'allow' || scriptPolicy === 'strip'
      ? '<meta name="referrer" content="strict-origin-when-cross-origin">'
      : '<meta name="referrer" content="no-referrer">',
    '<script>',
    '(() => {',
    `  const KG_ORIGINAL_URL = ${JSON.stringify(originalUrl)};`,
    '  const patchStorage = () => {',
    '    const makeStorage = () => {',
    '      const m = new Map();',
    '      return {',
    '        get length() { return m.size; },',
    '        key: (i) => { try { return Array.from(m.keys())[i] || null; } catch { return null; } },',
    '        getItem: (k) => { try { const v = m.get(String(k)); return typeof v === "string" ? v : null; } catch { return null; } },',
    '        setItem: (k, v) => { try { m.set(String(k), String(v)); } catch { void 0; } },',
    '        removeItem: (k) => { try { m.delete(String(k)); } catch { void 0; } },',
    '        clear: () => { try { m.clear(); } catch { void 0; } },',
    '      };',
    '    };',
    '    const ensure = (key) => {',
    '      try {',
    '        const v = window[key];',
    '        if (v && typeof v.getItem === "function") return;',
    '      } catch {',
    '        void 0;',
    '      }',
    '      try {',
    '        const stub = makeStorage();',
    '        Object.defineProperty(window, key, { configurable: true, enumerable: true, get: () => stub });',
    '      } catch {',
    '        void 0;',
    '      }',
    '    };',
    '    ensure("localStorage");',
    '    ensure("sessionStorage");',
    '    try {',
    '      const d = document;',
    '      void d.cookie;',
    '    } catch {',
    '      try { Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => true }); } catch { void 0; }',
    '    }',
    '  };',
    '  const KG_DIAG = {',
    '    errors: [],',
    '    rejections: [],',
    '    resources: [],',
    '    console: [],',
    '  };',
    '  const kgDiagPush = (arr, item, limit) => {',
    '    try {',
    '      const a = arr;',
    '      if (!a || typeof a.push !== "function") return;',
    '      a.push(item);',
    '      const lim = typeof limit === "number" && isFinite(limit) ? Math.max(5, Math.min(120, Math.floor(limit))) : 60;',
    '      if (a.length > lim) a.splice(0, a.length - lim);',
    '    } catch {',
    '      void 0;',
    '    }',
    '  };',
    '  const kgSetupDiag = () => {',
    '    try {',
    '      if (window.__KG_DIAG_SETUP__) return;',
    '      Object.defineProperty(window, "__KG_DIAG_SETUP__", { value: true, configurable: true });',
    '      try {',
    '        window.addEventListener("error", (ev) => {',
    '          try {',
    '            const msg = ev && ev.message ? String(ev.message) : "";',
    '            const src = ev && ev.filename ? String(ev.filename) : "";',
    '            const line = ev && typeof ev.lineno === "number" ? ev.lineno : null;',
    '            const col = ev && typeof ev.colno === "number" ? ev.colno : null;',
    '            if (msg || src) kgDiagPush(KG_DIAG.errors, { msg, src, line, col }, 60);',
    '          } catch { void 0; }',
    '        });',
    '      } catch { void 0; }',
    '      try {',
    '        window.addEventListener("unhandledrejection", (ev) => {',
    '          try {',
    '            const r = ev && ev.reason;',
    '            const msg = r && typeof r === "object" && "message" in r ? String(r.message || "") : String(r || "");',
    '            if (msg) kgDiagPush(KG_DIAG.rejections, { msg }, 60);',
    '          } catch { void 0; }',
    '        });',
    '      } catch { void 0; }',
    '      try {',
    '        window.addEventListener("error", (ev) => {',
    '          try {',
    '            const t = ev && ev.target;',
    '            if (!t || !t.tagName) return;',
    '            const tag = String(t.tagName || "").toLowerCase();',
    '            const src = t.getAttribute && (t.getAttribute("src") || t.getAttribute("href")) || "";',
    '            if (tag && src) kgDiagPush(KG_DIAG.resources, { tag, src: String(src) }, 80);',
    '          } catch { void 0; }',
    '        }, true);',
    '      } catch { void 0; }',
    '      try {',
    '        const wrap = (name) => {',
    '          try {',
    '            const prev = console && console[name];',
    '            if (typeof prev !== "function") return;',
    '            console[name] = (...args) => {',
    '              try {',
    '                const text = args.map(a => { try { return typeof a === "string" ? a : JSON.stringify(a); } catch { return String(a); } }).join(" ");',
    '                if (text) kgDiagPush(KG_DIAG.console, { level: name, text }, 80);',
    '              } catch { void 0; }',
    '              return prev.apply(console, args);',
    '            };',
    '          } catch { void 0; }',
    '        };',
    '        wrap("error");',
    '        wrap("warn");',
    '      } catch { void 0; }',
    '    } catch {',
    '      void 0;',
    '    }',
    '  };',
    '  const kgDiagSnapshot = () => {',
    '    try {',
    '      const scripts = Array.from(document.querySelectorAll("script[src]")).slice(0, 80).map(s => String(s.getAttribute("src") || ""));',
    '      const links = Array.from(document.querySelectorAll("link[href]")).slice(0, 80).map(l => String(l.getAttribute("href") || ""));',
    '      const payload = {',
    '        href: String(location && location.href || ""),',
    '        origin: String(location && location.origin || ""),',
    '        readyState: String(document && document.readyState || ""),',
    '        title: String(document && document.title || ""),',
    '        scripts,',
    '        links,',
    '        diag: KG_DIAG,',
    '      };',
    '      const raw = JSON.stringify(payload);',
    '      return raw.length > 18000 ? raw.slice(0, 18000) : raw;',
    '    } catch {',
    '      return "";',
    '    }',
    '  };',
    '  kgSetupDiag();',
    '  let KG_NET_PENDING = 0;',
    `  const KG_WEBPAGE_NET_KIND = ${JSON.stringify('kg-webpage-net')};`,
    `  const KG_WEBPAGE_DOM_KIND = ${JSON.stringify('kg-webpage-dom')};`,
    '  let KG_DOM_LAST_MUT_AT = (Date.now ? Date.now() : +new Date());',
    '  let KG_DOM_POST_AT = 0;',
    '  let KG_DOM_POST_TIMER = null;',
    '  const kgPostDomNow = () => {',
    '    try {',
    '      KG_DOM_POST_AT = (Date.now ? Date.now() : +new Date());',
    '      window.parent && window.parent.postMessage({ kind: KG_WEBPAGE_DOM_KIND, lastMutAt: KG_DOM_LAST_MUT_AT }, "*");',
    '    } catch { void 0; }',
    '  };',
    '  const kgPostDom = () => {',
    '    try {',
    '      const now = (Date.now ? Date.now() : +new Date());',
    '      const wait = 120 - (now - KG_DOM_POST_AT);',
    '      if (wait <= 0) {',
    '        if (KG_DOM_POST_TIMER) { clearTimeout(KG_DOM_POST_TIMER); KG_DOM_POST_TIMER = null; }',
    '        kgPostDomNow();',
    '        return;',
    '      }',
    '      if (KG_DOM_POST_TIMER) return;',
    '      KG_DOM_POST_TIMER = setTimeout(() => { KG_DOM_POST_TIMER = null; kgPostDomNow(); }, wait);',
    '    } catch { void 0; }',
    '  };',
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
    '  try {',
    '    if (typeof MutationObserver === "function") {',
    '      const target = document.documentElement || document.body;',
    '      if (target) {',
    '        const mo = new MutationObserver(() => {',
    '          KG_DOM_LAST_MUT_AT = (Date.now ? Date.now() : +new Date());',
    '          kgPostDom();',
    '        });',
    '        mo.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });',
    '      }',
    '    }',
    '  } catch { void 0; }',
    '  kgPostDomNow();',
    `  const KG_PROXY_PREFIX = ${JSON.stringify('/__webpage_proxy?url=')};`,
      `  const KG_ASSET_PROXY_PREFIX = ${JSON.stringify('/__webpage_asset_path/')};`,
    `  const KG_SCROLL_SYNC_KIND = ${JSON.stringify('kg-scroll-sync')};`,
    `  const KG_EXPORT_DOM_KIND = ${JSON.stringify('kg-export-dom')};`,
    '  const resolveAbs = (u) => {',
    '    try {',
    '      const raw = String(u || "");',
    '      const parsed = new URL(raw, window.location.href);',
    '      if (parsed.origin === window.location.origin) {',
    '        const p = String(parsed.pathname || "");',
    '        if (!p.startsWith("/__") && !p.startsWith("/@")) {',
    '          const rel = `${p}${parsed.search || ""}${parsed.hash || ""}`;',
    '          return new URL(rel, KG_ORIGINAL_URL).toString();',
    '        }',
    '      }',
    '    } catch {',
    '      void 0;',
    '    }',
    '    try { return new URL(String(u || ""), KG_ORIGINAL_URL).toString(); } catch { return ""; }',
    '  };',
    '  const toProxy = (abs) => abs ? (KG_PROXY_PREFIX + encodeURIComponent(abs)) : "";',
      '  const toAssetProxy = (abs) => {',
      '    try {',
      '      const s = String(abs || "").trim();',
      '      if (!s) return "";',
      '      const u = new URL(s);',
      '      const origin = encodeURIComponent(u.origin);',
      '      const p = u.pathname || "/";',
      '      const q = u.search || "";',
      '      return `${KG_ASSET_PROXY_PREFIX}${origin}${p}${q}`;',
      '    } catch {',
      '      return "";',
      '    }',
      '  };',
      '  const shouldBypassProxy = (abs) => {',
      '    const s = String(abs || "");',
      '    if (!s) return true;',
      '    try {',
      '      const u = new URL(s, window.location.href);',
      '      const p = String(u.pathname || "");',
      '      if (p.startsWith("/__webpage_proxy")) return true;',
      '      if (p.startsWith("/__webpage_asset_proxy")) return true;',
      '      if (p.startsWith("/__webpage_asset_path")) return true;',
      '      if (p.startsWith("/__repo_file")) return true;',
      '      if (p.startsWith("/__fetch_remote")) return true;',
      '    } catch {',
      '      void 0;',
      '    }',
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
    '  patchStorage();',
    '  try {',
    '    const u = new URL(KG_ORIGINAL_URL);',
    '    const next = `${u.pathname || "/"}${u.search || ""}${u.hash || ""}`;',
    '    history && history.replaceState && history.replaceState(null, "", next || "/");',
    '  } catch { void 0; }',
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
      '  const rewriteDeep = (node) => {',
      '    try {',
      '      if (!node || node.nodeType !== 1) return;',
      '      rewriteElement(node);',
      '      try {',
      '        (node.querySelectorAll ? node.querySelectorAll("script[src],link[href],img[src],img[srcset],source[src],track[src],video[src],video[poster],audio[src],iframe[src]") : []).forEach(rewriteElement);',
      '      } catch {',
      '        void 0;',
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
      '  const patchSetAttribute = () => {',
      '    try {',
      '      if (window.__KG_PATCHED_SETATTR__) return;',
      '      Object.defineProperty(window, "__KG_PATCHED_SETATTR__", { value: true, configurable: true });',
      '      const ep = Element && Element.prototype;',
      '      if (!ep || typeof ep.setAttribute !== "function") return;',
      '      const prev = ep.setAttribute;',
      '      ep.setAttribute = function(name, value) {',
      '        try {',
      '          const n = String(name || "").toLowerCase();',
      '          const v = String(value || "").trim();',
      '          if (!n || !v) return prev.call(this, name, value);',
      '          if (/^\\s*javascript:/i.test(v)) return prev.call(this, name, value);',
      '          if (v.startsWith("#")) return prev.call(this, name, value);',
      '          if (/^\\s*data:/i.test(v)) return prev.call(this, name, value);',
      '          if (/^\\s*blob:/i.test(v)) return prev.call(this, name, value);',
      '          if (/^\\s*mailto:/i.test(v) || /^\\s*tel:/i.test(v)) return prev.call(this, name, value);',
      '          if (/^\\s*[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(v) && !/^\\s*https?:/i.test(v)) return prev.call(this, name, value);',
      '          if (v.startsWith("/__") || v.startsWith("/@")) return prev.call(this, name, value);',
      '          if (n === "srcset") {',
      '            const parts = v.split(",").map(x => x.trim()).filter(Boolean);',
      '            const next = parts.map(p => {',
      '              const m = p.match(/^(\\S+)(\\s+.+)?$/);',
      '              const urlPart = m ? String(m[1] || "") : "";',
      '              const tail = m && m[2] ? String(m[2] || "") : "";',
      '              if (!urlPart) return p;',
      '              if (/^\\s*javascript:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '              if (urlPart.startsWith("#")) return `${urlPart}${tail}`;',
      '              if (/^\\s*data:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '              if (/^\\s*blob:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '              if (/^\\s*mailto:/i.test(urlPart) || /^\\s*tel:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '              if (/^\\s*[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(urlPart) && !/^\\s*https?:/i.test(urlPart)) return `${urlPart}${tail}`;',
      '              if (urlPart.startsWith("/__") || urlPart.startsWith("/@")) return `${urlPart}${tail}`;',
      '              const abs = resolveAbs(urlPart);',
      '              if (!abs) return `${urlPart}${tail}`;',
      '              return `${toAssetProxy(abs)}${tail}`;',
      '            }).join(", ");',
      '            return prev.call(this, name, next);',
      '          }',
      '          if (n === "src" || n === "href" || n === "poster") {',
      '            const tag = (this && this.tagName ? String(this.tagName) : "").toLowerCase();',
      '            if (tag === "iframe" && n === "src") {',
      '              try {',
      '                const abs = resolveAbs(v);',
      '                if (!abs) return prev.call(this, name, value);',
      '                const o = new URL(KG_ORIGINAL_URL);',
      '                const a = new URL(abs);',
      '                if (o.origin !== a.origin) return prev.call(this, name, value);',
      '                return prev.call(this, name, toProxy(abs));',
      '              } catch {',
      '                return prev.call(this, name, value);',
      '              }',
      '            }',
      '            const abs = resolveAbs(v);',
      '            if (!abs) return prev.call(this, name, value);',
      '            return prev.call(this, name, toAssetProxy(abs));',
      '          }',
      '        } catch {',
      '          void 0;',
      '        }',
      '        return prev.call(this, name, value);',
      '      };',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  const patchInsertions = () => {',
      '    try {',
      '      if (window.__KG_PATCHED_INSERTIONS__) return;',
      '      Object.defineProperty(window, "__KG_PATCHED_INSERTIONS__", { value: true, configurable: true });',
      '      const np = Node && Node.prototype;',
      '      if (!np) return;',
      '      const wrap = (fn) => function(a, b) {',
      '        try { rewriteDeep(a); } catch { void 0; }',
      '        try { return fn.call(this, a, b); } catch (e) { throw e; }',
      '      };',
      '      if (typeof np.appendChild === "function") np.appendChild = wrap(np.appendChild);',
      '      if (typeof np.insertBefore === "function") np.insertBefore = wrap(np.insertBefore);',
      '      if (typeof np.replaceChild === "function") np.replaceChild = function(n, o) {',
      '        try { rewriteDeep(n); } catch { void 0; }',
      '        return Node.prototype.replaceChild.call(this, n, o);',
      '      };',
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
      '            rewriteDeep(node);',
      '          }',
      '        }',
      '      });',
      '      mo.observe(document.documentElement, { childList: true, subtree: true });',
      '      setTimeout(() => { try { mo.disconnect(); } catch { void 0; } }, 25_000);',
      '    } catch {',
      '      void 0;',
      '    }',
      '  };',
      '  rewriteExisting();',
      '  patchSetAttribute();',
      '  patchInsertions();',
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
    '          const mode = d.mode === "text" ? "text" : d.mode === "layout" ? "layout" : "html";',
    '          const depth = typeof d.depth === "number" && isFinite(d.depth) ? Math.max(0, Math.min(2, Math.floor(d.depth))) : 0;',
    '          const includeChildren = mode === "text" && depth === 0 && d.includeChildren !== false;',
    '          const readText = () => {',
    '            try {',
    '              const body = document.body;',
    '              const t1 = body && typeof body.innerText === "string" ? body.innerText : "";',
    '              const t2 = body && typeof body.textContent === "string" ? body.textContent : "";',
    '              const a = String(t1 || "").trim();',
    '              const b = String(t2 || "").trim();',
    '              const base = a || b;',
    '              let media = "";',
    '              try {',
    '                const lines = [];',
    '                const push = (kind, url, label) => {',
    '                  const u = String(url || "").trim();',
    '                  if (!u) return;',
    '                  const l = String(label || "").trim();',
    '                  lines.push(`- [${kind}] ${l ? (l + " ") : ""}${u}`);',
    '                };',
    '                const imgs = Array.from(document.querySelectorAll("img")).slice(0, 60);',
    '                for (const img of imgs) {',
    '                  const src = img.currentSrc || (img.getAttribute && img.getAttribute("src")) || "";',
    '                  const alt = (img.getAttribute && (img.getAttribute("alt") || img.getAttribute("aria-label"))) || "";',
    '                  push("img", src, alt);',
    '                }',
    '                const videos = Array.from(document.querySelectorAll("video")).slice(0, 20);',
    '                for (const v of videos) {',
    '                  const src = v.currentSrc || (v.getAttribute && v.getAttribute("src")) || "";',
    '                  push("video", src, (v.getAttribute && v.getAttribute("aria-label")) || "");',
    '                  push("poster", (v.getAttribute && v.getAttribute("poster")) || "", "");',
    '                }',
    '                const audios = Array.from(document.querySelectorAll("audio")).slice(0, 20);',
    '                for (const a2 of audios) {',
    '                  const src = a2.currentSrc || (a2.getAttribute && a2.getAttribute("src")) || "";',
    '                  push("audio", src, (a2.getAttribute && a2.getAttribute("aria-label")) || "");',
    '                }',
    '                if (lines.length) media = `\\n\\n[MEDIA]\\n${lines.join("\\n")}`.trimEnd();',
    '              } catch {',
    '                void 0;',
    '              }',
    '              const combined = (base + media).trim();',
    '              return combined.length > base.length ? combined : base;',
    '            } catch {',
    '              return "";',
    '            }',
    '          };',
    '          const safeStyleValue = (value) => {',
    '            try {',
    '              const v = String(value || "").trim();',
    '              if (!v) return "";',
    '              if (v.length > 240) return "";',
    '              if (/url\\s*\\(|expression\\s*\\(|@import/i.test(v)) return "";',
    '              if (!/^[a-zA-Z0-9\\s().,%:/_+\\-\'"#]+$/.test(v)) return "";',
    '              const lower = v.toLowerCase();',
    '              if (/javascript:|data:/.test(lower)) return "";',
    '              return v;',
    '            } catch {',
    '              return "";',
    '            }',
    '          };',
    '          const mergeStyle = (a, b) => {',
    '            const x = String(a || "").trim();',
    '            const y = String(b || "").trim();',
    '            if (!x) return y;',
    '            if (!y) return x;',
    '            return `${x.replace(/;\\s*$/, "")}; ${y}`;',
    '          };',
    '          const buildInlineLayoutStyle = (el) => {',
    '            try {',
    '              if (!el || !window.getComputedStyle) return "";',
    '              const cs = window.getComputedStyle(el);',
    '              if (!cs) return "";',
    '              const tag = el.tagName ? String(el.tagName).toUpperCase() : "";',
    '              const isMedia = tag === "IMG" || tag === "VIDEO" || tag === "IFRAME" || tag === "SVG" || tag === "CANVAS";',
    '              const display = String(cs.display || "").toLowerCase();',
    '              const looksGrid = display === "grid" || display === "inline-grid" || String(cs.gridTemplateColumns || "").toLowerCase() !== "none" || String(cs.gridTemplateRows || "").toLowerCase() !== "none";',
    '              const looksFlex = display === "flex" || display === "inline-flex";',
    '              const looksTable = display.indexOf("table") === 0;',
    '              const colCount = Number.parseInt(String(cs.columnCount || "0"), 10);',
    '              const looksColumns = Number.isFinite(colCount) && colCount > 1;',
    '              const gridColStart = String(cs.gridColumnStart || "").trim();',
    '              const gridColEnd = String(cs.gridColumnEnd || "").trim();',
    '              const gridRowStart = String(cs.gridRowStart || "").trim();',
    '              const gridRowEnd = String(cs.gridRowEnd || "").trim();',
    '              const looksGridItem = (gridColStart && gridColStart !== "auto") || (gridColEnd && gridColEnd !== "auto") || (gridRowStart && gridRowStart !== "auto") || (gridRowEnd && gridRowEnd !== "auto");',
    '              if (!isMedia && !looksGrid && !looksFlex && !looksTable && !looksColumns && !looksGridItem) return "";',
    '              const out = [];',
    '              const push = (name, value) => {',
    '                const v = safeStyleValue(value);',
    '                if (!v) return;',
    '                out.push(`${name}:${v}`);',
    '              };',
    '              if (display && (looksGrid || looksFlex || looksTable)) push("display", display);',
    '              if (looksGrid) {',
    '                push("grid-template-columns", cs.gridTemplateColumns);',
    '                push("grid-template-rows", cs.gridTemplateRows);',
    '                push("grid-auto-flow", cs.gridAutoFlow);',
    '                push("grid-auto-rows", cs.gridAutoRows);',
    '                push("grid-auto-columns", cs.gridAutoColumns);',
    '                push("justify-items", cs.justifyItems);',
    '                push("align-items", cs.alignItems);',
    '                push("justify-content", cs.justifyContent);',
    '                push("align-content", cs.alignContent);',
    '              }',
    '              if (looksFlex) {',
    '                push("flex-direction", cs.flexDirection);',
    '                push("flex-wrap", cs.flexWrap);',
    '                push("justify-content", cs.justifyContent);',
    '                push("align-items", cs.alignItems);',
    '                push("align-content", cs.alignContent);',
    '              }',
    '              if (looksTable) {',
    '                push("table-layout", cs.tableLayout);',
    '                push("border-collapse", cs.borderCollapse);',
    '                push("border-spacing", cs.borderSpacing);',
    '              }',
    '              if (looksColumns) {',
    '                push("column-count", String(colCount));',
    '                push("column-width", cs.columnWidth);',
    '              }',
    '              if (looksGridItem) {',
    '                const col = `${gridColStart || "auto"} / ${gridColEnd || "auto"}`;',
    '                const row = `${gridRowStart || "auto"} / ${gridRowEnd || "auto"}`;',
    '                if (col !== "auto / auto") push("grid-column", col);',
    '                if (row !== "auto / auto") push("grid-row", row);',
    '              }',
    '              push("gap", cs.gap);',
    '              push("row-gap", cs.rowGap);',
    '              push("column-gap", cs.columnGap);',
    '              if (isMedia) {',
    '                push("width", cs.width);',
    '                push("height", cs.height);',
    '                push("max-width", cs.maxWidth);',
    '                push("max-height", cs.maxHeight);',
    '                push("aspect-ratio", cs.aspectRatio);',
    '              }',
    '              const combined = out.join(";");',
    '              return combined.length > 800 ? "" : combined;',
    '            } catch {',
    '              return "";',
    '            }',
    '          };',
    '          const readHtml = () => {',
    '            try {',
    '              const root = document.documentElement;',
    '              if (!root) return "";',
    '              const clone = root.cloneNode(true);',
    '              if (!clone || !clone.querySelectorAll) return root.outerHTML || "";',
    '              const srcEls = Array.from(root.querySelectorAll("*"));',
    '              const dstEls = Array.from(clone.querySelectorAll("*"));',
    '              const n = Math.min(srcEls.length, dstEls.length);',
    '              for (let i = 0; i < n; i += 1) {',
    '                const src = srcEls[i];',
    '                const dst = dstEls[i];',
    '                if (!src || !dst) continue;',
    '                const inline = buildInlineLayoutStyle(src);',
    '                if (!inline) continue;',
    '                const prev = dst.getAttribute && dst.getAttribute("style");',
    '                const next = mergeStyle(prev, inline);',
    '                if (next && dst.setAttribute) dst.setAttribute("style", next);',
    '              }',
    '              return clone.outerHTML || root.outerHTML || "";',
    '            } catch {',
    '              return document.documentElement ? document.documentElement.outerHTML : "";',
    '            }',
    '          };',
    '          const readLayout = () => {',
    '            try {',
    '              const root = document.body || document.documentElement;',
    '              if (!root) return "";',
    '              const meta = {',
    '                kind: "layout",',
    '                title: String(document && document.title || ""),',
    '                href: String(location && location.href || ""),',
    '                viewport: { w: Number(window && window.innerWidth || 0) || 0, h: Number(window && window.innerHeight || 0) || 0 },',
    '                scroll: { x: Number(window && window.scrollX || 0) || 0, y: Number(window && window.scrollY || 0) || 0, height: Number((document.scrollingElement || document.documentElement || document.body || {}).scrollHeight || 0) || 0 },',
    '                ts: Date.now ? Date.now() : +new Date(),',
    '              };',
    '              const idByEl = new WeakMap();',
    '              let seq = 0;',
    '              const getId = (el) => {',
    '                try {',
    '                  if (!el) return "";',
    '                  const existing = idByEl.get(el);',
    '                  if (existing) return existing;',
    '                  seq += 1;',
    '                  const id = "e" + String(seq);',
    '                  idByEl.set(el, id);',
    '                  return id;',
    '                } catch {',
    '                  return "";',
    '                }',
    '              };',
    '              const isSkippableTag = (tag) => {',
    '                const t = String(tag || "").toUpperCase();',
    '                return t === "SCRIPT" || t === "STYLE" || t === "NOSCRIPT" || t === "TEMPLATE" || t === "META" || t === "HEAD" || t === "LINK";',
    '              };',
    '              const safeText = (el) => {',
    '                try {',
    '                  const t = String(el && el.textContent || "").replace(/\\s+/g, " ").trim();',
    '                  if (!t) return "";',
    '                  if (t.length > 140) return t.slice(0, 140);',
    '                  return t;',
    '                } catch {',
    '                  return "";',
    '                }',
    '              };',
    '              const safeAttr = (el, name) => {',
    '                try {',
    '                  if (!el || !el.getAttribute) return "";',
    '                  const v = String(el.getAttribute(name) || "").trim();',
    '                  if (!v) return "";',
    '                  if (v.length > 420) return v.slice(0, 420);',
    '                  return v;',
    '                } catch {',
    '                  return "";',
    '                }',
    '              };',
    '              const pickStyle = (cs) => {',
    '                try {',
    '                  if (!cs) return null;',
    '                  const display = safeStyleValue(cs.display);',
    '                  const position = safeStyleValue(cs.position);',
    '                  const zIndex = safeStyleValue(cs.zIndex);',
    '                  const transform = safeStyleValue(cs.transform);',
    '                  const filter = safeStyleValue(cs.filter);',
    '                  const isolation = safeStyleValue(cs.isolation);',
    '                  const willChange = safeStyleValue(cs.willChange);',
    '                  const backgroundColor = safeStyleValue(cs.backgroundColor);',
    '                  const color = safeStyleValue(cs.color);',
    '                  const borderRadius = safeStyleValue(cs.borderRadius);',
    '                  const borderColor = safeStyleValue(cs.borderColor);',
    '                  const borderWidth = safeStyleValue(cs.borderWidth);',
    '                  const padding = safeStyleValue(cs.padding);',
    '                  const margin = safeStyleValue(cs.margin);',
    '                  const gap = safeStyleValue(cs.gap);',
    '                  const rowGap = safeStyleValue(cs.rowGap);',
    '                  const columnGap = safeStyleValue(cs.columnGap);',
    '                  const justifyContent = safeStyleValue(cs.justifyContent);',
    '                  const justifyItems = safeStyleValue(cs.justifyItems);',
    '                  const alignItems = safeStyleValue(cs.alignItems);',
    '                  const alignContent = safeStyleValue(cs.alignContent);',
    '                  const justifySelf = safeStyleValue(cs.justifySelf);',
    '                  const alignSelf = safeStyleValue(cs.alignSelf);',
    '                  const flexDirection = safeStyleValue(cs.flexDirection);',
    '                  const flexWrap = safeStyleValue(cs.flexWrap);',
    '                  const flexGrow = safeStyleValue(cs.flexGrow);',
    '                  const flexShrink = safeStyleValue(cs.flexShrink);',
    '                  const flexBasis = safeStyleValue(cs.flexBasis);',
    '                  const order = safeStyleValue(cs.order);',
    '                  const gridTemplateColumns = safeStyleValue(cs.gridTemplateColumns);',
    '                  const gridTemplateRows = safeStyleValue(cs.gridTemplateRows);',
    '                  const gridAutoFlow = safeStyleValue(cs.gridAutoFlow);',
    '                  const fontSize = safeStyleValue(cs.fontSize);',
    '                  const fontWeight = safeStyleValue(cs.fontWeight);',
    '                  const fontFamily = safeStyleValue(cs.fontFamily);',
    '                  const lineHeight = safeStyleValue(cs.lineHeight);',
    '                  const letterSpacing = safeStyleValue(cs.letterSpacing);',
    '                  const textTransform = safeStyleValue(cs.textTransform);',
    '                  const textAlign = safeStyleValue(cs.textAlign);',
    '                  const boxShadow = safeStyleValue(cs.boxShadow);',
    '                  const opacity = safeStyleValue(cs.opacity);',
    '                  const out = { display, position, zIndex, transform, filter, isolation, willChange, backgroundColor, color, borderRadius, borderColor, borderWidth, padding, margin, gap, rowGap, columnGap, justifyContent, justifyItems, alignItems, alignContent, justifySelf, alignSelf, flexDirection, flexWrap, flexGrow, flexShrink, flexBasis, order, gridTemplateColumns, gridTemplateRows, gridAutoFlow, fontSize, fontWeight, fontFamily, lineHeight, letterSpacing, textTransform, textAlign, boxShadow, opacity };',
    '                  return out;',
    '                } catch {',
    '                  return null;',
    '                }',
    '              };',
    '              const isVisibleBox = (cs, rect) => {',
    '                try {',
    '                  if (!rect) return false;',
    '                  const w = Number(rect.width || 0);',
    '                  const h = Number(rect.height || 0);',
    '                  if (!(w > 2 && h > 2)) return false;',
    '                  if (w * h < 24) return false;',
    '                  if (!cs) return true;',
    '                  const display = String(cs.display || "").toLowerCase();',
    '                  if (display === "none") return false;',
    '                  const vis = String(cs.visibility || "").toLowerCase();',
    '                  if (vis === "hidden") return false;',
    '                  const op = Number.parseFloat(String(cs.opacity || "1"));',
    '                  if (Number.isFinite(op) && op <= 0.02) return false;',
    '                  return true;',
    '                } catch {',
    '                  return true;',
    '                }',
    '              };',
    '              const out = [];',
    '              const els = Array.from(root.querySelectorAll ? root.querySelectorAll("*") : []);',
    '              const limit = Math.max(200, Math.min(3500, Number.isFinite(d && d.maxElements) ? Math.floor(d.maxElements) : 1400));',
    '              for (let i = 0; i < els.length; i += 1) {',
    '                const el = els[i];',
    '                if (!el || !el.tagName) continue;',
    '                if (isSkippableTag(el.tagName)) continue;',
    '                let rect = null;',
    '                try { rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null; } catch { rect = null; }',
    '                const rw = rect && Number(rect.width) || 0;',
    '                const rh = rect && Number(rect.height) || 0;',
    '                if (!(rw > 2 && rh > 2)) continue;',
    '                if (rw * rh < 24) continue;',
    '                let cs = null;',
    '                try { cs = window.getComputedStyle ? window.getComputedStyle(el) : null; } catch { cs = null; }',
    '                if (!isVisibleBox(cs, rect)) continue;',
    '                const id = getId(el);',
    '                if (!id) continue;',
    '                const pid = el.parentElement ? getId(el.parentElement) : "";',
    '                const x = (rect && Number(rect.left) || 0) + (Number(window && window.scrollX || 0) || 0);',
    '                const y = (rect && Number(rect.top) || 0) + (Number(window && window.scrollY || 0) || 0);',
    '                const w = rect && Number(rect.width) || 0;',
    '                const h = rect && Number(rect.height) || 0;',
    '                const tag = String(el.tagName || "").toUpperCase();',
    '                const attrs = {',
    '                  id: safeAttr(el, "id"),',
    '                  class: safeAttr(el, "class"),',
    '                  role: safeAttr(el, "role"),',
    '                  ariaLabel: safeAttr(el, "aria-label"),',
    '                  placeholder: tag === "INPUT" || tag === "TEXTAREA" ? safeAttr(el, "placeholder") : "",',
    '                  href: tag === "A" ? safeAttr(el, "href") : "",',
    '                  src: tag === "IMG" || tag === "VIDEO" || tag === "IFRAME" ? safeAttr(el, "src") : "",',
    '                  alt: tag === "IMG" ? safeAttr(el, "alt") : "",',
    '                };',
    '                const inputValue = tag === "INPUT" || tag === "TEXTAREA" ? safeAttr(el, "value") : "";',
    '                const text = (inputValue || "").trim() ? inputValue : (attrs.placeholder || safeText(el));',
    '                out.push({ id, pid, tag, rect: { x, y, w, h }, text, attrs, style: pickStyle(cs) });',
    '                if (out.length >= limit) break;',
    '              }',
    '              const payload = { meta, elements: out };',
    '              const raw = JSON.stringify(payload);',
    '              return raw.length > 6000000 ? raw.slice(0, 6000000) : raw;',
    '            } catch {',
    '              return "";',
    '            }',
    '          };',
    '          const computeRaw = () => (mode === "text" ? readText() : mode === "layout" ? readLayout() : readHtml());',
    '          const send = (payload) => { try { window.parent && window.parent.postMessage(payload, "*"); } catch { void 0; } };',
    '          const replyNow = () => {',
    '            const raw = computeRaw();',
    '            const clipped = raw && raw.length > maxChars;',
    '            const text = clipped ? raw.slice(0, maxChars) : raw;',
    '            send({ kind: KG_EXPORT_DOM_KIND, id: d.id, mode, title: document.title || "", clipped, text, diag: kgDiagSnapshot() });',
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
      '          const waitForHydration = async () => {',
      '            try {',
      '              const maxWaitMs = 7000;',
      '              const started = Date.now();',
      '              let best = 0;',
      '              let stable = 0;',
      '              while (Date.now() - started < maxWaitMs) {',
      '                if (mode === "layout") {',
      '                  const raw = String(readLayout() || "");',
      '                  let score = 0;',
      '                  try {',
      '                    const parsed = JSON.parse(raw);',
      '                    const els = parsed && parsed.elements;',
      '                    score = Array.isArray(els) ? els.length : 0;',
      '                  } catch {',
      '                    score = raw.trim().length;',
      '                  }',
      '                  if (score >= 140) return;',
      '                  if (score > best + 4) { best = score; stable = 0; } else { stable += 1; }',
      '                  if (stable >= 12 && best > 0) return;',
      '                  await new Promise(r => setTimeout(r, 120));',
      '                  continue;',
      '                }',
      '                const raw = String((mode === "text" ? readText() : readHtml()) || "");',
      '                const n = raw.trim().length;',
      '                const minChars = mode === "text" ? 260 : 1200;',
      '                if (n >= minChars) return;',
      '                if (n > best + 20) { best = n; stable = 0; } else { stable += 1; }',
      '                if (stable >= 12 && best > 0) return;',
      '                await new Promise(r => setTimeout(r, 120));',
      '              }',
      '            } catch {',
      '              void 0;',
      '            }',
      '          };',
    '          const run = async () => {',
    '            if (d && d.expandFaq) await autoExpandFaq();',
    '            if (d && d.scrollCrawl) await maybeCrawl();',
      '            await waitForHydration();',
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
    '            send({ kind: KG_EXPORT_DOM_KIND, id: d.id, mode, title: document.title || "", clipped, text, diag: kgDiagSnapshot() });',
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
  const looksLikeUpstreamBlockedHtml = (html: string): boolean => {
    const raw = String(html || '')
    if (!raw) return false
    const lower = raw
      .toLowerCase()
      .replace(/[\u2018\u2019\u201b\u2032]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    if (!lower) return false
    if (lower.includes('blocked by network security')) return true
    if (lower.includes("you've been blocked") && lower.includes('security')) return true
    if (lower.includes('you have been blocked') && lower.includes('security')) return true
    if (lower.includes('access denied') && (lower.includes('security') || lower.includes('blocked'))) return true
    if (lower.includes('your request has been blocked')) return true
    if (lower.includes('unusual traffic') && (lower.includes('blocked') || lower.includes('verify'))) return true
    if (lower.includes('attention required') && lower.includes('cloudflare')) return true
    if (lower.includes('incapsula') && (lower.includes('blocked') || lower.includes('access denied'))) return true
    return false
  }

  const buildUpstreamBlockedHtml = (originalUrl: string): string => {
    const safeUrl = String(originalUrl || '').trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="referrer" content="no-referrer">',
      '<title>Blocked</title>',
      '<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}a{word-break:break-all}</style>',
      '</head>',
      '<body>',
      `<div style="max-width:min(720px,92vw);border:1px solid rgba(148,163,184,0.5);border-radius:12px;background:#fff;padding:16px 18px;box-shadow:0 12px 30px rgba(15,23,42,0.08)">`,
      '<div style="font-size:12px;font-weight:700;margin-bottom:6px">Preview unavailable</div>',
      '<div style="font-size:12px;opacity:0.78;margin-bottom:10px">The upstream site requires cookies or blocks proxy requests.</div>',
      `<div style="font-size:12px"><a href="${safeUrl}" target="_blank" rel="noreferrer">Open in new tab</a></div>`,
      '</div>',
      '</body>',
      '</html>',
    ].join('\n')
  }

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

    const parsedReq = (() => {
      try {
        return new URL(req.url || '', `http://${req.headers.host}`)
      } catch {
        return null
      }
    })()
    const urlParam = parsedReq ? parsedReq.searchParams.get('url') : null
    const scriptPolicyParam = parsedReq ? parsedReq.searchParams.get('kg_script_policy') : null

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
      const upstreamUrl = (() => {
        try {
          return new URL(urlParam)
        } catch {
          return null
        }
      })()
      const upstreamHost = upstreamUrl ? upstreamUrl.hostname.toLowerCase() : ''
      const shouldSpoofWeChat = upstreamHost === 'mp.weixin.qq.com' || upstreamHost.endsWith('.mp.weixin.qq.com')
      const acceptLanguage = shouldSpoofWeChat
        ? 'zh-CN,zh;q=0.9,en;q=0.8'
        : 'en-US,en;q=0.9'
      const referer = shouldSpoofWeChat ? 'https://mp.weixin.qq.com/' : undefined

      const upstream = await fetch(urlParam, {
        method: req.method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,*/*;q=0.9',
          'Accept-Language': acceptLanguage,
          ...(referer ? { Referer: referer } : null),
        },
      })

      const upstreamContentType = String(upstream.headers.get('content-type') || '').toLowerCase()

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

      const isHtmlLike =
        upstreamContentType.includes('text/html') ||
        upstreamContentType.includes('application/xhtml+xml') ||
        upstreamContentType.includes('application/xml')
      if (!isHtmlLike) {
        const escapedUrl = String(urlParam).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const proxied = `/__fetch_remote?url=${encodeURIComponent(urlParam)}`
        const escapedProxied = proxied.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const wrapper = (() => {
          if (upstreamContentType.startsWith('image/')) {
            return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Image</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#fff}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="${escapedProxied}" alt="${escapedUrl}"></body></html>`
          }
          if (upstreamContentType.startsWith('video/')) {
            return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Video</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#000}video{max-width:100%;max-height:100%}</style></head><body><video controls src="${escapedProxied}"></video></body></html>`
          }
          if (upstreamContentType.startsWith('audio/')) {
            return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Audio</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#fff}audio{width:min(720px,100%);}</style></head><body><audio controls src="${escapedProxied}"></audio></body></html>`
          }
          if (upstreamContentType.includes('application/pdf')) {
            return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>PDF</title><style>html,body{height:100%;margin:0}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${escapedProxied}" title="${escapedUrl}"></iframe></body></html>`
          }
          return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Resource</title><style>body{font-family:ui-sans-serif,system-ui;margin:16px}a{word-break:break-all}</style></head><body><p>Non-HTML resource:</p><p><a href="${escapedProxied}" target="_blank" rel="noreferrer">${escapedUrl}</a></p></body></html>`
        })()
        res.end(wrapper, 'utf8')
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

      if (looksLikeUpstreamBlockedHtml(raw)) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(buildUpstreamBlockedHtml(urlParam), 'utf8')
        return
      }

      const injected = injectWebpageProxyHtml({
        html: raw,
        originalUrl: urlParam,
        scriptPolicy: scriptPolicyParam,
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

    const roots = [path.resolve(repoRoot), path.resolve(repoRoot, '..')]

    try {
      let fileAbs: string | null = null
      let content: Buffer | null = null
      for (const rootResolved of roots) {
        const candidate = path.resolve(rootResolved, repoPath)
        if (!candidate.startsWith(rootResolved + path.sep) && candidate !== rootResolved) continue
        try {
          const stat = await fs.stat(candidate)
          if (!stat.isFile()) continue
          fileAbs = candidate
          content = await fs.readFile(candidate)
          break
        } catch {
          continue
        }
      }
      if (!fileAbs || !content) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Not found')
        return
      }
      const ext = path.extname(fileAbs).toLowerCase()
      const types: Record<string, string> = {
        '.html': 'text/html',
        '.htm': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.md': 'text/markdown',
        '.markdown': 'text/markdown',
        '.mdx': 'text/markdown',
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
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Failed to load repo file')
    }
  }
}

function createKgFsWriteHandler(): import('vite').Connect.NextHandleFunction {
  const MAX_BODY_BYTES = 25_000_000
  const workspaceMirrorRoot = path.resolve(repoRoot, '..')
  const allowedRoots = [
    path.resolve(repoRoot),
    path.resolve(repoRoot, '..'),
  ]
  const isAllowed = (candidate: string): boolean => {
    const resolved = path.resolve(candidate)
    return allowedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep))
  }
  const toHostPath = (candidate: string): string => {
    const raw = String(candidate || '').trim()
    if (!raw) return ''
    const resolved = path.resolve(raw)
    if (isAllowed(resolved)) return resolved
    if (raw.startsWith('/')) return path.resolve(workspaceMirrorRoot, `.${raw}`)
    return path.resolve(workspaceMirrorRoot, raw)
  }
  const parseKgcPathInfo = (absPath: string): { canonicalPath: string; tracePath: string | null; stem: string | null } => {
    const normalized = path.resolve(absPath)
    const base = path.basename(normalized)
    const m = /^(kgc_(\d{14}))(?:-([a-z0-9-]+))?\.md$/i.exec(base)
    if (!m) return { canonicalPath: normalized, tracePath: null, stem: null }
    const stem = String(m[1] || '').trim()
    const suffix = String(m[3] || '').trim().toLowerCase()
    const dir = path.dirname(normalized)
    const canonicalPath = path.resolve(dir, `${stem}.md`)
    if (!suffix) return { canonicalPath, tracePath: null, stem }
    const tracePath = path.resolve(dir, `kgc-trace_${String(m[2] || '').trim()}.md`)
    return { canonicalPath, tracePath, stem }
  }
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', '*')
      res.setHeader('Access-Control-Max-Age', '86400')
      res.end()
      return
    }
    if (req.method !== 'POST') {
      next()
      return
    }
    let body = ''
    let tooLarge = false
    await new Promise<void>((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return
        body += chunk
        if (body.length > MAX_BODY_BYTES) {
          tooLarge = true
          try {
            req.destroy()
          } catch {
            void 0
          }
        }
      })
      req.on('end', () => resolve())
      req.on('error', () => resolve())
      req.on('close', () => resolve())
    })
    if (tooLarge) {
      res.statusCode = 413
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Body too large' }))
      return
    }
    let parsed: { path?: unknown; text?: unknown; base64?: unknown; encoding?: unknown; mimeType?: unknown } | null = null
    try {
      parsed = JSON.parse(body) as { path?: unknown; text?: unknown; base64?: unknown; encoding?: unknown; mimeType?: unknown }
    } catch {
      parsed = null
    }
    const incomingPath = typeof parsed?.path === 'string' ? parsed.path.trim() : ''
    const text = typeof parsed?.text === 'string' ? parsed.text : ''
    const base64 = typeof parsed?.base64 === 'string' ? parsed.base64 : ''
    const encoding = typeof parsed?.encoding === 'string' ? parsed.encoding.trim().toLowerCase() : ''
    if (!incomingPath || incomingPath.includes('\u0000')) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Missing path' }))
      return
    }
    const requestedAbsPath = toHostPath(incomingPath)
    const kgcPathInfo = parseKgcPathInfo(requestedAbsPath)
    const absPath = kgcPathInfo.tracePath || kgcPathInfo.canonicalPath
    const ext = String(path.extname(absPath) || '').toLowerCase()
    const base = path.basename(absPath)
    const isKgcOutputCompanion = /^kgc-output_\d{14}(?:-[a-z0-9-]+)?\.(md|html|svg|png|pdf|jpg|jpeg|webp|gif|mp4|webm|mov|glb)$/i.test(base)
    if (!(ext === '.md' || isKgcOutputCompanion)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Only .md and supported kgc-output companion files are allowed' }))
      return
    }
    if (!isAllowed(absPath)) {
      res.statusCode = 403
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'Forbidden' }))
      return
    }
    try {
      await fs.mkdir(path.dirname(absPath), { recursive: true })
      if (base64 && encoding === 'base64') {
        await fs.writeFile(absPath, Buffer.from(base64, 'base64'))
      } else if (typeof text === 'string') {
        await fs.writeFile(absPath, text, 'utf8')
      } else {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: 'Missing content' }))
        return
      }
      if (kgcPathInfo.stem) {
        const stem = kgcPathInfo.stem
        const dir = path.dirname(kgcPathInfo.canonicalPath)
        const variantPaths = [
          path.resolve(dir, `${stem}-we.md`),
          path.resolve(dir, `${stem}-wemd.md`),
          path.resolve(dir, `${stem}-weme.md`),
          path.resolve(dir, `${stem}-workspace-editor.md`),
        ]
        for (const variantPath of variantPaths) {
          if (!isAllowed(variantPath)) continue
          try {
            await fs.unlink(variantPath)
          } catch {
            void 0
          }
        }
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: true }))
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message || '') : ''
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: msg || 'Write failed' }))
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
    const normalizedUrlParam = urlParam
      ? urlParam
          .replace(/&amp;/g, '&')
          .replace(/&#38;/g, '&')
          .replace(/&#x26;/gi, '&')
      : ''
    if (!normalizedUrlParam || !/^https?:\/\//i.test(normalizedUrlParam)) {
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
      const upstreamUrl = (() => {
        try {
          return new URL(normalizedUrlParam)
        } catch {
          return null
        }
      })()
      const upstreamHost = upstreamUrl ? upstreamUrl.hostname.toLowerCase() : ''
      const shouldSpoofWeChat =
        upstreamHost === 'mp.weixin.qq.com' ||
        upstreamHost.endsWith('.mp.weixin.qq.com') ||
        upstreamHost === 'mmbiz.qpic.cn' ||
        upstreamHost.endsWith('.qpic.cn') ||
        upstreamHost === 'mmbiz.qlogo.cn' ||
        upstreamHost.endsWith('.qlogo.cn') ||
        upstreamHost === 'wx.qlogo.cn' ||
        upstreamHost.endsWith('.wx.qlogo.cn')
      const acceptLanguage =
        typeof req.headers['accept-language'] === 'string' && req.headers['accept-language'].trim()
          ? req.headers['accept-language']
          : shouldSpoofWeChat
            ? 'zh-CN,zh;q=0.9,en;q=0.8'
            : 'en-US,en;q=0.9'
      const referer = (() => {
        if (shouldSpoofWeChat) return 'https://mp.weixin.qq.com/'
        if (!upstreamUrl) return undefined
        const host = String(upstreamUrl.hostname || '').toLowerCase()
        if (host === 'media.licdn.com' || host.endsWith('.licdn.com')) return 'https://www.linkedin.com/'
        return `${upstreamUrl.origin}/`
      })()

      const upstream = await fetch(normalizedUrlParam, {
        method: req.method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: typeof req.headers.accept === 'string' && req.headers.accept.trim() ? req.headers.accept : '*/*',
          'Accept-Language': acceptLanguage,
          ...(referer ? { Referer: referer } : null),
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

function createWebpageAssetPathProxyHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', '*')
      res.setHeader('Access-Control-Max-Age', '86400')
      res.end()
      return
    }
    const methodRaw = String(req.method || '').toUpperCase()
    const isSupportedMethod =
      methodRaw === 'GET' ||
      methodRaw === 'HEAD' ||
      methodRaw === 'POST' ||
      methodRaw === 'PUT' ||
      methodRaw === 'PATCH' ||
      methodRaw === 'DELETE'
    if (!isSupportedMethod) {
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
    if (!parsed) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid url')
      return
    }

    const prefix = '/__webpage_asset_path/'
    const pathname = String(parsed.pathname || '')
    const rest = (pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname).replace(/^\/+/, '')
    const slash = rest.indexOf('/')
    const originEnc = slash >= 0 ? rest.slice(0, slash) : rest
    const upstreamPath = slash >= 0 ? `/${rest.slice(slash + 1)}` : '/'
    const origin = (() => {
      try {
        return decodeURIComponent(originEnc)
      } catch {
        return ''
      }
    })()

    if (!origin || !/^https?:\/\//i.test(origin)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Missing or invalid origin')
      return
    }

    const upstreamUrl = `${origin}${upstreamPath}${parsed.search || ''}`
    const upstreamHost = (() => {
      try {
        return new URL(upstreamUrl).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()
    const shouldSpoofWeChat =
      upstreamHost === 'mp.weixin.qq.com' ||
      upstreamHost.endsWith('.mp.weixin.qq.com') ||
      upstreamHost === 'mmbiz.qpic.cn' ||
      upstreamHost.endsWith('.qpic.cn') ||
      upstreamHost === 'mmbiz.qlogo.cn' ||
      upstreamHost.endsWith('.qlogo.cn') ||
      upstreamHost === 'wx.qlogo.cn' ||
      upstreamHost.endsWith('.wx.qlogo.cn')

    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutMs = (() => {
        const raw = String(process.env.KNOWGRPH_WEBPAGE_ASSET_PROXY_TIMEOUT_MS || '').trim()
        const parsedN = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsedN)) return 30_000
        return Math.max(1_000, Math.min(120_000, Math.floor(parsedN)))
      })()
      const maxBytes = (() => {
        const raw = String(process.env.KNOWGRPH_WEBPAGE_ASSET_PROXY_MAX_BYTES || '').trim()
        const parsedN = raw ? Number(raw) : NaN
        if (!Number.isFinite(parsedN)) return 25 * 1024 * 1024
        return Math.max(64 * 1024, Math.min(100 * 1024 * 1024, Math.floor(parsedN)))
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

      const readBody = async (): Promise<Buffer | null> => {
        if (methodRaw === 'GET' || methodRaw === 'HEAD') return null
        const chunks: Buffer[] = []
        let total = 0
        const maxBodyBytes = 5 * 1024 * 1024
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk) => {
            const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            total += b.length
            if (total > maxBodyBytes) {
              reject(new Error('Upstream request body too large'))
              return
            }
            chunks.push(b)
          })
          req.on('end', () => resolve())
          req.on('error', (e) => reject(e))
        })
        return Buffer.concat(chunks)
      }

      const bodyBuf = await readBody()

      const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: typeof req.headers.accept === 'string' && req.headers.accept.trim() ? req.headers.accept : '*/*',
        'Accept-Language':
          typeof req.headers['accept-language'] === 'string' && req.headers['accept-language'].trim()
            ? req.headers['accept-language']
            : shouldSpoofWeChat
              ? 'zh-CN,zh;q=0.9,en;q=0.8'
              : 'en-US,en;q=0.9',
      }
      upstreamHeaders.Referer = shouldSpoofWeChat ? 'https://mp.weixin.qq.com/' : `${origin.replace(/\/+$/, '')}/`
      if (typeof req.headers['content-type'] === 'string' && req.headers['content-type'].trim()) {
        upstreamHeaders['Content-Type'] = req.headers['content-type']
      }
      if (typeof req.headers.authorization === 'string' && req.headers.authorization.trim()) {
        upstreamHeaders.Authorization = req.headers.authorization
      }

      const upstream = await fetch(upstreamUrl, {
        method: methodRaw,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: upstreamHeaders,
        body: bodyBuf && bodyBuf.length ? (bodyBuf.buffer.slice(bodyBuf.byteOffset, bodyBuf.byteOffset + bodyBuf.byteLength) as ArrayBuffer) : undefined,
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
      res.setHeader('Cache-Control', methodRaw === 'GET' || methodRaw === 'HEAD' ? 'public, max-age=300' : 'no-store')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      const contentType = upstream.headers.get('content-type')
      if (contentType) res.setHeader('Content-Type', contentType)
      if (methodRaw === 'HEAD') {
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

function readViteDevPortHint(): string {
  const envPort = String(
    process.env.VITE_PORT
    || process.env.PORT
    || process.env.npm_config_port
    || '',
  ).trim()
  if (envPort) return envPort
  const argv = Array.isArray(process.argv) ? process.argv : []
  for (let i = 0; i < argv.length; i += 1) {
    const current = String(argv[i] || '').trim()
    if (!current) continue
    if (current === '--port' && i + 1 < argv.length) {
      const next = String(argv[i + 1] || '').trim()
      if (next) return next
      continue
    }
    if (current.startsWith('--port=')) {
      const value = current.slice('--port='.length).trim()
      if (value) return value
    }
  }
  return '5173'
}

function resolveViteCacheDir(command: string): string {
  const mode = command === 'build' ? 'build' : 'dev'
  if (mode === 'build') return path.resolve(__dirname, 'node_modules/.vite/build')
  const port = readViteDevPortHint().replace(/[^a-zA-Z0-9_-]/g, '') || '5173'
  // Isolate optimize-deps cache per dev port to avoid chunk races across concurrent Vite servers.
  return path.resolve(__dirname, `node_modules/.vite/dev-${port}`)
}

export default defineConfig(({ command }) => ({
  cacheDir: resolveViteCacheDir(command),
  base: command === 'build'
    ? (() => {
        const raw = String(process.env.VITE_BASE_PATH || '/knowgrph/').trim() || '/knowgrph/'
        const withLeading = raw.startsWith('/') ? raw : `/${raw}`
        return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
      })()
    : '/',
  esbuild: {
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['highlight.js', 'dayjs', 'mermaid', 'maplibre-gl', 'dagre', 'elkjs'],
    exclude: ['gympgrph', 'grph-shared', 'entities'],
    esbuildOptions: {
      sourcemap: false,
      plugins: [
        {
          name: 'knowgrph-optimize-strip-entities-sourcemaps',
          setup(build) {
            build.onLoad({ filter: /[\\/]entities[\\/]lib[\\/]esm[\\/].*\.js$/ }, async (args) => {
              const raw = await fs.readFile(args.path, 'utf8')
              const next = raw.replace(/^\/\/# sourceMappingURL=.*\n?/gm, '')
              return { contents: next, loader: 'js' }
            })
          },
        },
      ],
    },
  },
  build: {
    sourcemap: process.env.KG_BUILD_SOURCEMAP === '1' ? 'hidden' : false,
    minify: process.env.KG_LOW_MEM_BUILD === '1' ? false : 'esbuild',
    reportCompressedSize: process.env.KG_LOW_MEM_BUILD === '1' ? false : true,
    modulePreload: {
      resolveDependencies: (_filename: string, deps: string[]) =>
        deps.filter(dep => !/(^|\/|\.\/)(?:assets\/)?mermaid-[^/]+\.(?:js|css)$/.test(String(dep || ''))),
    },
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        ...(process.env.KG_LOW_MEM_BUILD === '1'
          ? { inlineDynamicImports: true as const }
          : {
              manualChunks: (id: string) => {
                const moduleId = String(id || '').replace(/\\/g, '/')
                if (moduleId.includes('/node_modules/react/')) return 'react'
                if (moduleId.includes('/node_modules/react-dom/')) return 'react'
                if (moduleId.includes('/node_modules/react-router-dom/')) return 'react'
                if (moduleId.includes('/node_modules/d3/')) return 'd3'
                if (moduleId.includes('/node_modules/lucide-react/')) return 'ui'
                if (moduleId.includes('/node_modules/zustand/')) return 'ui'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/language/')) return 'monaco-language'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/standalone/')) return 'monaco-standalone'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/contrib/')) return 'monaco-contrib'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/widget/')) return 'monaco-editor-widget'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/viewParts/')) return 'monaco-editor-viewparts'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/view/')) return 'monaco-editor-view'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/controller/')) return 'monaco-editor-controller'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/services/')) return 'monaco-editor-browser-services'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/')) return 'monaco-editor-browser'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/model/')) return 'monaco-editor-model'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/languages/')) return 'monaco-editor-languages'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/services/')) return 'monaco-editor-services'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/')) return 'monaco-editor-common'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/platform/')) return 'monaco-platform'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/browser/')) return 'monaco-base-browser'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/common/')) return 'monaco-base-common'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/')) return 'monaco-editor-core'
                if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/')) return 'monaco-base'
                if (moduleId.includes('/node_modules/monaco-editor/')) return 'monaco'
                if (moduleId.includes('/node_modules/mermaid/')) return 'mermaid'
                if (moduleId.includes('/node_modules/@mermaid-js/layout-elk/dist/chunks/mermaid-layout-elk.esm.min/render-')) return 'mermaid-elk-render'
                if (moduleId.includes('/node_modules/@mermaid-js/layout-elk/')) return 'mermaid-elk-core'
                if (moduleId.includes('/node_modules/elkjs/')) return 'elk'
                if (moduleId.includes('/node_modules/three/examples/')) return 'three-examples'
                if (moduleId.includes('/node_modules/@react-three/fiber/')) return 'three-fiber'
                if (moduleId.includes('/node_modules/three/src/renderers/')) return 'three-renderers'
                if (moduleId.includes('/node_modules/three/src/math/')) return 'three-math'
                if (moduleId.includes('/node_modules/three/src/materials/')) return 'three-materials'
                if (moduleId.includes('/node_modules/three/src/geometries/')) return 'three-geometries'
                if (moduleId.includes('/node_modules/three/src/objects/')) return 'three-objects'
                if (moduleId.includes('/node_modules/three/src/textures/')) return 'three-textures'
                if (moduleId.includes('/node_modules/three/src/core/')) return 'three-scene-core'
                if (moduleId.includes('/node_modules/three/src/lights/')) return 'three-lights'
                if (moduleId.includes('/node_modules/three/src/extras/')) return 'three-extras'
                if (moduleId.includes('/node_modules/three/')) return 'three-core'
                if (moduleId.includes('/node_modules/maplibre-gl/src/ui/')) return 'maplibre-ui'
                if (moduleId.includes('/node_modules/maplibre-gl/src/style/')) return 'maplibre-style'
                if (moduleId.includes('/node_modules/maplibre-gl/src/geo/')) return 'maplibre-geo'
                if (moduleId.includes('/node_modules/maplibre-gl/src/util/')) return 'maplibre-util'
                if (moduleId.includes('/node_modules/maplibre-gl/src/data/')) return 'maplibre-data'
                if (moduleId.includes('/node_modules/maplibre-gl/src/render/')) return 'maplibre-render'
                if (moduleId.includes('/node_modules/maplibre-gl/src/source/')) return 'maplibre-source'
                if (moduleId.includes('/node_modules/maplibre-gl/src/shaders/')) return 'maplibre-shaders'
                if (moduleId.includes('/node_modules/maplibre-gl/')) return 'maplibre-core'
                return undefined
              },
            }),
      },
    },
  },
  worker: {
    format: 'es',
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', 'highlight.js', 'dayjs', 'mermaid', 'maplibre-gl'],
    alias: [
      { find: 'react/jsx-runtime', replacement: resolvedReactJsxRuntime },
      { find: 'react/jsx-dev-runtime', replacement: resolvedReactJsxDevRuntime },
      { find: /^react$/, replacement: resolvedReact },
      { find: 'react-dom/client', replacement: resolvedReactDomClient },
      { find: /^react-dom$/, replacement: resolvedReactDom },
      { find: /^three$/, replacement: resolvedThreeSrc },
      { find: /^maplibre-gl$/, replacement: resolvedMaplibreEntry },
      { find: /^gympgrph$/, replacement: resolvedGympgrphSrc },
      { find: /^gympgrph\/map-preview$/, replacement: resolvedGympgrphMapPreviewSrc },
      { find: /^gympgrph\/testkit$/, replacement: resolvedGympgrphTestkitSrc },
      {
        find: /^grph-shared\/(.*)$/,
        replacement: path.resolve(__dirname, '../grph-shared/dist/$1.js'),
      },
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
      {
        find: /^@\/components\/BottomPanel\/BottomPanelMarkdownSection$/,
        replacement: path.resolve(__dirname, './src/components/BottomPanel/BottomPanelMarkdownSection.tsx'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ]
  },
  server: {
    port: 5173,
    strictPort: false,
    headers: {
      // Prevent stale immutable cache entries from serving mismatched prebundled deps across restarts.
      'Cache-Control': 'no-store',
    },
    fs: {
      allow: [
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../../grph'),
        path.resolve(__dirname, '../../sandbox'),
      ]
    }
  },
  plugins: [
    stripEntitiesBadSourcemapsPlugin,
    stripMermaidArchitectureDetectorPlugin,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: {
        id:
          command === 'build'
            ? (() => {
                const raw = String(process.env.VITE_BASE_PATH || '/knowgrph/').trim() || '/knowgrph/'
                const withLeading = raw.startsWith('/') ? raw : `/${raw}`
                return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
              })()
            : '/',
        name: 'knowgrph',
        short_name: 'knowgrph',
        description: 'Local-first knowledge graph canvas.',
        lang: 'en',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'browser'],
        orientation: 'any',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        categories: ['productivity', 'utilities', 'developer'],
        prefer_related_applications: false,
        shortcuts: [
          {
            name: 'Open Canvas',
            short_name: 'Canvas',
            description: 'Open the knowledge graph canvas.',
            url: '.',
          },
          {
            name: 'Open Editor',
            short_name: 'Editor',
            description: 'Open the editor workspace directly.',
            url: './?openEditorWorkspace=1',
          },
        ],
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['index.html', 'manifest.webmanifest', 'favicon.svg', 'assets/*.{js,css,woff,woff2,ttf}'],
        globIgnores: ['assets/monaco-*.js', 'assets/mermaid-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'script'
              || request.destination === 'style'
              || request.destination === 'worker',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kg-assets',
              expiration: { maxEntries: 160, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'kg-static',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.method === 'GET'
              && url.origin === self.location.origin
              && !url.pathname.startsWith('/__')
              && (
                url.pathname.endsWith('.json')
                || url.pathname.endsWith('.jsonld')
                || url.pathname.endsWith('.webmanifest')
              ),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kg-data',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
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
          stripeCheckoutDevPlugin,
          markdownPipelineDevPlugin,
          apiGraphDevPlugin,
          bipartiteFixtureDevPlugin,
          codebaseFileDevPlugin,
          remoteFetchProxyDevPlugin,
          grabMapsProxyDevPlugin,
          chatProxyDevPlugin,
          chatLogDevPlugin,
          kgFsWriteDevPlugin,
          webpageProxyDevPlugin,
          localGeoDatasetDevPlugin,
          pdfConvertDevPlugin,
          pdfWorkspaceDevPlugin,
          websiteImportDevPlugin,
          youtubeConvertDevPlugin,
        ]),
  ],
}))
