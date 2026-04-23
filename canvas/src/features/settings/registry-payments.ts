import type { SettingMeta } from './types'
import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { useGraphStore } from '@/hooks/useGraphStore'

const parseString = (raw: unknown): string | null => (typeof raw === 'string' ? raw : null)
const s = () => useGraphStore.getState()

export const paymentsSettingsRegistry: SettingMeta[] = [
  {
    key: 'payments.stripe.mode',
    type: 'string',
    source: 'localStorage',
    read: () => lsJson(LS_KEYS.paymentsStripeMode, 'test', parseString),
    write: (v) => {
      const raw = String(v || '').trim()
      const next = raw === 'live' ? 'live' : 'test'
      lsSetJson(LS_KEYS.paymentsStripeMode, next)
    },
    docKey: 'payments.stripe.mode',
    default: () => 'test',
    options: ['test', 'live'],
  },
  {
    key: 'payments.stripe.secretKey',
    type: 'string',
    source: 'localStorage',
    read: () => {
      const legacy = lsJson(LS_KEYS.paymentsStripeSecretKey, '', parseString)
      if (legacy) lsSetJson(LS_KEYS.paymentsStripeSecretKey, '')
      return ''
    },
    write: () => {
      lsSetJson(LS_KEYS.paymentsStripeSecretKey, '')
    },
    docKey: 'payments.stripe.secretKey',
    default: () => '',
  },
  {
    key: 'payments.stripe.publishableKey',
    type: 'string',
    source: 'localStorage',
    read: () => lsJson(LS_KEYS.paymentsStripePublishableKey, '', parseString),
    write: (v) => {
      lsSetJson(LS_KEYS.paymentsStripePublishableKey, String(v || ''))
    },
    docKey: 'payments.stripe.publishableKey',
    default: () => '',
  },
  {
    key: 'payments.stripe.webhookSecret',
    type: 'string',
    source: 'localStorage',
    read: () => lsJson(LS_KEYS.paymentsStripeWebhookSecret, '', parseString),
    write: (v) => {
      lsSetJson(LS_KEYS.paymentsStripeWebhookSecret, String(v || ''))
    },
    docKey: 'payments.stripe.webhookSecret',
    default: () => '',
  },
  {
    key: 'payments.stripe.accountId',
    type: 'string',
    source: 'localStorage',
    read: () => lsJson(LS_KEYS.paymentsStripeAccountId, '', parseString),
    write: (v) => {
      lsSetJson(LS_KEYS.paymentsStripeAccountId, String(v || ''))
    },
    docKey: 'payments.stripe.accountId',
    default: () => '',
  },
  {
    key: 'payments.stripe.paywallEnabled',
    type: 'boolean',
    source: 'localStorage',
    read: () => s().paymentsStripePaywallEnabled === true,
    write: (v) => {
      s().setPaymentsStripePaywallEnabled(Boolean(v))
    },
    docKey: 'payments.stripe.paywallEnabled',
    default: () => false,
  },
  {
    key: 'payments.stripe.checkoutUrl',
    type: 'string',
    source: 'localStorage',
    read: () => String(s().paymentsStripeCheckoutUrl || ''),
    write: (v) => {
      s().setPaymentsStripeCheckoutUrl(String(v || ''))
    },
    docKey: 'payments.stripe.checkoutUrl',
    default: () => '',
  },
]
