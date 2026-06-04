import {
  STRIPE_CHECKOUT_RETURN_PARAM,
  STRIPE_CHECKOUT_SESSION_ID_PARAM,
  STRIPE_PAYMENT_ROUTE_PATHS,
  buildStripeCheckoutSessionStatusUrl,
} from 'grph-shared/payments/stripePaymentSsot'

type StripeCheckoutSessionResponse = {
  ok?: boolean
  id?: string
  url?: string
  status?: string
  paymentStatus?: string
  error?: string | {
    message?: string
    type?: string
    code?: string
  }
}

export type StripeCheckoutStoredSession = {
  id: string
  status: string
  paymentStatus: string
  mode: string
  amountTotal: number | null
  currency: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

type StripeCheckoutSessionStatusResponse = {
  ok?: boolean
  session?: StripeCheckoutStoredSession
  error?: StripeCheckoutSessionResponse['error']
}

type StripeCheckoutRedirectDocument = Pick<Document, 'body' | 'createElement' | 'documentElement'>

const readStripeCheckoutErrorMessage = (
  json: StripeCheckoutSessionResponse | StripeCheckoutSessionStatusResponse | null,
  fallback: string,
): string => {
  if (typeof json?.error === 'string' && json.error.trim()) return json.error.trim()
  if (json?.error && typeof json.error === 'object' && typeof json.error.message === 'string' && json.error.message.trim()) {
    return json.error.message.trim()
  }
  return fallback
}

export function buildStripeCheckoutReturnUrls(rawHref?: string | URL | null): {
  successUrl: string
  cancelUrl: string
} {
  const fallbackHref = typeof window !== 'undefined' && window.location?.href
    ? window.location.href
    : 'http://localhost/'
  const source = new URL(String(rawHref || fallbackHref), fallbackHref)
  source.searchParams.delete(STRIPE_CHECKOUT_RETURN_PARAM)
  source.searchParams.delete(STRIPE_CHECKOUT_SESSION_ID_PARAM)

  const success = new URL(source.href)
  success.searchParams.set(STRIPE_CHECKOUT_RETURN_PARAM, 'success')
  success.searchParams.delete(STRIPE_CHECKOUT_SESSION_ID_PARAM)

  const cancel = new URL(source.href)
  cancel.searchParams.set(STRIPE_CHECKOUT_RETURN_PARAM, 'cancel')
  cancel.searchParams.delete(STRIPE_CHECKOUT_SESSION_ID_PARAM)

  return {
    successUrl: success.href,
    cancelUrl: cancel.href,
  }
}

export async function createStripeHostedCheckoutSessionUrl(args: {
  successUrl: string
  cancelUrl: string
  workspaceId?: string | null
  agenticCommerceSessionId?: string | null
  expectedAmountTotal?: number | null
  expectedCurrency?: string | null
}): Promise<{ id: string; url: string }> {
  const successUrl = String(args.successUrl || '').trim()
  const cancelUrl = String(args.cancelUrl || '').trim()
  const workspaceId = String(args.workspaceId || '').trim()
  const agenticCommerceSessionId = String(args.agenticCommerceSessionId || '').trim()
  const expectedAmountTotal = typeof args.expectedAmountTotal === 'number'
    ? Math.floor(args.expectedAmountTotal)
    : Number(args.expectedAmountTotal)
  const expectedCurrency = String(args.expectedCurrency || '').trim().toLowerCase()
  if (!successUrl || !cancelUrl) throw new Error('Missing Stripe Checkout return URLs.')

  const res = await fetch(STRIPE_PAYMENT_ROUTE_PATHS.checkoutSession, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      successUrl,
      cancelUrl,
      workspaceId: workspaceId || null,
      ...(agenticCommerceSessionId
        ? {
            agenticCommerceSessionId,
            expectedAmountTotal,
            expectedCurrency,
          }
        : {}),
    }),
  })

  const json = (await res.json().catch(() => null)) as StripeCheckoutSessionResponse | null
  if (!res.ok) {
    const message = readStripeCheckoutErrorMessage(json, `Stripe Checkout Session create failed (HTTP ${res.status}).`)
    throw new Error(message)
  }

  const id = typeof json?.id === 'string' ? json.id : ''
  const url = typeof json?.url === 'string' ? json.url : ''
  if (!id || !url) throw new Error('Stripe response missing Checkout Session url.')

  return { id, url }
}

export function redirectToStripeHostedCheckoutUrl(
  url: string,
  targetDocument: StripeCheckoutRedirectDocument | null =
    typeof document !== 'undefined' ? document : null,
): void {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) throw new Error('Missing Stripe Checkout redirect URL.')

  const checkoutUrl = new URL(normalizedUrl)
  if (checkoutUrl.protocol !== 'https:') {
    throw new Error('Stripe Checkout redirect URL must be HTTPS.')
  }

  if (targetDocument?.createElement) {
    const anchor = targetDocument.createElement('a')
    anchor.href = checkoutUrl.href
    anchor.target = '_self'
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    const parent = targetDocument.body || targetDocument.documentElement
    parent?.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }

  if (typeof window !== 'undefined' && window.location?.assign) {
    window.location.assign(checkoutUrl.href)
    return
  }

  throw new Error('Stripe Checkout redirect target unavailable.')
}

export async function readStripeCheckoutSessionStatus(sessionId: string): Promise<StripeCheckoutStoredSession> {
  const normalizedSessionId = String(sessionId || '').trim()
  if (!normalizedSessionId) throw new Error('Missing Stripe Checkout Session id.')

  const res = await fetch(buildStripeCheckoutSessionStatusUrl(normalizedSessionId), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })
  const json = (await res.json().catch(() => null)) as StripeCheckoutSessionStatusResponse | null
  if (!res.ok) {
    const message = readStripeCheckoutErrorMessage(json, `Stripe Checkout Session status lookup failed (HTTP ${res.status}).`)
    throw new Error(message)
  }

  const session = json?.session
  if (!session || typeof session.id !== 'string') throw new Error('Stripe status response missing Checkout Session.')
  return session
}
