import { Buffer } from 'node:buffer'
import type { ServerResponse } from 'node:http'
import { forwardChatProxyUpstreamHead, forwardChatProxyUpstreamResponse } from '../../viteChatProxyResponse'

const createTarget = () => {
  const headers = new Map<string, string>()
  const chunks: Buffer[] = []
  let ended = false
  const target = {
    statusCode: 0,
    setHeader: (name: string, value: string | number | readonly string[]) => {
      headers.set(name.toLowerCase(), String(value))
    },
    write: (chunk: Uint8Array) => {
      chunks.push(Buffer.from(chunk))
      return true
    },
    end: (chunk?: Uint8Array) => {
      if (chunk) chunks.push(Buffer.from(chunk))
      ended = true
      return target
    },
  } as unknown as ServerResponse
  return {
    target,
    headers,
    chunks,
    readEnded: () => ended,
  }
}

export async function testChatProxyBuffersJsonBeforePublishingSuccessHeaders() {
  const output = createTarget()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error('upstream terminated'))
    },
  })
  let failure = ''
  try {
    await forwardChatProxyUpstreamResponse({
      response: new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } }),
      target: output.target,
      requestOrigin: '',
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (!failure.includes('upstream terminated')) throw new Error(`expected upstream body failure, got ${JSON.stringify(failure)}`)
  if (output.target.statusCode !== 0 || output.headers.size !== 0 || output.readEnded()) {
    throw new Error('expected the proxy to leave the downstream response untouched until the JSON body completes')
  }
}

export async function testChatProxyRejectsEmptyJsonBeforePublishingSuccessHeaders() {
  const output = createTarget()
  let failure = ''
  try {
    await forwardChatProxyUpstreamResponse({
      response: new Response('', { status: 200, headers: { 'content-type': 'application/json' } }),
      target: output.target,
      requestOrigin: '',
    })
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (!failure.includes('empty JSON response')) throw new Error(`expected empty JSON failure, got ${JSON.stringify(failure)}`)
  if (output.target.statusCode !== 0 || output.headers.size !== 0 || output.readEnded()) {
    throw new Error('expected empty JSON to fail before a downstream success response starts')
  }
}

export async function testChatProxyForwardsCompleteBufferedJson() {
  const output = createTarget()
  const mode = await forwardChatProxyUpstreamResponse({
    response: new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '11' },
    }),
    target: output.target,
    requestOrigin: 'http://localhost:5173',
  })
  if (mode !== 'buffered' || output.target.statusCode !== 200 || !output.readEnded()) {
    throw new Error('expected complete JSON to forward as one buffered response')
  }
  if (Buffer.concat(output.chunks).toString('utf8') !== '{"ok":true}') {
    throw new Error('expected complete JSON body to be preserved')
  }
  if (output.headers.has('content-length')) throw new Error('expected stale upstream content-length to be omitted')
  if (output.headers.get('access-control-allow-origin') !== 'http://localhost:5173') {
    throw new Error('expected request origin to be preserved')
  }
}

export async function testChatProxyHeadPreservesHeadersWithoutReadingBody() {
  const output = createTarget()
  const response = new Response(null, {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-provider-request-id': 'request-1' },
  })
  forwardChatProxyUpstreamHead({
    response,
    target: output.target,
    requestOrigin: 'http://localhost:5173',
  })
  if (output.target.statusCode !== 200 || !output.readEnded()) {
    throw new Error('expected HEAD response to preserve the upstream status and end normally')
  }
  if (output.headers.get('x-provider-request-id') !== 'request-1') {
    throw new Error('expected HEAD response to preserve safe upstream headers')
  }
}
