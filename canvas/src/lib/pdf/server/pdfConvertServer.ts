import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { normalizePdfExtractedMarkdown } from '../normalizePdfExtractedMarkdown'
import { embedPdfAssetsInMarkdown } from '../embedPdfAssetsInMarkdown'
import { convertPdfBytesToMarkdown, writePdfAssets } from '../native/nativePdfToMarkdownNode'

type PdfConvertResult = { ok: true; markdown: string; name: string } | { ok: false; error: string }

type PdfAssetStore = { token: string; assetsDir: string; tmpDir: string; createdAtMs: number }

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

function deriveMarkdownNameFromPdfFilename(name: string): string {
  const raw = String(name || '').trim()
  if (!raw) return 'document.md'
  const base = raw.replace(/\.pdf$/i, '') || 'document'
  return `${base}.md`
}

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

type PdfConvertProvider = 'native' | 'docling-remote'

async function convertPdfViaDoclingRemote(args: { endpoint: string; pdfBytes: Buffer; nameHint?: string }): Promise<PdfConvertResult> {
  const endpoint = String(args.endpoint || '').trim()
  if (!endpoint) return { ok: false, error: 'Missing Docling endpoint' }
  try {
    const body = (() => {
      const copy = new Uint8Array(args.pdfBytes.byteLength)
      copy.set(args.pdfBytes)
      return copy.buffer
    })()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/pdf',
        ...(args.nameHint ? { 'X-Import-Filename': args.nameHint } : {}),
      },
      body,
    })
    const json = (await res.json()) as { ok?: unknown; markdown?: unknown; error?: unknown; name?: unknown }
    if (json && json.ok === true && typeof json.markdown === 'string') {
      const nameRaw = typeof json.name === 'string' ? json.name.trim() : ''
      const name = nameRaw ? (nameRaw.toLowerCase().endsWith('.pdf') ? deriveMarkdownNameFromPdfFilename(nameRaw) : nameRaw) : 'document.md'
      return { ok: true, markdown: json.markdown, name }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    if (err) return { ok: false, error: err }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: false, error: 'Docling conversion failed' }
  } catch (error) {
    const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '') : ''
    return { ok: false, error: msg || 'Docling conversion failed' }
  }
}

function pickProvider(overrides?: { provider?: string | null }): PdfConvertProvider {
  const fromOverride = String(overrides?.provider || '').trim().toLowerCase()
  if (fromOverride === 'docling' || fromOverride === 'docling-remote') return 'docling-remote'
  if (fromOverride === 'native') return 'native'

  const mode = String(process.env.KNOWGRPH_PDF_MODE || '').trim().toLowerCase()
  if (mode === 'online') {
    const doclingEndpoint = String(process.env.KNOWGRPH_DOCLING_ENDPOINT || '').trim()
    if (doclingEndpoint) return 'docling-remote'
  }
  const provider = String(process.env.KNOWGRPH_PDF_PROVIDER || '').trim().toLowerCase()
  if (provider === 'docling' || provider === 'docling-remote') return 'docling-remote'
  return 'native'
}

function defaultIncludeImages(overrides?: { includeImages?: boolean | undefined }): boolean {
  if (typeof overrides?.includeImages === 'boolean') return overrides.includeImages
  const raw = String(process.env.KNOWGRPH_PDF_INCLUDE_IMAGES || '').trim()
  if (raw) return raw === '1'
  return true
}

function defaultEmbedImages(overrides?: { embedImages?: boolean | undefined }): boolean {
  if (typeof overrides?.embedImages === 'boolean') return overrides.embedImages
  const raw = String(process.env.KNOWGRPH_PDF_EMBED_IMAGES || '').trim()
  if (raw) return raw === '1'
  return false
}

function defaultStreamDecodeCacheMaxBytes(): number {
  const raw = String(process.env.KNOWGRPH_PDF_STREAM_DECODE_CACHE_MAX_BYTES || '').trim()
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed)
  return 64 * 1024 * 1024
}

