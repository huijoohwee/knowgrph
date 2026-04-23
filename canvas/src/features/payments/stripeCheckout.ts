type StripeCheckoutSessionResponse = {
  id?: string
  url?: string
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

const STRIPE_CHECKOUT_SESSION_CREATE_PATH = '/__stripe_checkout_session'

export async function createStripeHostedCheckoutSessionUrl(args: {
  successUrl: string
  cancelUrl: string
}): Promise<{ id: string; url: string }> {
  const successUrl = String(args.successUrl || '').trim()
  const cancelUrl = String(args.cancelUrl || '').trim()
  if (!successUrl || !cancelUrl) throw new Error('Missing Stripe Checkout return URLs.')

  const res = await fetch(STRIPE_CHECKOUT_SESSION_CREATE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      successUrl,
      cancelUrl,
    }),
  })

  const json = (await res.json().catch(() => null)) as StripeCheckoutSessionResponse | null
  if (!res.ok) {
    const message = json?.error?.message || `Stripe Checkout Session create failed (HTTP ${res.status}).`
    throw new Error(message)
  }

  const id = typeof json?.id === 'string' ? json.id : ''
  const url = typeof json?.url === 'string' ? json.url : ''
  if (!id || !url) throw new Error('Stripe response missing Checkout Session url.')

  return { id, url }
}
