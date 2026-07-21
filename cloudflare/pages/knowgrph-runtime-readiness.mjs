const ROOT_RUNTIME_READINESS_PATH = '/.well-known/runtime-readiness.json'

const unavailableResponse = request => new Response(
  request.method === 'HEAD' ? null : 'Production runtime readiness is temporarily unavailable.\n',
  {
    status: 503,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '1',
      'x-content-type-options': 'nosniff',
    },
  },
)

export const buildRootRuntimeReadinessRequest = request => {
  const url = new URL(request.url)
  url.pathname = ROOT_RUNTIME_READINESS_PATH
  url.search = ''
  url.hash = ''
  const headers = new Headers(request.headers)
  headers.delete('origin')
  return new Request(url, { method: request.method, headers })
}

export async function onRequest(context) {
  const method = String(context.request.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
  }

  const rootRequest = buildRootRuntimeReadinessRequest(context.request)
  const response = typeof context.env?.ASSETS?.fetch === 'function'
    ? await context.env.ASSETS.fetch(rootRequest)
    : await context.next(rootRequest)
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (!response.ok || !contentType.startsWith('application/json')) return unavailableResponse(context.request)

  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0')
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('x-knowgrph-route-owner', 'knowgrph-runtime-readiness-pages')
  return new Response(method === 'HEAD' ? null : response.body, { status: 200, headers })
}