export async function convertPdfToMarkdown(opts: {
  url?: string
  body?: Buffer
  nameHint?: string
  overrides?: {
    includeImages?: boolean
    embedImages?: boolean
    maxExtractedImagesPerPage?: number
    maxEmbeddedImagesPerPage?: number
    maxEmbeddedTotalBytes?: number
    maxEmbeddedAssetBytes?: number
    deepseekOcr2Enabled?: boolean
    deepseekOcr2Mode?: 'fallback' | 'always'
    provider?: string
    doclingEndpoint?: string
    providerFallbackToNative?: boolean
  }
}): Promise<PdfConvertResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowgrph-pdf-'))
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
    let pdfBytes: Buffer | null = null
    if (opts.body) {
      pdfBytes = opts.body
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
      if (!upstream.ok) return { ok: false, error: `Upstream fetch failed (${upstream.status})` }
      const ab = await upstream.arrayBuffer()
      pdfBytes = Buffer.from(ab)
    } else {
      await cleanup()
      return { ok: false, error: 'Missing PDF url or body' }
    }
    if (!pdfBytes) return { ok: false, error: 'Missing PDF bytes' }

    const title =
      (opts.nameHint && opts.nameHint.trim()
        ? opts.nameHint.trim()
        : opts.url
          ? derivePdfTitleFromUrl(opts.url)
          : '') || 'document.pdf'
    const assetUrlPrefix = `/__pdf_assets/${token}`

    const provider = pickProvider({ provider: opts.overrides?.provider })
    if (provider === 'docling-remote') {
      const endpoint = String(opts.overrides?.doclingEndpoint || '').trim() || String(process.env.KNOWGRPH_DOCLING_ENDPOINT || '').trim()
      const result = await convertPdfViaDoclingRemote({ endpoint, pdfBytes, nameHint: opts.nameHint })
      if (!result.ok) {
        const allowFallback =
          typeof opts.overrides?.providerFallbackToNative === 'boolean'
            ? opts.overrides.providerFallbackToNative
            : String(process.env.KNOWGRPH_PDF_PROVIDER_FALLBACK_TO_NATIVE || '').trim() === '1'
        if (allowFallback) {
          return await convertPdfToMarkdown({ ...opts, overrides: { ...opts.overrides, provider: 'native' } })
        }
        return result
      }
      return {
        ok: true,
        name: result.name,
        markdown: normalizePdfExtractedMarkdown(result.markdown),
      }
    }

    const includeImages = defaultIncludeImages({ includeImages: opts.overrides?.includeImages })
    const embedImages = includeImages && defaultEmbedImages({ embedImages: opts.overrides?.embedImages })
    const maxExtractedImagesPerPage = (() => {
      if (typeof opts.overrides?.maxExtractedImagesPerPage === 'number' && opts.overrides.maxExtractedImagesPerPage > 0) {
        return Math.floor(opts.overrides.maxExtractedImagesPerPage)
      }
      const raw = String(process.env.KNOWGRPH_PDF_MAX_EXTRACTED_IMAGES_PER_PAGE || '').trim()
      const parsed = raw ? Number(raw) : NaN
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
    })()
    const maxEmbeddedImagesPerPage = (() => {
      if (typeof opts.overrides?.maxEmbeddedImagesPerPage === 'number' && opts.overrides.maxEmbeddedImagesPerPage >= 0) {
        return Math.floor(opts.overrides.maxEmbeddedImagesPerPage)
      }
      const raw = String(process.env.KNOWGRPH_PDF_MAX_EMBEDDED_IMAGES_PER_PAGE || '').trim()
      const parsed = raw ? Number(raw) : NaN
      return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined
    })()

    const streamDecodeCacheMaxBytes = defaultStreamDecodeCacheMaxBytes()

    const ocrEnhance = (() => {
      const modeEnv = String(process.env.KNOWGRPH_PDF_MODE || '').trim().toLowerCase()
      const enabledFromMode = modeEnv === 'online'
      const enabled =
        typeof opts.overrides?.deepseekOcr2Enabled === 'boolean'
          ? opts.overrides.deepseekOcr2Enabled
          : String(process.env.KNOWGRPH_DEEPSEEK_OCR2_ENABLE || '').trim() === '1' || enabledFromMode
      const endpoint = String(process.env.KNOWGRPH_DEEPSEEK_OCR2_ENDPOINT || '').trim()
      if (!enabled || !endpoint) return null
      const mode: 'always' | 'fallback' =
        opts.overrides?.deepseekOcr2Mode === 'always'
          ? 'always'
          : opts.overrides?.deepseekOcr2Mode === 'fallback'
            ? 'fallback'
            : String(process.env.KNOWGRPH_DEEPSEEK_OCR2_MODE || '').trim().toLowerCase() === 'always'
              ? 'always'
              : 'fallback'
      const minTextChars = (() => {
        const raw = String(process.env.KNOWGRPH_DEEPSEEK_OCR2_MIN_TEXT_CHARS || '').trim()
        const parsed = raw ? Number(raw) : NaN
        return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined
      })()
      const maxImagesPerPage = (() => {
        const raw = String(process.env.KNOWGRPH_DEEPSEEK_OCR2_MAX_IMAGES_PER_PAGE || '').trim()
        const parsed = raw ? Number(raw) : NaN
        return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
      })()
      const timeoutMs = (() => {
        const raw = String(process.env.KNOWGRPH_DEEPSEEK_OCR2_TIMEOUT_MS || '').trim()
        const parsed = raw ? Number(raw) : NaN
        return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
      })()
      const prompt = (() => {
        const raw = String(process.env.KNOWGRPH_DEEPSEEK_OCR2_PROMPT || '').trim()
        return raw ? raw : undefined
      })()
      return { enabled, endpoint, mode, minTextChars, maxImagesPerPage, timeoutMs, prompt }
    })()

    const native = await convertPdfBytesToMarkdown({
      pdfBytes,
      title,
      assetUrlPrefix,
      includeImages,
      maxExtractedImagesPerPage,
      maxEmbeddedImagesPerPage,
      ocrEnhance,
      streamDecodeCacheMaxBytes,
    })
    let markdown = normalizePdfExtractedMarkdown(native.markdown)
    if (embedImages && native.assets.length > 0) {
      const envMaxEmbeddedTotalBytes = (() => {
        const raw = String(process.env.KNOWGRPH_PDF_MAX_EMBEDDED_TOTAL_BYTES || '').trim()
        const n = raw ? Number(raw) : NaN
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
      })()
      const envMaxEmbeddedAssetBytes = (() => {
        const raw = String(process.env.KNOWGRPH_PDF_MAX_EMBEDDED_ASSET_BYTES || '').trim()
        const n = raw ? Number(raw) : NaN
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
      })()
      const embedded = embedPdfAssetsInMarkdown({
        markdown,
        assets: native.assets,
        assetUrlPrefix,
        maxTotalBytes: typeof opts.overrides?.maxEmbeddedTotalBytes === 'number' ? opts.overrides.maxEmbeddedTotalBytes : envMaxEmbeddedTotalBytes,
        maxAssetBytes: typeof opts.overrides?.maxEmbeddedAssetBytes === 'number' ? opts.overrides.maxEmbeddedAssetBytes : envMaxEmbeddedAssetBytes,
      })
      markdown = embedded.markdown
    }

    const needsAssetServer = includeImages && markdown.includes(`(${assetUrlPrefix}/`)
    if (needsAssetServer && native.assets.length > 0) {
      await writePdfAssets({ assetsDir, assets: native.assets })
      pdfAssetCache.add({ token, assetsDir, tmpDir, createdAtMs: Date.now() })
    } else {
      await cleanup()
    }
    const name =
      (opts.nameHint && opts.nameHint.trim()
        ? deriveMarkdownNameFromPdfFilename(opts.nameHint)
        : opts.url
          ? derivePdfNameFromUrl(opts.url)
          : 'document.md') || 'document.md'
    return { ok: true, markdown, name }
  } catch (error) {
    await cleanup()
    const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message || '') : ''
    return { ok: false, error: msg || 'PDF conversion failed' }
  }
}

