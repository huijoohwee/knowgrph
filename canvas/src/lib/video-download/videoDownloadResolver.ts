import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { readEnvString } from '@/lib/config.env'
import { readWorkspaceImportVideoDownloadOutputDirSetting } from '@/lib/workspace/workspaceStoreSyncSettings'
import type { VideoDownloadOptions, VideoDownloadResolverResult, VideoDownloadResultOk } from './types'
import { isVideoDownloadParseError, parseVideoDownloadResult } from './videoDownloadResultCodec'

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type ResolveVideoDownloadOptions = {
  fetchImpl?: FetchLike
  timeoutMs?: number
  endpoint?: string | null
}

const DEFAULT_TIMEOUT_MS = 300_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 600_000
export const VIDEO_DOWNLOAD_LOCAL_ROUTE_PATH = '/__video_download'
const inFlightDownloads = new Map<string, Promise<VideoDownloadResolverResult>>()

function normalizeFormat(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 64) : ''
}

function normalizeMediaKind(value: unknown): string {
  return value === 'audio' || value === 'video-audio' ? value : ''
}

function normalizeQuality(value: unknown): string {
  return /^(best|1080p|720p|480p|360p|audio-best|audio-compact)$/.test(String(value || '')) ? String(value) : ''
}

function normalizeSubtitleLang(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 35) : ''
}

function normalizeOutputDir(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\\/g, '/').replace(/\/+$/, '').slice(0, 4096) : ''
}

function resolveTimeoutMs(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, n))
}

function isHttpEndpoint(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeVideoDownloadError(value: unknown, max = 256): string {
  const raw = String(value || '').trim() || 'download_failed'
  return raw
    .replace(/\bat\s+[^\n()]+(?:\([^)]*\))?/g, '')
    .replace(/\bfile:\/\/\S+/g, '')
    .replace(/(?:\/[^\s/]+)+\/[^\s]+\.(?:m?js|ts|tsx|jsx)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'download_failed'
}

function buildRequestBody(url: string, options: VideoDownloadOptions): Record<string, string> {
  const body: Record<string, string> = { url }
  const format = normalizeFormat(options.format)
  const mediaKind = normalizeMediaKind(options.mediaKind)
  const quality = normalizeQuality(options.quality)
  const subtitleLang = normalizeSubtitleLang(options.subtitleLang)
  const outputDir = normalizeOutputDir(options.outputDir || readWorkspaceImportVideoDownloadOutputDirSetting())
  if (format) body.format = format
  if (mediaKind) body.mediaKind = mediaKind
  if (quality) body.quality = quality
  if (subtitleLang) body.subtitleLang = subtitleLang
  if (outputDir) body.outputDir = outputDir
  return body
}

export function resolveVideoDownloadEndpoint(override?: string | null): string {
  if (typeof override === 'string') return override.trim()
  const configured = readEnvString('VITE_VIDEO_DOWNLOAD_ENDPOINT', '').trim()
  if (configured) return configured
  const win = typeof window !== 'undefined' ? window : null
  const origin = typeof win?.location?.origin === 'string' ? win.location.origin.trim() : ''
  return origin ? `${origin}${VIDEO_DOWNLOAD_LOCAL_ROUTE_PATH}` : ''
}

function buildDedupKey(url: string, options: VideoDownloadOptions): string {
  return [
    url,
    normalizeFormat(options.format) || 'best',
    normalizeMediaKind(options.mediaKind) || 'video-audio',
    normalizeQuality(options.quality) || 'best',
    normalizeOutputDir(options.outputDir || readWorkspaceImportVideoDownloadOutputDirSetting()),
  ].join('|')
}

function parseResponseBody(text: string) {
  if (!text) return { kind: 'parse_error' as const, reason: 'empty_response' }
  try {
    const raw = JSON.parse(text) as unknown
    if (raw && typeof raw === 'object' && 'result' in raw) {
      return parseVideoDownloadResult((raw as { result?: unknown }).result)
    }
    return parseVideoDownloadResult(raw)
  } catch {
    return parseVideoDownloadResult(text)
  }
}

export function resolveVideoDownload(
  urlRaw: string,
  options: VideoDownloadOptions = {},
  opts: ResolveVideoDownloadOptions = {},
): Promise<VideoDownloadResolverResult> {
  const url = String(urlRaw || '').trim()
  const key = buildDedupKey(url, options)
  const existing = inFlightDownloads.get(key)
  if (existing) return existing

  const promise = resolveVideoDownloadOnce(url, options, opts).finally(() => {
    inFlightDownloads.delete(key)
  })
  inFlightDownloads.set(key, promise)
  return promise
}

async function resolveVideoDownloadOnce(
  url: string,
  options: VideoDownloadOptions,
  opts: ResolveVideoDownloadOptions,
): Promise<VideoDownloadResolverResult> {
  if (!url || url.length > 2048) return { ok: false, error: 'invalid_url', errorCode: 'invalid_url' }

  const bridge = getMarkdownWorkspaceActionBridge()
  if (typeof bridge.downloadVideo === 'function') {
    const bridgeResult = await bridge.downloadVideo(url, options)
    if (bridgeResult.ok === true) return { ok: true, result: bridgeResult as VideoDownloadResultOk }
    return { ok: false, error: sanitizeVideoDownloadError(bridgeResult.error), errorCode: bridgeResult.errorCode }
  }

  const endpoint = resolveVideoDownloadEndpoint(opts.endpoint)
  if (!isHttpEndpoint(endpoint)) return { ok: false, error: 'not_configured', errorCode: 'not_configured' }

  const fetchImpl = opts.fetchImpl || globalThis.fetch?.bind(globalThis)
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'fetch_unavailable', errorCode: 'fetch_unavailable' }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), resolveTimeoutMs(opts.timeoutMs))
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildRequestBody(url, options)),
      signal: controller.signal,
    })
    const text = await response.text()
    const parsedRaw = parseResponseBody(text)
    if (!response.ok) {
      if (!isVideoDownloadParseError(parsedRaw) && parsedRaw.ok === false) {
        return { ok: false, error: sanitizeVideoDownloadError(parsedRaw.error), errorCode: parsedRaw.errorCode }
      }
      return { ok: false, error: sanitizeVideoDownloadError(response.statusText || 'download_failed') }
    }
    if (isVideoDownloadParseError(parsedRaw)) {
      const fields = parsedRaw.missingFields?.length ? `:${parsedRaw.missingFields.join(',')}` : ''
      return { ok: false, error: sanitizeVideoDownloadError(`${parsedRaw.reason}${fields}`) }
    }
    if (parsedRaw.ok === false) {
      return { ok: false, error: sanitizeVideoDownloadError(parsedRaw.error), errorCode: parsedRaw.errorCode }
    }
    return { ok: true, result: parsedRaw }
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name || '') : ''
    if (name === 'AbortError') return { ok: false, error: 'download_timeout', errorCode: 'download_timeout' }
    return { ok: false, error: sanitizeVideoDownloadError((error as { message?: unknown })?.message ?? error) }
  } finally {
    clearTimeout(timeoutId)
  }
}
