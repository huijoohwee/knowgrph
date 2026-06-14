const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
}

const MAX_URL_LENGTH = 2048
const MAX_FORMAT_LENGTH = 64
const MAX_SUBTITLE_LENGTH = 35
const QUALITY_PATTERN = /^(best|1080p|720p|480p|360p|audio-best|audio-compact)$/

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export function sanitizeError(msg, max = 300) {
  return String(msg || 'download_failed')
    .replace(/\bat\s+[^\n()]+(?:\([^)]*\))?/g, '')
    .replace(/\bfile:\/\/\S+/g, '')
    .replace(/(?:\/[^\s/]+)+\/[^\s]+\.(?:m?js|ts|tsx|jsx)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'download_failed'
}

function safeString(value, max) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : ''
}

export function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'request_body_must_be_object' }
  }
  const url = safeString(body.url, MAX_URL_LENGTH)
  if (!url) return { ok: false, error: 'invalid_url' }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, error: 'invalid_url' }
  } catch {
    return { ok: false, error: 'invalid_url' }
  }
  const format = safeString(body.format, MAX_FORMAT_LENGTH)
  const mediaKind = body.mediaKind === 'audio' || body.mediaKind === 'video-audio' ? body.mediaKind : ''
  const quality = QUALITY_PATTERN.test(String(body.quality || '')) ? String(body.quality) : ''
  const subtitleLang = safeString(body.subtitleLang, MAX_SUBTITLE_LENGTH)
  return {
    ok: true,
    url,
    ...(format ? { format } : {}),
    ...(mediaKind ? { mediaKind } : {}),
    ...(quality ? { quality } : {}),
    ...(subtitleLang ? { subtitleLang } : {}),
  }
}

function classifyError(message) {
  const lower = String(message || '').toLowerCase()
  if (lower.includes('native_runtime_required')) return { status: 501, errorCode: 'native_runtime_required' }
  if (lower.includes('unavailable') || lower.includes('geo') || lower.includes('private') || lower.includes('copyright')) {
    return { status: 422, errorCode: 'video_unavailable' }
  }
  return { status: 500, errorCode: 'download_failed' }
}

function explainError(errorCode, fallback) {
  if (errorCode === 'native_runtime_required') {
    return 'Native audio/video download requires the local Dev/Preview runtime because Cloudflare Pages Functions do not provide a durable local filesystem for downloaded media.'
  }
  return fallback
}

async function runNativePagesDownload() {
  throw new Error('native_runtime_required')
}

export async function onRequest(context) {
  const request = context.request
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }

  const validated = validateRequest(body)
  if (!validated.ok) return jsonResponse({ ok: false, error: validated.error }, 400)

  try {
    return jsonResponse(await runNativePagesDownload(validated))
  } catch (error) {
    const errorText = sanitizeError(error && typeof error === 'object' && 'message' in error ? error.message : error)
    const classified = classifyError(errorText)
    return jsonResponse({ ok: false, errorCode: classified.errorCode, error: explainError(classified.errorCode, errorText) }, classified.status)
  }
}
