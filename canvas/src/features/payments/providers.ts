export type PaymentProviderId = 'stripe'

export type PaymentProviderSpec = {
  id: PaymentProviderId
  label: string
  areaLabel: string
  docsUrl?: string
}

export const DEFAULT_PAYMENT_PROVIDER_ID: PaymentProviderId = 'stripe'

export const PAYMENTS_PROVIDERS: ReadonlyArray<PaymentProviderSpec> = [
  {
    id: 'stripe',
    label: 'Stripe Payment API',
    areaLabel: 'Stripe Payment API',
    docsUrl: 'https://docs.stripe.com/api',
  },
]

export const resolvePaymentsProviderSpec = (id: string | undefined): PaymentProviderSpec => {
  const trimmed = String(id || '').trim()
  const found = PAYMENTS_PROVIDERS.find(p => p.id === trimmed)
  return found || PAYMENTS_PROVIDERS[0]
}

