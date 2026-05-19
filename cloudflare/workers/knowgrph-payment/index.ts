import { handleStripePaymentRoute, isStripePaymentRoute } from './payments'
import { readDb, type D1DatabaseLike } from '../shared/d1'

type HeadersRecord = Record<string, string>

export type KnowgrphPaymentWorkerEnv = Record<string, unknown> & {
  DB: unknown
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,stripe-signature',
  'access-control-max-age': '86400',
}

const noContent = (): Response =>
  new Response(null, { status: 204, headers: CORS_HEADERS })

const json = (status: number, body: unknown, headers: HeadersRecord = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...CORS_HEADERS,
      ...headers,
    },
  })

const paymentWorkerError = (status: number, error: string): Response =>
  json(status, { ok: false, error })

const handlePaymentRequest = async (
  request: Request,
  env: KnowgrphPaymentWorkerEnv,
  db: D1DatabaseLike,
): Promise<Response> => {
  const paymentResponse = await handleStripePaymentRoute(request, env, db, CORS_HEADERS)
  if (paymentResponse) return paymentResponse
  return paymentWorkerError(404, 'payment route not found')
}

export const createKnowgrphPaymentWorker = () => ({
  async fetch(request: Request, env: KnowgrphPaymentWorkerEnv): Promise<Response> {
    if (request.method === 'OPTIONS') return noContent()
    const url = new URL(request.url)
    if (!isStripePaymentRoute(url.pathname)) {
      return paymentWorkerError(404, 'payment route not found')
    }
    const db = readDb(env)
    if (!db) return paymentWorkerError(500, 'missing Cloudflare D1 binding DB')
    try {
      return await handlePaymentRequest(request, env, db)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unexpected payment worker error'
      return paymentWorkerError(500, message)
    }
  },
})

const worker = createKnowgrphPaymentWorker()

export default worker
