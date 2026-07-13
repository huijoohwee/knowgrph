import { Buffer } from 'node:buffer'
import type { ServerResponse } from 'node:http'

const OMITTED_UPSTREAM_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'www-authenticate',
])
const MAX_BUFFERED_RESPONSE_BYTES = 64 * 1024 * 1024

const isJsonContentType = (value: string): boolean => (
  value.includes('application/json') || /application\/[^;]+\+json(?:;|$)/i.test(value)
)

const applyUpstreamHeaders = (args: {
  response: Response
  target: ServerResponse
  requestOrigin: string
}): void => {
  args.target.statusCode = args.response.status
  args.response.headers.forEach((value, key) => {
    if (OMITTED_UPSTREAM_HEADERS.has(key.toLowerCase())) return
    args.target.setHeader(key, value)
  })
  args.target.setHeader('Cache-Control', 'no-store')
  if (args.requestOrigin) {
    args.target.setHeader('Access-Control-Allow-Origin', args.requestOrigin)
    args.target.setHeader('Vary', 'Origin')
  }
}

const validateBufferedBody = (response: Response, body: Buffer): void => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (!isJsonContentType(contentType)) return
  const text = body.toString('utf8').trim()
  if (!text) throw new Error(`Chat proxy upstream returned an empty JSON response (HTTP ${response.status})`)
  try {
    JSON.parse(text)
  } catch {
    throw new Error(`Chat proxy upstream returned malformed JSON (HTTP ${response.status})`)
  }
}

const readBufferedBody = async (response: Response): Promise<Buffer> => {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BUFFERED_RESPONSE_BYTES) {
    throw new Error(`Chat proxy upstream response is too large (${declaredLength} bytes)`)
  }
  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let totalBytes = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    if (!chunk.value?.byteLength) continue
    totalBytes += chunk.value.byteLength
    if (totalBytes > MAX_BUFFERED_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new Error(`Chat proxy upstream response is too large (more than ${MAX_BUFFERED_RESPONSE_BYTES} bytes)`)
    }
    chunks.push(Buffer.from(chunk.value))
  }
  return Buffer.concat(chunks, totalBytes)
}

export const forwardChatProxyUpstreamHead = (args: {
  response: Response
  target: ServerResponse
  requestOrigin: string
}): void => {
  applyUpstreamHeaders(args)
  args.target.end()
}

export const forwardChatProxyUpstreamResponse = async (args: {
  response: Response
  target: ServerResponse
  requestOrigin: string
}): Promise<'buffered' | 'streamed'> => {
  const contentType = String(args.response.headers.get('content-type') || '').toLowerCase()
  const isEventStream = contentType.includes('text/event-stream')
  if (!isEventStream) {
    const body = await readBufferedBody(args.response)
    validateBufferedBody(args.response, body)
    applyUpstreamHeaders(args)
    args.target.end(body)
    return 'buffered'
  }

  applyUpstreamHeaders(args)
  const reader = args.response.body?.getReader()
  if (!reader) {
    args.target.end()
    return 'streamed'
  }
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    if (!chunk.value?.byteLength) continue
    args.target.write(Buffer.from(chunk.value))
  }
  args.target.end()
  return 'streamed'
}
