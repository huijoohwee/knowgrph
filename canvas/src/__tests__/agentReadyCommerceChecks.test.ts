import {
  AGENTIC_COMMERCE_X402_FALLBACK_PAY_TO_ADDRESS,
  AGENTIC_COMMERCE_X402_PLACEHOLDER_PAY_TO_ADDRESS,
} from 'grph-shared/payments/agenticCommerceSsot'
import {
  assertAuthoritativeX402PaymentRequired,
} from '../../../scripts/agent-ready-commerce-checks.mjs'

const buildPaymentRequiredPayload = (payTo: string) => ({
  x402Version: 2,
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:84532',
      amount: '1000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      payTo,
    },
  ],
})

export function testAgentReadyCommerceChecksRejectFallbackX402PayToAddress() {
  const payload = buildPaymentRequiredPayload(AGENTIC_COMMERCE_X402_FALLBACK_PAY_TO_ADDRESS)
  let rejected = false
  try {
    assertAuthoritativeX402PaymentRequired(payload, 'test x402 probe')
  } catch (error) {
    rejected = true
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('deterministic fallback payTo') || !message.includes('X402_PAY_TO_ADDRESS')) {
      throw new Error(`expected fallback payTo rejection to name X402_PAY_TO_ADDRESS, got ${message}`)
    }
  }
  if (!rejected) throw new Error('expected x402 readiness to reject the deterministic fallback payTo address')
}

export function testAgentReadyCommerceChecksRejectPlaceholderX402PayToAddress() {
  const payload = buildPaymentRequiredPayload(AGENTIC_COMMERCE_X402_PLACEHOLDER_PAY_TO_ADDRESS)
  let rejected = false
  try {
    assertAuthoritativeX402PaymentRequired(payload, 'test x402 probe')
  } catch (error) {
    rejected = true
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('future-setup placeholder') || !message.includes('X402_PAY_TO_ADDRESS')) {
      throw new Error(`expected placeholder payTo rejection to name X402_PAY_TO_ADDRESS, got ${message}`)
    }
  }
  if (!rejected) throw new Error('expected x402 readiness to reject the placeholder payTo address')
}

export function testAgentReadyCommerceChecksAcceptConfiguredX402PayToAddress() {
  const payload = buildPaymentRequiredPayload('0x1111111111111111111111111111111111111111')
  if (assertAuthoritativeX402PaymentRequired(payload, 'test x402 probe') !== true) {
    throw new Error('expected x402 readiness to accept a configured EVM payTo address')
  }
}