export function createPdfConvertHandler(): import('vite').Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    try {
      const parsed = new URL(req.url || '', `http://${req.headers.host}`)
      const urlParam = parsed.searchParams.get('url') || undefined
      const includeImagesOverride = (() => {
        const raw = parsed.searchParams.get('includeImages')
        if (raw == null) return undefined
        return raw.trim() === '1'
      })()
      const embedImagesOverride = (() => {
        const raw = parsed.searchParams.get('embedImages')
        if (raw == null) return undefined
        return raw.trim() === '1'
      })()
      const conversionMode = (() => {
        const raw = String(parsed.searchParams.get('conversionMode') || '').trim().toLowerCase()
        if (raw === 'text-only' || raw === 'image-heavy' || raw === 'scan-ocr') return raw
        return undefined
      })()
      const provider = (() => {
        const raw = String(parsed.searchParams.get('provider') || '').trim()
        return raw || undefined
      })()
      const doclingEndpoint = (() => {
        const raw = String(parsed.searchParams.get('doclingEndpoint') || '').trim()
        return raw || undefined
      })()
      const providerFallbackToNative = (() => {
        const raw = parsed.searchParams.get('providerFallbackToNative')
        if (raw == null) return undefined
        return raw.trim() === '1'
      })()
      const maxExtractedImagesPerPage = (() => {
        const raw = parsed.searchParams.get('maxExtractedImagesPerPage')
        const n = raw ? Number(raw) : NaN
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
      })()
      const maxEmbeddedImagesPerPage = (() => {
        const raw = parsed.searchParams.get('maxEmbeddedImagesPerPage')
        const n = raw ? Number(raw) : NaN
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
      })()
      const maxEmbeddedTotalBytes = (() => {
        const raw = parsed.searchParams.get('maxEmbeddedTotalBytes')
        const n = raw ? Number(raw) : NaN
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
      })()
      const maxEmbeddedAssetBytes = (() => {
        const raw = parsed.searchParams.get('maxEmbeddedAssetBytes')
        const n = raw ? Number(raw) : NaN
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
      })()
      const deepseekOcr2Enabled = (() => {
        const raw = parsed.searchParams.get('deepseekOcr2')
        if (raw == null) return undefined
        return raw.trim() === '1'
      })()
      const deepseekOcr2Mode = (() => {
        const raw = String(parsed.searchParams.get('deepseekOcr2Mode') || '').trim().toLowerCase()
        if (!raw) return undefined
        return raw === 'always' ? 'always' : raw === 'fallback' ? 'fallback' : undefined
      })()
      const nameHintHeader = typeof req.headers['x-import-filename'] === 'string' ? req.headers['x-import-filename'] : undefined
      const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : ''

      const modeOverrides = (() => {
        if (conversionMode === 'image-heavy') {
          return {
            includeImages: true,
            embedImages: false,
            maxExtractedImagesPerPage: 16,
            maxEmbeddedImagesPerPage: 12,
            maxEmbeddedTotalBytes: 4 * 1024 * 1024,
            maxEmbeddedAssetBytes: 2 * 1024 * 1024,
            deepseekOcr2Enabled: false,
            deepseekOcr2Mode: 'fallback' as const,
          }
        }
        if (conversionMode === 'scan-ocr') {
          return {
            includeImages: false,
            embedImages: false,
            maxExtractedImagesPerPage: 4,
            maxEmbeddedImagesPerPage: 0,
            maxEmbeddedTotalBytes: 4 * 1024 * 1024,
            maxEmbeddedAssetBytes: 2 * 1024 * 1024,
            deepseekOcr2Enabled: true,
            deepseekOcr2Mode: 'always' as const,
          }
        }
        if (conversionMode === 'text-only') {
          return {
            includeImages: false,
            embedImages: false,
            maxExtractedImagesPerPage: 0,
            maxEmbeddedImagesPerPage: 0,
            maxEmbeddedTotalBytes: 4 * 1024 * 1024,
            maxEmbeddedAssetBytes: 2 * 1024 * 1024,
            deepseekOcr2Enabled: false,
            deepseekOcr2Mode: 'fallback' as const,
          }
        }
        return null
      })()

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
        overrides: {
          includeImages: includeImagesOverride ?? modeOverrides?.includeImages,
          embedImages: embedImagesOverride ?? modeOverrides?.embedImages,
          maxExtractedImagesPerPage: maxExtractedImagesPerPage ?? modeOverrides?.maxExtractedImagesPerPage,
          maxEmbeddedImagesPerPage: maxEmbeddedImagesPerPage ?? modeOverrides?.maxEmbeddedImagesPerPage,
          maxEmbeddedTotalBytes: maxEmbeddedTotalBytes ?? modeOverrides?.maxEmbeddedTotalBytes,
          maxEmbeddedAssetBytes: maxEmbeddedAssetBytes ?? modeOverrides?.maxEmbeddedAssetBytes,
          deepseekOcr2Enabled: deepseekOcr2Enabled ?? modeOverrides?.deepseekOcr2Enabled,
          deepseekOcr2Mode: deepseekOcr2Mode ?? modeOverrides?.deepseekOcr2Mode,
          provider,
          doclingEndpoint,
          providerFallbackToNative,
        },
      })
      res.statusCode = result.ok ? 200 : 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (error) {
      let message = 'PDF conversion failed'
      if (error && typeof error === 'object' && 'message' in error) {
        const candidate = (error as { message?: unknown }).message
        if (typeof candidate === 'string' && candidate.trim()) message = candidate
      }
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: message }))
    }
  }
}

export function createPdfAssetsHandler(): import('vite').Connect.NextHandleFunction {
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
