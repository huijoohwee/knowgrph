import {
  STRIPE_CHECKOUT_RETURN_PARAM,
  STRIPE_CHECKOUT_SESSION_ID_PARAM,
} from 'grph-shared/payments/stripePaymentSsot'

export type StripeCheckoutReturnState =
  | { kind: 'success'; sessionId: string }
  | { kind: 'cancel'; sessionId: string }
  | null

export function parseStripeCheckoutReturnSearch(search: string): StripeCheckoutReturnState {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const status = String(params.get(STRIPE_CHECKOUT_RETURN_PARAM) || '').trim().toLowerCase()
  if (status !== 'success' && status !== 'cancel') return null
  const sessionId = String(params.get(STRIPE_CHECKOUT_SESSION_ID_PARAM) || '').trim()
  return status === 'success'
    ? { kind: 'success', sessionId }
    : { kind: 'cancel', sessionId }
}

export function consumeStripeCheckoutReturnParams(search: string): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(String(search || window.location.search || '').replace(/^\?/, ''))
  if (!params.has(STRIPE_CHECKOUT_RETURN_PARAM) && !params.has(STRIPE_CHECKOUT_SESSION_ID_PARAM)) return
  params.delete(STRIPE_CHECKOUT_RETURN_PARAM)
  params.delete(STRIPE_CHECKOUT_SESSION_ID_PARAM)
  const nextSearch = params.toString()
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`
  window.history.replaceState(null, '', nextUrl)
}
